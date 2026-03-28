// Tenant Site — Ad slot helpers
// Generates inline ad slot HTML for embedding in pages

import { esc } from './html.js';

export interface AdSlotOptions {
  placementId: string;
  tenantId: string;
  apiBaseUrl: string;
  width: number;
  height: number;
  position: 'header' | 'sidebar' | 'in_content' | 'footer' | 'overlay';
}

/**
 * Generates an ad slot iframe HTML.
 * The iframe loads the ad serve endpoint which returns the creative HTML.
 */
export function renderAdSlot(opts: AdSlotOptions): string {
  const serveUrl = `${opts.apiBaseUrl}/api/v1/ads/serve?placement=${encodeURIComponent(opts.placementId)}&tenant=${encodeURIComponent(opts.tenantId)}`;

  return `<div class="ad-slot ad-slot-${esc(opts.position)}" data-placement="${esc(opts.placementId)}" style="text-align:center;overflow:hidden;">
  <iframe src="${esc(serveUrl)}"
    width="${opts.width}" height="${opts.height}" frameborder="0" scrolling="no" loading="lazy"
    sandbox="allow-popups allow-popups-to-escape-sandbox"
    style="max-width:100%;border:none;overflow:hidden;display:block;margin:0 auto;"></iframe>
</div>`;
}

/**
 * Generates a sidebar ad slot (300x250).
 */
export function renderSidebarAd(placementId: string, tenantId: string, apiBaseUrl: string): string {
  return renderAdSlot({
    placementId,
    tenantId,
    apiBaseUrl,
    width: 300,
    height: 250,
    position: 'sidebar',
  });
}

/**
 * Generates an in-content ad slot (468x60).
 */
export function renderInContentAd(placementId: string, tenantId: string, apiBaseUrl: string): string {
  return renderAdSlot({
    placementId,
    tenantId,
    apiBaseUrl,
    width: 468,
    height: 60,
    position: 'in_content',
  });
}

export interface TenantAdPlacements {
  header?: { id: string; width: number; height: number };
  sidebar?: { id: string; width: number; height: number };
  inContent?: { id: string; width: number; height: number };
  footer?: { id: string; width: number; height: number };
}

/**
 * Fetches active ad placements for a tenant from D1.
 */
export async function getActivePlacements(db: D1Database, tenantId: string): Promise<TenantAdPlacements> {
  const results = await db.prepare(
    "SELECT id, position, width, height FROM ad_placements WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at ASC"
  ).bind(tenantId).all<{ id: string; position: string; width: number; height: number }>();

  const placements: TenantAdPlacements = {};

  for (const row of results.results) {
    const entry = { id: row.id, width: row.width, height: row.height };
    switch (row.position) {
      case 'header':
        if (!placements.header) placements.header = entry;
        break;
      case 'sidebar':
        if (!placements.sidebar) placements.sidebar = entry;
        break;
      case 'in_content':
        if (!placements.inContent) placements.inContent = entry;
        break;
      case 'footer':
        if (!placements.footer) placements.footer = entry;
        break;
    }
  }

  return placements;
}
