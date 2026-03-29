/**
 * Frame CDN Worker
 * 
 * Serves media assets (thumbnails, previews) from R2 with aggressive caching.
 * Designed to run on custom domains: cdn.{tenant-domain}.com
 * 
 * Routes:
 *   /thumb/{videoId}       → R2: thumbs/{videoId}.webp (or .jpg)
 *   /media/{path}          → R2: {path} (generic media)
 *   /health                → health check
 */

interface Env {
  MEDIA: R2Bucket;
  DB: D1Database;
  ALLOWED_ORIGINS: string;
}

const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
const CACHE_SHORT = 'public, max-age=3600, s-maxage=86400';

const MIME_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env),
      });
    }

    // Only GET/HEAD
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Health check
    if (path === '/health') {
      return new Response('OK', { status: 200 });
    }

    // /thumb/{videoId} → serves thumbnail from R2
    const thumbMatch = path.match(/^\/thumb\/([a-zA-Z0-9_-]+)$/);
    if (thumbMatch) {
      return serveThumbnail(thumbMatch[1], request, env);
    }

    // /media/{...path} → serves any media from R2
    if (path.startsWith('/media/')) {
      const key = path.slice(7); // remove /media/
      return serveR2(key, request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function serveThumbnail(videoId: string, request: Request, env: Env): Promise<Response> {
  const acceptWebp = (request.headers.get('accept') || '').includes('image/webp');
  
  // Prefer webp if browser supports it, then jpg
  const extensions = acceptWebp 
    ? ['webp', 'jpg', 'jpeg', 'png']
    : ['jpg', 'jpeg', 'png', 'webp'];
  
  for (const ext of extensions) {
    const key = `thumbs/${videoId}.${ext}`;
    const object = await env.MEDIA.get(key);
    
    if (object) {
      // Vary on Accept so CDN caches webp/jpeg separately
      return r2Response(object, request, env, { 'vary': 'Accept' });
    }
  }

  // Fallback: check DB for original thumbnail_url and proxy it
  const video = await env.DB.prepare(
    'SELECT thumbnail_url FROM videos WHERE id = ?'
  ).bind(videoId).first<{ thumbnail_url: string }>();

  if (video?.thumbnail_url) {
    return proxyAndCache(videoId, video.thumbnail_url, request, env);
  }

  return new Response('Not found', { status: 404 });
}

async function proxyAndCache(
  videoId: string,
  originUrl: string,
  request: Request,
  env: Env
): Promise<Response> {
  // Fetch from origin
  const originResp = await fetch(originUrl, {
    headers: { 'User-Agent': 'FrameVideos-CDN/1.0' },
  });

  if (!originResp.ok) {
    return new Response('Origin fetch failed', { status: 502 });
  }

  const data = await originResp.arrayBuffer();
  const contentType = originResp.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('webp') ? 'webp' : 
              contentType.includes('png') ? 'png' : 'jpg';
  const key = `thumbs/${videoId}.${ext}`;

  // Store in R2 (fire and forget — don't block the response)
  const r2Promise = env.MEDIA.put(key, data, {
    httpMetadata: {
      contentType,
      cacheControl: CACHE_IMMUTABLE,
    },
  }).then(() => {
    // Update DB thumbnail_path
    return env.DB.prepare(
      'UPDATE videos SET thumbnail_path = ? WHERE id = ?'
    ).bind(key, videoId).run();
  }).catch(() => {
    // Silently ignore R2/DB errors on cache-through
  });

  // Use waitUntil pattern if available (Cloudflare Workers)
  // Since we can't access ctx here, we await it
  // In production, this should use ctx.waitUntil()
  await r2Promise;

  return new Response(data, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': CACHE_IMMUTABLE,
      'x-cdn-cache': 'MISS',
      ...corsHeaders(env),
    },
  });
}

async function serveR2(key: string, request: Request, env: Env): Promise<Response> {
  const object = await env.MEDIA.get(key);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  return r2Response(object, request, env);
}

function r2Response(object: R2ObjectBody, request: Request, env: Env, extraHeaders?: Record<string, string>): Response {
  const contentType = object.httpMetadata?.contentType || 
    guessMime(object.key) || 'application/octet-stream';

  const headers: Record<string, string> = {
    'content-type': contentType,
    'cache-control': CACHE_IMMUTABLE,
    'etag': object.httpEtag,
    'x-cdn-cache': 'HIT',
    ...corsHeaders(env),
    ...extraHeaders,
  };

  // Handle conditional requests (304)
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

function guessMime(key: string): string | null {
  for (const [ext, mime] of Object.entries(MIME_TYPES)) {
    if (key.endsWith(ext)) return mime;
  }
  return null;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGINS || '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-max-age': '86400',
  };
}
