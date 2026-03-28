// Rate limiting middleware — KV-based sliding window
// Uses Cloudflare KV with TTL for distributed rate limiting

import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../env.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds (default: 60) */
  windowSeconds?: number;
  /** Function to extract the identifier (IP, tenantId, etc.) */
  keyGenerator: (c: Parameters<MiddlewareHandler<AppContext>>[0]) => string;
  /** Prefix for the KV key (e.g. endpoint name) */
  prefix: string;
}

// ─── Middleware ──────────────────────────────────────────────────────────────

/**
 * Rate limiter based on Cloudflare KV with TTL.
 * Uses a sliding window approach with minute buckets.
 *
 * Key format: rl:{identifier}:{prefix}:{minute_bucket}
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler<AppContext> {
  const { limit, windowSeconds = 60, keyGenerator, prefix } = config;

  return async (c, next) => {
    const kv = c.env.CACHE;
    const identifier = keyGenerator(c);
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / windowSeconds);
    const key = `rl:${identifier}:${prefix}:${bucket}`;

    // Get current count
    const current = await kv.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) {
      // Calculate seconds until window resets
      const windowEnd = (bucket + 1) * windowSeconds;
      const retryAfter = Math.max(1, windowEnd - now);

      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests. Limit: ${limit} per ${windowSeconds}s.`,
            requestId: c.get('requestId') ?? null,
            retryAfter,
          },
        },
        429,
        {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(windowEnd),
        },
      );
    }

    // Increment counter with TTL (window + buffer)
    const ttl = windowSeconds + 10;
    await kv.put(key, String(count + 1), { expirationTtl: ttl });

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - count - 1)));
    c.header('X-RateLimit-Reset', String((bucket + 1) * windowSeconds));

    await next();
  };
}

// ─── Pre-configured rate limiters ────────────────────────────────────────────

/** Extract client IP from Cloudflare headers */
function getClientIp(c: Parameters<MiddlewareHandler<AppContext>>[0]): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/** POST /auth/login — 5/min per IP */
export const loginRateLimit = rateLimit({
  limit: 5,
  windowSeconds: 60,
  prefix: 'auth:login',
  keyGenerator: getClientIp,
});

/** POST /auth/signup — 3/min per IP */
export const signupRateLimit = rateLimit({
  limit: 3,
  windowSeconds: 60,
  prefix: 'auth:signup',
  keyGenerator: getClientIp,
});

/** POST /track — 60/min per IP */
export const trackRateLimit = rateLimit({
  limit: 60,
  windowSeconds: 60,
  prefix: 'analytics:track',
  keyGenerator: getClientIp,
});

/** POST /newsletter/subscribe — 3/min per IP */
export const subscribeRateLimit = rateLimit({
  limit: 3,
  windowSeconds: 60,
  prefix: 'newsletter:subscribe',
  keyGenerator: getClientIp,
});

/** Authenticated endpoints — 100/min per tenant */
export const authenticatedRateLimit = rateLimit({
  limit: 100,
  windowSeconds: 60,
  prefix: 'authenticated',
  keyGenerator: (c) => c.get('tenantId') ?? getClientIp(c),
});
