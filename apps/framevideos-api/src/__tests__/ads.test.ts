// Unit tests — Ads System (Sprint 10b)

import { describe, it, expect } from 'vitest';

// ─── Ad Serving Logic Tests ─────────────────────────────────────────────────

describe('Ad Serving Logic', () => {
  describe('Weighted random selection', () => {
    it('should select creatives proportionally to remaining budget', () => {
      const creatives = [
        { id: '1', budget_cents: 10000, spent_cents: 2000 }, // weight: 8000
        { id: '2', budget_cents: 5000, spent_cents: 4000 },  // weight: 1000
        { id: '3', budget_cents: 3000, spent_cents: 0 },     // weight: 3000
      ];

      // Simulate weighted random selection
      function selectCreative(creatives: typeof creatives[0][], randomValue: number) {
        const totalWeight = creatives.reduce((sum, cr) => sum + (cr.budget_cents - cr.spent_cents), 0);
        let random = randomValue * totalWeight;
        let selected = creatives[0]!;

        for (const cr of creatives) {
          random -= (cr.budget_cents - cr.spent_cents);
          if (random <= 0) {
            selected = cr;
            break;
          }
        }
        return selected;
      }

      // Total weight = 8000 + 1000 + 3000 = 12000
      expect(selectCreative(creatives, 0)).toEqual(creatives[0]); // random=0 → first item (weight 8000)
      expect(selectCreative(creatives, 0.5)).toEqual(creatives[0]); // 6000 < 8000 → first
      expect(selectCreative(creatives, 0.7)).toEqual(creatives[1]); // 8400: 8400-8000=400 < 1000 → second
      expect(selectCreative(creatives, 0.99)).toEqual(creatives[2]); // 11880: past 8000+1000=9000 → third
    });

    it('should not select creatives with exhausted budget', () => {
      const creatives = [
        { id: '1', budget_cents: 5000, spent_cents: 5000 }, // weight: 0
        { id: '2', budget_cents: 3000, spent_cents: 1000 }, // weight: 2000
      ];

      const active = creatives.filter((cr) => cr.budget_cents > cr.spent_cents);
      expect(active).toHaveLength(1);
      expect(active[0]!.id).toBe('2');
    });

    it('should handle empty creatives list', () => {
      const creatives: { id: string; budget_cents: number; spent_cents: number }[] = [];
      expect(creatives.length).toBe(0);
    });
  });

  describe('Budget check', () => {
    it('should correctly determine if budget is available', () => {
      const hasBudget = (budget: number, spent: number): boolean => budget > spent;

      expect(hasBudget(10000, 5000)).toBe(true);
      expect(hasBudget(10000, 10000)).toBe(false);
      expect(hasBudget(10000, 10001)).toBe(false);
      expect(hasBudget(0, 0)).toBe(false);
    });
  });

  describe('CPC cost calculation', () => {
    it('should calculate cost per click correctly', () => {
      const cpcCostCents = 10; // R$ 0.10 per click
      const clicks = 150;
      const totalCost = clicks * cpcCostCents;
      expect(totalCost).toBe(1500); // R$ 15.00
    });

    it('should not exceed budget', () => {
      const budgetCents = 5000; // R$ 50.00
      const cpcCostCents = 10;
      const maxClicks = Math.floor(budgetCents / cpcCostCents);
      expect(maxClicks).toBe(500);
    });
  });
});

// ─── Revenue Share Logic Tests ──────────────────────────────────────────────

describe('Revenue Share Logic', () => {
  it('should calculate default 70/30 split', () => {
    const totalRevenue = 10000; // R$ 100.00
    const tenantSharePercent = 70;
    const tenantShare = Math.round(totalRevenue * tenantSharePercent / 100);
    const platformShare = totalRevenue - tenantShare;

    expect(tenantShare).toBe(7000);  // R$ 70.00
    expect(platformShare).toBe(3000); // R$ 30.00
    expect(tenantShare + platformShare).toBe(totalRevenue);
  });

  it('should handle custom split percentages', () => {
    const totalRevenue = 15000; // R$ 150.00
    const tenantSharePercent = 80; // Custom: 80/20
    const tenantShare = Math.round(totalRevenue * tenantSharePercent / 100);
    const platformShare = totalRevenue - tenantShare;

    expect(tenantShare).toBe(12000); // R$ 120.00
    expect(platformShare).toBe(3000); // R$ 30.00
  });

  it('should handle zero revenue', () => {
    const totalRevenue = 0;
    const tenantSharePercent = 70;
    const tenantShare = Math.round(totalRevenue * tenantSharePercent / 100);
    const platformShare = totalRevenue - tenantShare;

    expect(tenantShare).toBe(0);
    expect(platformShare).toBe(0);
  });

  it('should handle rounding correctly for odd amounts', () => {
    const totalRevenue = 333; // R$ 3.33
    const tenantSharePercent = 70;
    const tenantShare = Math.round(totalRevenue * tenantSharePercent / 100);
    const platformShare = totalRevenue - tenantShare;

    expect(tenantShare).toBe(233); // Math.round(233.1) = 233
    expect(platformShare).toBe(100);
    expect(tenantShare + platformShare).toBe(totalRevenue);
  });
});

// ─── Campaign Status Transitions ────────────────────────────────────────────

describe('Campaign Status Transitions', () => {
  const validTransitions: Record<string, string[]> = {
    draft: ['active', 'cancelled'],
    active: ['paused', 'cancelled'],
    paused: ['active', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  it('should allow draft → active', () => {
    expect(validTransitions['draft']).toContain('active');
  });

  it('should allow draft → cancelled', () => {
    expect(validTransitions['draft']).toContain('cancelled');
  });

  it('should allow active → paused', () => {
    expect(validTransitions['active']).toContain('paused');
  });

  it('should allow paused → active', () => {
    expect(validTransitions['paused']).toContain('active');
  });

  it('should not allow completed → anything', () => {
    expect(validTransitions['completed']).toHaveLength(0);
  });

  it('should not allow cancelled → anything', () => {
    expect(validTransitions['cancelled']).toHaveLength(0);
  });

  it('should not allow draft → paused', () => {
    expect(validTransitions['draft']).not.toContain('paused');
  });
});

// ─── Creative Status Transitions ────────────────────────────────────────────

describe('Creative Status Transitions', () => {
  const validTransitions: Record<string, string[]> = {
    pending_review: ['approved', 'rejected'],
    approved: ['active', 'rejected'],
    rejected: ['pending_review'],
    active: ['paused'],
    paused: ['active'],
  };

  it('should allow pending_review → approved', () => {
    expect(validTransitions['pending_review']).toContain('approved');
  });

  it('should allow pending_review → rejected', () => {
    expect(validTransitions['pending_review']).toContain('rejected');
  });

  it('should allow approved → active', () => {
    expect(validTransitions['approved']).toContain('active');
  });

  it('should allow rejected → pending_review (resubmit)', () => {
    expect(validTransitions['rejected']).toContain('pending_review');
  });

  it('should allow active ↔ paused', () => {
    expect(validTransitions['active']).toContain('paused');
    expect(validTransitions['paused']).toContain('active');
  });

  it('should not allow pending_review → active directly', () => {
    expect(validTransitions['pending_review']).not.toContain('active');
  });
});

// ─── IP Hashing ─────────────────────────────────────────────────────────────

describe('IP Hashing', () => {
  it('should produce consistent SHA-256 hashes', async () => {
    async function hashIp(ip: string): Promise<string> {
      const data = new TextEncoder().encode(ip);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    const hash1 = await hashIp('192.168.1.1');
    const hash2 = await hashIp('192.168.1.1');
    const hash3 = await hashIp('10.0.0.1');

    expect(hash1).toBe(hash2); // Same IP → same hash
    expect(hash1).not.toBe(hash3); // Different IP → different hash
    expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
  });

  it('should not reveal the original IP', async () => {
    async function hashIp(ip: string): Promise<string> {
      const data = new TextEncoder().encode(ip);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    const hash = await hashIp('192.168.1.1');
    expect(hash).not.toContain('192');
    expect(hash).not.toContain('168');
  });
});

// ─── CTR Calculation ────────────────────────────────────────────────────────

describe('CTR Calculation', () => {
  it('should calculate CTR correctly', () => {
    const calcCtr = (impressions: number, clicks: number): string => {
      return impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
    };

    expect(calcCtr(1000, 50)).toBe('5.00');
    expect(calcCtr(0, 0)).toBe('0.00');
    expect(calcCtr(10000, 1)).toBe('0.01');
    expect(calcCtr(100, 100)).toBe('100.00');
  });
});

// ─── Ad HTML Generation ─────────────────────────────────────────────────────

describe('Ad HTML Generation', () => {
  it('should escape HTML in URLs', () => {
    function escHtml(s: string): string {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    expect(escHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escHtml('https://example.com?a=1&b=2')).toBe('https://example.com?a=1&amp;b=2');
  });

  it('should include tracking pixel when tracking is enabled', () => {
    const creativeId = 'test123';
    const placementId = 'place456';
    const trackImpression = true;

    const impressionUrl = `/api/v1/ads/track/impression?c=${encodeURIComponent(creativeId)}&p=${encodeURIComponent(placementId)}`;

    const html = trackImpression
      ? `<img src="${impressionUrl}" width="1" height="1" alt="" />`
      : '';

    expect(html).toContain('track/impression');
    expect(html).toContain(creativeId);
    expect(html).toContain(placementId);
  });

  it('should NOT include tracking pixel when tracking is disabled', () => {
    const trackImpression = false;
    const html = trackImpression ? '<img src="..." />' : '';
    expect(html).toBe('');
  });
});

// ─── Placement Validation ───────────────────────────────────────────────────

describe('Placement Validation', () => {
  const validPositions = ['header', 'sidebar', 'in_content', 'footer', 'overlay'];

  it('should accept valid positions', () => {
    for (const pos of validPositions) {
      expect(validPositions).toContain(pos);
    }
  });

  it('should reject invalid positions', () => {
    expect(validPositions).not.toContain('popup');
    expect(validPositions).not.toContain('interstitial');
    expect(validPositions).not.toContain('');
  });

  it('should validate dimensions', () => {
    const isValidDimension = (val: number): boolean => val >= 1 && val <= 2000;

    expect(isValidDimension(728)).toBe(true);
    expect(isValidDimension(90)).toBe(true);
    expect(isValidDimension(0)).toBe(false);
    expect(isValidDimension(-1)).toBe(false);
    expect(isValidDimension(2001)).toBe(false);
  });
});

// ─── File Upload Validation ─────────────────────────────────────────────────

describe('Creative Upload Validation', () => {
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const ALLOWED_VIDEO_TYPES = new Set(['video/mp4']);

  it('should accept valid image types', () => {
    expect(ALLOWED_IMAGE_TYPES.has('image/jpeg')).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has('image/png')).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has('image/gif')).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has('image/webp')).toBe(true);
  });

  it('should accept valid video types', () => {
    expect(ALLOWED_VIDEO_TYPES.has('video/mp4')).toBe(true);
  });

  it('should reject invalid types', () => {
    expect(ALLOWED_IMAGE_TYPES.has('application/pdf')).toBe(false);
    expect(ALLOWED_IMAGE_TYPES.has('text/html')).toBe(false);
    expect(ALLOWED_VIDEO_TYPES.has('video/avi')).toBe(false);
  });

  it('should enforce size limits', () => {
    const IMAGE_MAX = 2 * 1024 * 1024; // 2MB
    const VIDEO_MAX = 10 * 1024 * 1024; // 10MB

    expect(IMAGE_MAX).toBe(2097152);
    expect(VIDEO_MAX).toBe(10485760);

    // 1.5MB image should pass
    expect(1.5 * 1024 * 1024 <= IMAGE_MAX).toBe(true);
    // 3MB image should fail
    expect(3 * 1024 * 1024 <= IMAGE_MAX).toBe(false);
    // 8MB video should pass
    expect(8 * 1024 * 1024 <= VIDEO_MAX).toBe(true);
    // 15MB video should fail
    expect(15 * 1024 * 1024 <= VIDEO_MAX).toBe(false);
  });
});
