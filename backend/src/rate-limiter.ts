/**
 * Rate Limiter for authentication endpoints (D1-backed)
 * Prevents brute force attacks by limiting login attempts per IP
 * 
 * Config: Max 5 failures in 15 minutes = blocks IP for 30 minutes
 * Response: HTTP 429 with Retry-After header
 */

export interface RateLimitConfig {
  maxAttempts: number;      // Max failed attempts before block
  windowMs: number;         // Time window for counting attempts
  blockDurationMs: number;  // How long to block after exceeding limit
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
  totalAttempts: number;
}

// Default config: 5 attempts per 15 min, 30 min block
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,       // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes
};

/**
 * D1-backed Rate Limiter
 * Persists rate limit data in Cloudflare D1 database
 */
export class D1RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {
    this.config = config;
  }

  /**
   * Extract client IP from request
   */
  static getClientIP(request: Request, headers?: Record<string, string>): string {
    // Check X-Forwarded-For first (behind proxy/CDN)
    const forwarded = headers?.['x-forwarded-for'] || request.headers?.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    // Check X-Real-IP
    const realIp = headers?.['x-real-ip'] || request.headers?.get('x-real-ip');
    if (realIp) {
      return realIp.trim();
    }

    // Check CF-Connecting-IP (Cloudflare)
    const cfIp = headers?.['cf-connecting-ip'] || request.headers?.get('cf-connecting-ip');
    if (cfIp) {
      return cfIp.trim();
    }

    return '0.0.0.0';
  }

  /**
   * Check if an IP is rate limited and record attempt if not
   */
  async checkRateLimit(db: any, ipAddress: string): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs).toISOString();

    // Check if IP is currently blocked
    const blocked = await db
      .prepare(`
        SELECT blocked_until FROM login_attempts 
        WHERE ip_address = ? AND blocked_until IS NOT NULL AND blocked_until > ?
        ORDER BY attempted_at DESC LIMIT 1
      `)
      .bind(ipAddress, now.toISOString())
      .first();

    if (blocked?.blocked_until) {
      const retryAfterMs = new Date(blocked.blocked_until).getTime() - now.getTime();
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: Math.max(0, retryAfterMs),
        totalAttempts: this.config.maxAttempts,
      };
    }

    // Count failed attempts in the window
    const countResult = await db
      .prepare(`
        SELECT COUNT(*) as count FROM login_attempts 
        WHERE ip_address = ? AND attempted_at > ? AND success = 0
      `)
      .bind(ipAddress, windowStart)
      .first();

    const failedAttempts = countResult?.count || 0;

    if (failedAttempts >= this.config.maxAttempts) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: this.config.blockDurationMs,
        totalAttempts: failedAttempts,
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.config.maxAttempts - failedAttempts,
      retryAfterMs: 0,
      totalAttempts: failedAttempts,
    };
  }

  /**
   * Record a login attempt (success or failure)
   */
  async recordAttempt(
    db: any,
    ipAddress: string,
    email: string,
    success: boolean,
    userAgent?: string
  ): Promise<void> {
    const now = new Date();
    const id = crypto.randomUUID();
    const windowStart = new Date(now.getTime() - this.config.windowMs).toISOString();

    // If failure, check if we need to block
    let blockedUntil: string | null = null;
    if (!success) {
      const countResult = await db
        .prepare(`
          SELECT COUNT(*) as count FROM login_attempts 
          WHERE ip_address = ? AND attempted_at > ? AND success = 0
        `)
        .bind(ipAddress, windowStart)
        .first();

      const failedAttempts = (countResult?.count || 0) + 1; // +1 for current attempt

      if (failedAttempts >= this.config.maxAttempts) {
        blockedUntil = new Date(now.getTime() + this.config.blockDurationMs).toISOString();
      }
    }

    await db
      .prepare(`
        INSERT INTO login_attempts (id, ip_address, email, attempted_at, success, user_agent, blocked_until)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(id, ipAddress, email, now.toISOString(), success ? 1 : 0, userAgent || null, blockedUntil)
      .run();
  }

  /**
   * Reset rate limit for IP (e.g., after successful login)
   */
  async resetForIP(db: any, ipAddress: string): Promise<void> {
    await db
      .prepare(`
        UPDATE login_attempts SET blocked_until = NULL 
        WHERE ip_address = ? AND blocked_until IS NOT NULL
      `)
      .bind(ipAddress)
      .run();
  }

  /**
   * Clean up old entries (older than 24 hours)
   */
  async cleanup(db: any): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db
      .prepare('DELETE FROM login_attempts WHERE attempted_at < ? AND (blocked_until IS NULL OR blocked_until < ?)')
      .bind(cutoff, new Date().toISOString())
      .run();
  }
}

// Export singleton instance
export const rateLimiter = new D1RateLimiter(DEFAULT_RATE_LIMIT_CONFIG);
