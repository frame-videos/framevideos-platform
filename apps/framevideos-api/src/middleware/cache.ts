// KV-based cache middleware — Sprint 10
// Caches public GET responses for 5 minutes, with automatic invalidation

import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = 'cache';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simple hash for query string to create stable cache keys.
 * Uses a fast djb2-like hash since we don't need cryptographic strength.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Build cache key from request.
 * Format: cache:{method}:{path}:{query_hash}
 */
function buildCacheKey(method: string, path: string, queryString: string): string {
  const queryHash = queryString ? hashString(queryString) : '0';
  return `${CACHE_PREFIX}:${method}:${path}:${queryHash}`;
}

/**
 * Extract resource prefix from a path for invalidation.
 * e.g., /api/v1/public/tenant123/videos → cache:GET:/api/v1/public/tenant123/videos
 */
function getResourcePrefix(path: string): string {
  // Remove trailing ID/slug segments to get the collection path
  const segments = path.split('/').filter(Boolean);
  // Keep at least the base resource path
  return `${CACHE_PREFIX}:GET:/${segments.join('/')}`;
}

// ─── Cache interface stored in KV ────────────────────────────────────────────

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  cachedAt: number;
}

// ─── Cache Middleware ────────────────────────────────────────────────────────

/**
 * Cache middleware for public GET requests.
 * - Caches responses in KV for 5 minutes
 * - Skips cache if Authorization header is present
 * - Skips cache if Cache-Control: no-cache
 * - Adds X-Cache: HIT/MISS and X-Cache-TTL headers
 */
export function kvCache(ttlSeconds: number = DEFAULT_TTL_SECONDS): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const method = c.req.method.toUpperCase();

    // Only cache GET requests
    if (method !== 'GET') {
      await next();

      // On mutation, invalidate related cache entries
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const path = new URL(c.req.url).pathname;
        invalidateCache(c.env.CACHE, path).catch(() => {});
      }

      return;
    }

    // Skip cache if authenticated request
    if (c.req.header('authorization')) {
      c.header('X-Cache', 'BYPASS');
      await next();
      return;
    }

    // Skip cache if no-cache requested
    const cacheControl = c.req.header('cache-control') ?? '';
    if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
      c.header('X-Cache', 'BYPASS');
      await next();
      return;
    }

    const url = new URL(c.req.url);
    const cacheKey = buildCacheKey(method, url.pathname, url.search);
    const kv = c.env.CACHE;

    // Try to get from cache
    try {
      const cached = await kv.get<CachedResponse>(cacheKey, 'json');

      if (cached) {
        const age = Math.floor((Date.now() - cached.cachedAt) / 1000);
        const remaining = Math.max(0, ttlSeconds - age);

        // Reconstruct response from cache
        const headers = new Headers(cached.headers);
        headers.set('X-Cache', 'HIT');
        headers.set('X-Cache-TTL', String(remaining));
        headers.set('X-Cache-Age', String(age));

        return new Response(cached.body, {
          status: cached.status,
          headers,
        });
      }
    } catch {
      // Cache read failed — continue without cache
    }

    // Cache miss — execute handler
    await next();

    // Only cache successful JSON responses
    const status = c.res.status;
    if (status < 200 || status >= 300) {
      c.header('X-Cache', 'MISS');
      return;
    }

    // Clone response to read body
    try {
      const responseBody = await c.res.text();
      const responseHeaders: Record<string, string> = {};
      c.res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const cacheEntry: CachedResponse = {
        status,
        headers: responseHeaders,
        body: responseBody,
        cachedAt: Date.now(),
      };

      // Store in KV with TTL
      kv.put(cacheKey, JSON.stringify(cacheEntry), {
        expirationTtl: ttlSeconds,
      }).catch(() => {});

      // Reconstruct response (since we consumed the body)
      const newHeaders = new Headers(responseHeaders);
      newHeaders.set('X-Cache', 'MISS');
      newHeaders.set('X-Cache-TTL', String(ttlSeconds));

      c.res = new Response(responseBody, {
        status,
        headers: newHeaders,
      });
    } catch {
      c.header('X-Cache', 'MISS');
    }
  };
}

// ─── Cache invalidation ─────────────────────────────────────────────────────

/**
 * Invalidate cache entries related to a resource path.
 * Since KV doesn't support prefix deletion, we use a list-based approach:
 * store known cache keys in a metadata key, then delete them.
 */
async function invalidateCache(kv: KVNamespace, path: string): Promise<void> {
  // Best-effort: delete the exact path cache and common variants
  const basePath = path.replace(/\/[^/]+$/, ''); // Remove last segment (ID)
  const keysToInvalidate = [
    buildCacheKey('GET', path, ''),
    buildCacheKey('GET', basePath, ''),
  ];

  // Also try to list and delete keys with this prefix
  try {
    const prefix = `${CACHE_PREFIX}:GET:${basePath}`;
    const listed = await kv.list({ prefix, limit: 50 });

    for (const key of listed.keys) {
      keysToInvalidate.push(key.name);
    }
  } catch {
    // List not supported or failed — just delete known keys
  }

  await Promise.allSettled(
    keysToInvalidate.map((key) => kv.delete(key)),
  );
}
