// Crawler core logic — Sprint 10
// Fetches source URLs, parses HTML with regex, extracts video links,
// deduplicates, optionally enriches with AI

import { D1Client } from '@frame-videos/db';
import { generateUlid, slugify } from '@frame-videos/shared/utils';
import type { Env } from '../env.js';
import { getBalance, debitCredits, logLlmUsage } from '../routes/credits.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CrawlSelectors {
  videoLink: string;
  title: string;
  thumbnail: string;
  duration?: string;
  /** Optional proxy URL. Use {url} as placeholder for the target URL.
   *  Examples:
   *  - ScraperAPI: https://api.scraperapi.com?api_key=KEY&url={url}
   *  - Bright Data: https://brd-customer-xxx:pass@brd.superproxy.io:22225
   *  - Generic: https://proxy.example.com/fetch?url={url}
   */
  proxyUrl?: string;
}

export interface VideoLink {
  url: string;
  title: string;
  thumbnailUrl: string;
  duration?: string;
}

export interface CrawlResult {
  runId: string;
  status: 'completed' | 'failed';
  videosFound: number;
  videosNew: number;
  videosDuplicate: number;
  errors: string[];
  startedAt: string;
  completedAt: string;
}

export interface EnrichedVideo {
  title: string;
  description: string;
  tags: string[];
}

// ─── CSS selector to regex pattern converter ─────────────────────────────────

/**
 * Convert a simple CSS selector to a regex pattern for HTML parsing.
 * Supports: tag, .class, #id, tag.class, tag[attr]
 * This is intentionally simplified — Workers don't have a full DOM parser.
 */
function selectorToPattern(selector: string): RegExp {
  // Handle common patterns
  const trimmed = selector.trim();

  // a.class-name → <a class="...class-name..."
  if (/^(\w+)\.([a-zA-Z0-9_-]+)$/.test(trimmed)) {
    const [, tag, className] = trimmed.match(/^(\w+)\.([a-zA-Z0-9_-]+)$/)!;
    return new RegExp(`<${tag}[^>]*class="[^"]*${escapeRegex(className)}[^"]*"[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  }

  // .class-name → any tag with that class
  if (/^\.([a-zA-Z0-9_-]+)$/.test(trimmed)) {
    const [, className] = trimmed.match(/^\.([a-zA-Z0-9_-]+)$/)!;
    return new RegExp(`<[a-z][a-z0-9]*[^>]*class="[^"]*${escapeRegex(className)}[^"]*"[^>]*>([\\s\\S]*?)<\\/[a-z][a-z0-9]*>`, 'gi');
  }

  // #id → any tag with that id
  if (/^#([a-zA-Z0-9_-]+)$/.test(trimmed)) {
    const [, id] = trimmed.match(/^#([a-zA-Z0-9_-]+)$/)!;
    return new RegExp(`<[a-z][a-z0-9]*[^>]*id="${escapeRegex(id)}"[^>]*>([\\s\\S]*?)<\\/[a-z][a-z0-9]*>`, 'gi');
  }

  // tag[attr="value"] → specific attribute
  if (/^(\w+)\[(\w+)="([^"]+)"\]$/.test(trimmed)) {
    const [, tag, attr, value] = trimmed.match(/^(\w+)\[(\w+)="([^"]+)"\]$/)!;
    return new RegExp(`<${tag}[^>]*${escapeRegex(attr)}="${escapeRegex(value)}"[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  }

  // Simple tag → <tag>...</tag>
  if (/^\w+$/.test(trimmed)) {
    return new RegExp(`<${trimmed}[^>]*>([\\s\\S]*?)<\\/${trimmed}>`, 'gi');
  }

  // Fallback: treat as literal text match
  return new RegExp(escapeRegex(trimmed), 'gi');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── HTML parsing helpers ────────────────────────────────────────────────────

/**
 * Extract href values from anchor tags in HTML.
 */
function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const regex = /<a[^>]*href="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    hrefs.push(match[1]!);
  }
  return hrefs;
}

/**
 * Extract text content from HTML (strip tags).
 */
function extractText(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * Extract src from img tags.
 */
function extractImgSrc(html: string): string | null {
  // Prefer data-src (lazy-loaded images) over src (often a placeholder)
  const dataSrcMatch = html.match(/<img[^>]*data-src="([^"]+)"[^>]*>/i);
  if (dataSrcMatch) return dataSrcMatch[1]!;
  // Fallback to regular src
  const srcMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
  if (srcMatch && !srcMatch[1]!.includes('blank.gif') && !srcMatch[1]!.includes('placeholder')) {
    return srcMatch[1]!;
  }
  return null;
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

// ─── Core functions ─────────────────────────────────────────────────────────

/**
 * Parse video links from HTML using configured selectors.
 */
export function parseVideoLinks(html: string, selectors: CrawlSelectors, baseUrl: string): VideoLink[] {
  const videos: VideoLink[] = [];
  const seen = new Set<string>();

  console.log(`[crawler] parseVideoLinks: html=${html.length} bytes, baseUrl=${baseUrl}, selectors=${JSON.stringify(selectors)}`);

  // Strategy 1: Split HTML into blocks using the container selector
  // For nested elements (like div.thumb-block containing sub-divs),
  // regex-based matching fails. Instead, split by the opening tag.
  const linkSelector = selectors.videoLink.trim();
  const classMatch = linkSelector.match(/^(\w+)\.([a-zA-Z0-9_-]+)$/);

  let blocks: string[] = [];

  if (classMatch) {
    const [, tag, className] = classMatch;
    // Split by opening tags of this class, then each segment is one block
    const splitter = new RegExp(`<${tag}[^>]*class="[^"]*${escapeRegex(className!)}[^"]*"[^>]*>`, 'gi');
    const parts = html.split(splitter);
    // Skip the first part (before the first match)
    blocks = parts.slice(1);
    console.log(`[crawler] Split into ${blocks.length} blocks by ${linkSelector}`);
  } else {
    // Fallback: use regex matching (works for simple selectors)
    const linkPattern = selectorToPattern(linkSelector);
    for (const match of html.matchAll(linkPattern)) {
      blocks.push(match[0]);
    }
  }

  for (const block of blocks) {
    // Extract all hrefs from this block
    const hrefs = extractHrefs(block);
    const videoHref = hrefs.find((h) => /\/video[./]/.test(h));
    if (!videoHref) continue;

    const url = resolveUrl(videoHref, baseUrl);
    if (seen.has(url)) continue;
    seen.add(url);

    // Extract title: prefer title attribute on links, then text content
    let title = '';
    const titleAttrMatch = block.match(/<a[^>]*title="([^"]+)"[^>]*>/i);
    if (titleAttrMatch) {
      title = titleAttrMatch[1]!;
    } else {
      const titlePattern = selectorToPattern(selectors.title);
      const titleMatch = block.match(titlePattern);
      title = titleMatch ? extractText(titleMatch[0]) : '';
    }

    // Extract thumbnail (prefer data-src for lazy-loaded images)
    const thumbnailUrl = extractImgSrc(block) ?? '';

    // Extract duration
    let duration: string | undefined;
    if (selectors.duration) {
      const durationPattern = selectorToPattern(selectors.duration);
      const durationMatch = block.match(durationPattern);
      duration = durationMatch ? extractText(durationMatch[0]) : undefined;
    }

    if (url && title) {
      videos.push({
        url: resolveUrl(url, baseUrl),
        title: title.slice(0, 500),
        thumbnailUrl: thumbnailUrl ? resolveUrl(thumbnailUrl, baseUrl) : '',
        duration,
      });
    }
  }

  console.log(`[crawler] Strategy 1: ${blocks.length} blocks, ${videos.length} videos extracted`);

  // Strategy 2: Fallback — extract all links with href containing video-like patterns
  if (videos.length === 0) {
    const allHrefs = extractHrefs(html);
    console.log(`[crawler] Strategy 2 fallback: ${allHrefs.length} total hrefs found`);
    const videoPatterns = [/\/video\//i, /\/video\./i, /\/watch/i, /\/v\//i, /\/embed\//i];

    for (const href of allHrefs) {
      if (videoPatterns.some((p) => p.test(href))) {
        const url = resolveUrl(href, baseUrl);
        if (seen.has(url)) continue;
        seen.add(url);

        videos.push({
          url,
          title: '',
          thumbnailUrl: '',
        });
      }
    }
  }

  return videos;
}

/**
 * Check which video links are new vs duplicates.
 */
export async function deduplicateVideos(
  links: VideoLink[],
  tenantId: string,
  db: D1Client,
): Promise<{ new: VideoLink[]; duplicate: VideoLink[] }> {
  const newVideos: VideoLink[] = [];
  const duplicateVideos: VideoLink[] = [];

  // Check in batches to avoid too many queries
  for (const link of links) {
    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM videos WHERE tenant_id = ? AND source_url = ?',
      [tenantId, link.url],
    );

    if (existing) {
      duplicateVideos.push(link);
    } else {
      newVideos.push(link);
    }
  }

  return { new: newVideos, duplicate: duplicateVideos };
}

/**
 * Enrich a video with AI-generated SEO content.
 * Uses LLM credits from the tenant's wallet.
 */
export async function enrichWithAI(
  video: VideoLink,
  tenantId: string,
  env: Env,
): Promise<EnrichedVideo> {
  const db = new D1Client(env.DB);
  const balance = await getBalance(db, tenantId);

  // Need at least 7 credits (title: 2 + description: 3 + keywords: 2)
  if (balance < 7) {
    return {
      title: video.title,
      description: '',
      tags: [],
    };
  }

  try {
    const llmConfig = {
      provider: env.LLM_PROVIDER,
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
    };

    // Generate SEO title
    const titlePrompt = `Generate a short, SEO-optimized title for this video: "${video.title}". Return only the title, no quotes, no explanation. Max 100 characters.`;
    const titleResponse = await callLlmSimple(titlePrompt, llmConfig);
    await debitCredits(db, tenantId, 2, 'generate_title');
    await logLlmUsage(db, tenantId, 'generate_title', llmConfig.model, titlePrompt.length, titleResponse.length, 2);

    // Generate description
    const descPrompt = `Write a brief SEO description (2-3 sentences) for this video titled: "${titleResponse || video.title}". Return only the description.`;
    const descResponse = await callLlmSimple(descPrompt, llmConfig);
    await debitCredits(db, tenantId, 3, 'generate_description');
    await logLlmUsage(db, tenantId, 'generate_description', llmConfig.model, descPrompt.length, descResponse.length, 3);

    // Generate tags
    const tagsPrompt = `Generate 5-10 relevant tags for this video titled: "${titleResponse || video.title}". Return as comma-separated list, no hashtags.`;
    const tagsResponse = await callLlmSimple(tagsPrompt, llmConfig);
    await debitCredits(db, tenantId, 2, 'generate_keywords');
    await logLlmUsage(db, tenantId, 'generate_keywords', llmConfig.model, tagsPrompt.length, tagsResponse.length, 2);

    const tags = tagsResponse
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length < 50);

    return {
      title: (titleResponse || video.title).slice(0, 500),
      description: descResponse.slice(0, 5000),
      tags,
    };
  } catch (error) {
    // AI enrichment failed — return original data
    console.error('[crawler] AI enrichment failed:', error);
    return {
      title: video.title,
      description: '',
      tags: [],
    };
  }
}

/**
 * Simple LLM call helper (avoids importing full LLM package).
 */
async function callLlmSimple(
  prompt: string,
  config: { provider: string; apiKey: string; model: string },
): Promise<string> {
  // Use OpenAI-compatible API
  const baseUrl = config.provider === 'openai'
    ? 'https://api.openai.com/v1'
    : config.provider === 'anthropic'
    ? 'https://api.anthropic.com/v1'
    : 'https://api.openai.com/v1';

  if (config.provider === 'anthropic') {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content?.[0]?.text ?? '';
  }

  // OpenAI-compatible
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Parse duration string to seconds.
 * Handles formats: "12:34", "1:23:45", "12min", "5m30s"
 */
function parseDuration(durationStr: string | undefined): number | null {
  if (!durationStr) return null;
  const trimmed = durationStr.trim();

  // HH:MM:SS or MM:SS
  const colonMatch = trimmed.match(/^(?:(\d+):)?(\d+):(\d+)$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1] ?? '0', 10);
    const minutes = parseInt(colonMatch[2]!, 10);
    const seconds = parseInt(colonMatch[3]!, 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // "5m30s" or "12min"
  const minsMatch = trimmed.match(/(\d+)\s*m(?:in)?/i);
  const secsMatch = trimmed.match(/(\d+)\s*s(?:ec)?/i);
  if (minsMatch || secsMatch) {
    const mins = parseInt(minsMatch?.[1] ?? '0', 10);
    const secs = parseInt(secsMatch?.[1] ?? '0', 10);
    return mins * 60 + secs;
  }

  return null;
}

// ─── Main execution function ────────────────────────────────────────────────

/**
 * Execute a crawl for a given source.
 * 1. Fetch source URL
 * 2. Parse HTML with regex
 * 3. Extract video links
 * 4. Deduplicate
 * 5. Create new video records (draft status)
 * 6. Optionally enrich with AI
 * 7. Record run history
 */
export async function executeCrawl(
  sourceId: string,
  tenantId: string,
  env: Env,
): Promise<CrawlResult> {
  const db = new D1Client(env.DB);
  const runId = generateUlid();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  // Create run record
  await db.execute(
    `INSERT INTO crawler_runs (id, source_id, tenant_id, status, started_at)
     VALUES (?, ?, ?, 'running', ?)`,
    [runId, sourceId, tenantId, startedAt],
  );

  try {
    // Get source config
    const source = await db.queryOne<{
      base_url: string; config_json: string; name: string;
    }>(
      'SELECT base_url, config_json, name FROM crawler_sources WHERE id = ? AND tenant_id = ?',
      [sourceId, tenantId],
    );

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    const selectors: CrawlSelectors = JSON.parse(source.config_json);

    // Resolve proxy: platform_config (global) > selectors.proxyUrl (per-source) > none
    let resolvedProxyUrl = selectors.proxyUrl || '';
    try {
      const proxyEnabled = await db.queryOne<{ value: string }>(
        "SELECT value FROM platform_config WHERE key = 'crawler_proxy_enabled'", [],
      );
      if (proxyEnabled?.value === 'true') {
        const proxyUrlRow = await db.queryOne<{ value: string }>(
          "SELECT value FROM platform_config WHERE key = 'crawler_proxy_url'", [],
        );
        if (proxyUrlRow?.value) {
          resolvedProxyUrl = proxyUrlRow.value;
        }
      }
    } catch {
      // platform_config table might not exist yet — ignore
    }

    // Fetch source URL (with optional proxy support)
    let html: string;
    try {
      let fetchUrl = source.base_url;
      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      };

      // If proxy is configured (global or per-source), route through it
      if (resolvedProxyUrl) {
        const encodedTarget = encodeURIComponent(source.base_url);
        fetchUrl = resolvedProxyUrl.replace('{url}', encodedTarget);
        console.log(`[crawler] Using proxy: ${resolvedProxyUrl.split('?')[0]}...`);
      }

      const response = await fetch(fetchUrl, {
        headers: fetchHeaders,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      html = await response.text();
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : 'Fetch failed';
      errors.push(`Failed to fetch ${source.base_url}: ${msg}`);
      throw new Error(`Fetch failed: ${msg}`);
    }

    console.log(`[crawler] Fetched ${html.length} bytes from ${source.base_url}`);

    // Parse video links
    const videoLinks = parseVideoLinks(html, selectors, source.base_url);

    // Deduplicate
    const { new: newVideos, duplicate: duplicateVideos } = await deduplicateVideos(videoLinks, tenantId, db);

    // Get tenant locale
    const tenant = await db.queryOne<{ default_locale: string }>(
      'SELECT default_locale FROM tenants WHERE id = ?',
      [tenantId],
    );
    const locale = tenant?.default_locale ?? 'pt_BR';

    // Check if AI enrichment is available
    const balance = await getBalance(db, tenantId);
    const canEnrich = balance >= 7 && env.LLM_API_KEY;

    // Create new video records
    for (const video of newVideos) {
      try {
        const videoId = generateUlid();
        const translationId = generateUlid();

        // Optionally enrich with AI
        let enriched: EnrichedVideo | null = null;
        if (canEnrich && video.title) {
          try {
            enriched = await enrichWithAI(video, tenantId, env);
          } catch (aiError) {
            const msg = aiError instanceof Error ? aiError.message : 'AI enrichment failed';
            errors.push(`AI enrichment failed for ${video.url}: ${msg}`);
          }
        }

        const title = enriched?.title || video.title || `Video ${videoId.slice(0, 8)}`;
        const description = enriched?.description || '';
        const rawSlug = slugify(title);
        let slug = rawSlug || `video-${videoId.slice(0, 8).toLowerCase()}`;

        // Ensure slug uniqueness within tenant
        const existingSlug = await db.queryOne<{ id: string }>(
          'SELECT id FROM videos WHERE tenant_id = ? AND slug = ?',
          [tenantId, slug],
        );
        if (existingSlug) {
          slug = `${slug}-${videoId.slice(0, 6).toLowerCase()}`;
        }
        const durationSeconds = parseDuration(video.duration);

        // Generate embed_url and video_url from source URL
        let embedUrl: string | null = null;
        let videoUrl: string | null = null;
        const xvMatch = video.url.match(/xvideos\.com\/video\.([a-z0-9]+)/i);
        if (xvMatch) {
          embedUrl = `https://www.xvideos.com/embedframe/${xvMatch[1]}`;
          videoUrl = video.url;
        }

        await db.batch([
          {
            sql: `INSERT INTO videos (id, tenant_id, slug, status, thumbnail_url, source_url, duration_seconds, embed_url, video_url)
                  VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?)`,
            params: [videoId, tenantId, slug, video.thumbnailUrl || null, video.url, durationSeconds, embedUrl, videoUrl],
          },
          {
            sql: `INSERT INTO video_translations (id, video_id, locale, title, description)
                  VALUES (?, ?, ?, ?, ?)`,
            params: [translationId, videoId, locale, title, description],
          },
        ]);

        // Create tags from AI enrichment
        if (enriched?.tags && enriched.tags.length > 0) {
          const tagQueries: Array<{ sql: string; params?: unknown[] }> = [];
          for (const tagName of enriched.tags.slice(0, 10)) {
            const tagId = generateUlid();
            const tagSlug = slugify(tagName) || `tag-${tagId.slice(0, 8).toLowerCase()}`;
            tagQueries.push(
              {
                sql: 'INSERT OR IGNORE INTO tags (id, tenant_id, slug) VALUES (?, ?, ?)',
                params: [tagId, tenantId, tagSlug],
              },
              {
                sql: 'INSERT OR IGNORE INTO tag_translations (id, tag_id, locale, name) VALUES (?, ?, ?, ?)',
                params: [generateUlid(), tagId, locale, tagName],
              },
              {
                sql: `INSERT OR IGNORE INTO video_tags (video_id, tag_id)
                      SELECT ?, id FROM tags WHERE tenant_id = ? AND slug = ?`,
                params: [videoId, tenantId, tagSlug],
              },
            );
          }
          if (tagQueries.length > 0) {
            await db.batch(tagQueries);
          }
        }
      } catch (videoError) {
        const msg = videoError instanceof Error ? videoError.message : 'Unknown error';
        errors.push(`Failed to create video from ${video.url}: ${msg}`);
      }
    }

    const completedAt = new Date().toISOString();

    // Update run record
    await db.execute(
      `UPDATE crawler_runs
       SET status = 'completed', videos_found = ?, videos_imported = ?,
           errors_count = ?, log_json = ?, completed_at = ?
       WHERE id = ?`,
      [
        videoLinks.length,
        newVideos.length,
        errors.length,
        JSON.stringify(errors),
        completedAt,
        runId,
      ],
    );

    // Update source last_run_at
    await db.execute(
      "UPDATE crawler_sources SET last_run_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      [sourceId],
    );

    return {
      runId,
      status: 'completed',
      videosFound: videoLinks.length,
      videosNew: newVideos.length,
      videosDuplicate: duplicateVideos.length,
      errors,
      startedAt,
      completedAt,
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);

    // Update run as failed
    await db.execute(
      `UPDATE crawler_runs
       SET status = 'failed', errors_count = ?, log_json = ?, completed_at = ?
       WHERE id = ?`,
      [errors.length, JSON.stringify(errors), completedAt, runId],
    );

    return {
      runId,
      status: 'failed',
      videosFound: 0,
      videosNew: 0,
      videosDuplicate: 0,
      errors,
      startedAt,
      completedAt,
    };
  }
}
