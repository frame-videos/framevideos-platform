/**
 * Backfill thumbnails: fetch from external CDN, convert to WebP, store in R2.
 * Processes videos that have thumbnail_url but no thumbnail_path.
 * 
 * POST /backfill-thumbs?limit=50&tenant=duovideos
 */

export async function handleBackfillThumbs(
  request: Request,
  env: { DB: D1Database; MEDIA: R2Bucket }
): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const tenant = url.searchParams.get('tenant') || null;

  // Get videos without thumbnail_path
  let query = `SELECT id, thumbnail_url, tenant_id FROM videos WHERE thumbnail_url IS NOT NULL AND (thumbnail_path IS NULL OR thumbnail_path = '')`;
  const params: unknown[] = [];
  if (tenant) {
    query += ` AND tenant_id = ?`;
    params.push(tenant);
  }
  query += ` LIMIT ?`;
  params.push(limit);

  const { results: videos } = await env.DB.prepare(query).bind(...params).all<{
    id: string;
    thumbnail_url: string;
    tenant_id: string;
  }>();

  if (!videos || videos.length === 0) {
    return Response.json({ message: 'No videos to process', processed: 0 });
  }

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const video of videos) {
    try {
      // Fetch thumbnail from external CDN
      const response = await fetch(video.thumbnail_url, {
        headers: { 'User-Agent': 'FrameVideos/1.0' },
      });

      if (!response.ok) {
        errors.push(`${video.id}: fetch failed ${response.status}`);
        failed++;
        continue;
      }

      const imageData = await response.arrayBuffer();

      if (imageData.byteLength < 100) {
        errors.push(`${video.id}: image too small (${imageData.byteLength}b)`);
        failed++;
        continue;
      }

      // Try to convert to WebP using Cloudflare Image Resizing
      let finalData: ArrayBuffer = imageData;
      let contentType = 'image/webp';

      try {
        const resizeResponse = await fetch(video.thumbnail_url, {
          cf: {
            image: {
              format: 'webp',
              width: 320,
              height: 180,
              fit: 'cover',
              quality: 80,
            },
          },
        } as RequestInit);

        if (resizeResponse.ok && resizeResponse.headers.get('content-type')?.includes('webp')) {
          finalData = await resizeResponse.arrayBuffer();
        } else {
          // Fallback: store original JPEG
          contentType = response.headers.get('content-type') || 'image/jpeg';
        }
      } catch {
        contentType = response.headers.get('content-type') || 'image/jpeg';
      }

      // Store in R2
      const ext = contentType.includes('webp') ? 'webp' : 'jpg';
      const key = `thumbs/${video.id}.${ext}`;

      await env.MEDIA.put(key, finalData, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });

      // Update DB
      await env.DB.prepare(
        `UPDATE videos SET thumbnail_path = ? WHERE id = ?`
      ).bind(key, video.id).run();

      processed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${video.id}: ${msg}`);
      failed++;
    }
  }

  return Response.json({
    total: videos.length,
    processed,
    failed,
    remaining: await getRemainingCount(env.DB, tenant),
    errors: errors.slice(0, 20),
  });
}

async function getRemainingCount(db: D1Database, tenant: string | null): Promise<number> {
  let query = `SELECT COUNT(*) as count FROM videos WHERE thumbnail_url IS NOT NULL AND (thumbnail_path IS NULL OR thumbnail_path = '')`;
  const params: unknown[] = [];
  if (tenant) {
    query += ` AND tenant_id = ?`;
    params.push(tenant);
  }
  const result = await db.prepare(query).bind(...params).first<{ count: number }>();
  return result?.count || 0;
}
