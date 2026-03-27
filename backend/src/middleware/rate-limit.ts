/**
 * Generic Rate Limiting Middleware for Cloudflare Workers
 * 
 * Uses Cloudflare's built-in rate limiting via KV namespace or env.RATE_LIMITER
 * Supports per-IP and per-user rate limits with configurable windows
 * 
 * Rate limits:
 * - Public endpoints: 100 req/min per IP
 * - Authenticated endpoints: 1000 req/min per user
 * - Upload endpoints: 10 req/min per user
 * - Login: 10 req/min per IP
 * - Register: 5 req/min per IP
 */

import { Context, Next } from 'hono';
import { FrameVideosError } from '../error-handler';

export interface RateLimitConfig {
  limit: number;           // Max requests
  windowMs: number;        // Time window in milliseconds
  keyPrefix: string;       // KV key prefix (e.g., 'rl:ip:', 'rl:user:')
  message?: string;        // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;           // Unix timestamp when limit resets
  retryAfter?: number;     // Seconds to wait before retry
}

/**
 * Rate limiter class using Cloudflare KV
 */
export class KVRateLimiter {
  private config: RateLimitConfig;
  private kv: KVNamespace;

  constructor(kv: KVNamespace, config: RateLimitConfig) {
    this.kv = kv;
    this.config = config;
  }

  /**
   * Check and consume rate limit
   */
  async consume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const kvKey = `${this.config.keyPrefix}${key}`;
    
    // Get current count from KV
    const stored = await this.kv.get(kvKey, 'json') as { count: number; resetAt: number } | null;
    
    let count = 0;
    let resetAt = now + this.config.windowMs;

    if (stored) {
      // Check if window has expired
      if (stored.resetAt > now) {
        count = stored.count;
        resetAt = stored.resetAt;
      }
    }

    // Check if limit exceeded
    if (count >= this.config.limit) {
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      return {
        allowed: false,
        limit: this.config.limit,
        remaining: 0,
        reset: Math.floor(resetAt / 1000),
        retryAfter,
      };
    }

    // Increment count
    count++;
    
    // Store in KV with expiration
    const ttl = Math.ceil((resetAt - now) / 1000);
    await this.kv.put(
      kvKey,
      JSON.stringify({ count, resetAt }),
      { expirationTtl: ttl }
    );

    return {
      allowed: true,
      limit: this.config.limit,
      remaining: this.config.limit - count,
      reset: Math.floor(resetAt / 1000),
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    const kvKey = `${this.config.keyPrefix}${key}`;
    await this.kv.delete(kvKey);
  }
}

/**
 * Extract client IP from request
 */
export function getClientIP(c: Context): string {
  // Cloudflare provides the real IP in cf-connecting-ip
  const cfIp = c.req.header('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Fallback to x-forwarded-for
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  // Fallback to x-real-ip
  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp;

  return '0.0.0.0';
}

/**
 * Extract user ID from JWT token in context
 */
export function getUserId(c: Context): string | null {
  try {
    // Try to get from tenant context (set by tenantIsolation middleware)
    const tenantContext = c.get('tenantContext');
    if (tenantContext?.userId) {
      return tenantContext.userId;
    }
    
    // Fallback to user context
    const user = c.get('user');
    return user?.id || user?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Create rate limit middleware
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const kv = c.env.CACHE as KVNamespace;
    
    if (!kv) {
      console.warn('[RATE_LIMIT] KV namespace not available, skipping rate limit');
      await next();
      return;
    }

    const limiter = new KVRateLimiter(kv, config);
    
    // Determine key based on config
    let key: string;
    
    // If key prefix includes 'user', try to get user ID
    if (config.keyPrefix.includes('user')) {
      const userId = getUserId(c);
      if (!userId) {
        // No user ID, fall back to IP-based limiting
        key = getClientIP(c);
      } else {
        key = userId;
      }
    } else {
      // IP-based limiting
      key = getClientIP(c);
    }

    // Check rate limit
    const result = await limiter.consume(key);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.reset));

    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter || 60));
      
      console.warn('[RATE_LIMIT_EXCEEDED]', {
        timestamp: new Date().toISOString(),
        key,
        limit: result.limit,
        path: c.req.path,
        method: c.req.method,
      });

      return c.json({
        error: {
          message: config.message || 'Too many requests. Please try again later.',
          code: 429,
          category: 'RATE_LIMIT',
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
          retryAfter: result.retryAfter,
          timestamp: new Date().toISOString(),
        },
      }, 429);
    }

    await next();
  };
}

// ============================================================================
// Pre-configured Rate Limiters
// ============================================================================

/**
 * Public endpoints: 100 req/min per IP
 */
export const publicRateLimit = rateLimitMiddleware({
  limit: 100,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'rl:public:ip:',
  message: 'Too many requests from this IP. Please try again later.',
});

/**
 * Authenticated endpoints: 1000 req/min per user
 */
export const authenticatedRateLimit = rateLimitMiddleware({
  limit: 1000,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'rl:auth:user:',
  message: 'Too many requests. Please try again later.',
});

/**
 * Upload endpoints: 10 req/min per user
 */
export const uploadRateLimit = rateLimitMiddleware({
  limit: 10,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'rl:upload:user:',
  message: 'Too many upload requests. Please try again later.',
});

/**
 * Login endpoint: 10 req/min per IP
 */
export const loginRateLimit = rateLimitMiddleware({
  limit: 10,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'rl:login:ip:',
  message: 'Too many login attempts. Please try again later.',
});

/**
 * Register endpoint: 5 req/min per IP
 */
export const registerRateLimit = rateLimitMiddleware({
  limit: 5,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'rl:register:ip:',
  message: 'Too many registration attempts. Please try again later.',
});
