/**
 * Account Lockout System (D1-backed)
 * Tracks failed login attempts per user account and locks accounts after threshold
 * 
 * Config: Max 10 failures in 30 minutes = locks account for 1 hour
 * Response: HTTP 423 (Locked) with unlock time
 */

export interface LockoutConfig {
  maxFailedAttempts: number;   // Max failed attempts before lockout
  lockoutDurationMs: number;   // How long to lock account
  resetWindowMs: number;       // Time window for counting failures
}

export interface LockoutResult {
  locked: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  lockedUntil: string | null;
  timeUntilUnlockMs: number;
}

// Default config: 10 failures in 30 min = 1 hour lockout
export const DEFAULT_LOCKOUT_CONFIG: LockoutConfig = {
  maxFailedAttempts: 10,
  lockoutDurationMs: 60 * 60 * 1000,  // 1 hour
  resetWindowMs: 30 * 60 * 1000,       // 30 minutes
};

/**
 * D1-backed Account Lockout
 */
export class D1AccountLockout {
  private config: LockoutConfig;

  constructor(config: LockoutConfig = DEFAULT_LOCKOUT_CONFIG) {
    this.config = config;
  }

  /**
   * Check if an account is locked
   */
  async isLocked(db: any, userId: string): Promise<LockoutResult> {
    const now = new Date();

    const lockout = await db
      .prepare(`
        SELECT * FROM account_lockouts 
        WHERE user_id = ? 
        ORDER BY updated_at DESC LIMIT 1
      `)
      .bind(userId)
      .first();

    if (!lockout) {
      return {
        locked: false,
        failedAttempts: 0,
        remainingAttempts: this.config.maxFailedAttempts,
        lockedUntil: null,
        timeUntilUnlockMs: 0,
      };
    }

    // Check if currently locked
    if (lockout.locked_until && new Date(lockout.locked_until) > now) {
      const timeUntilUnlockMs = new Date(lockout.locked_until).getTime() - now.getTime();
      return {
        locked: true,
        failedAttempts: lockout.failed_attempts,
        remainingAttempts: 0,
        lockedUntil: lockout.locked_until,
        timeUntilUnlockMs: Math.max(0, timeUntilUnlockMs),
      };
    }

    // Check if reset window has expired (reset counter)
    const lastFailed = new Date(lockout.last_failed_at);
    if (now.getTime() - lastFailed.getTime() > this.config.resetWindowMs) {
      // Window expired, reset
      await this.reset(db, userId);
      return {
        locked: false,
        failedAttempts: 0,
        remainingAttempts: this.config.maxFailedAttempts,
        lockedUntil: null,
        timeUntilUnlockMs: 0,
      };
    }

    // If lockout expired, reset
    if (lockout.locked_until && new Date(lockout.locked_until) <= now) {
      await this.reset(db, userId);
      return {
        locked: false,
        failedAttempts: 0,
        remainingAttempts: this.config.maxFailedAttempts,
        lockedUntil: null,
        timeUntilUnlockMs: 0,
      };
    }

    return {
      locked: false,
      failedAttempts: lockout.failed_attempts,
      remainingAttempts: Math.max(0, this.config.maxFailedAttempts - lockout.failed_attempts),
      lockedUntil: null,
      timeUntilUnlockMs: 0,
    };
  }

  /**
   * Record a failed login attempt for an account
   */
  async recordFailedAttempt(db: any, userId: string, email: string): Promise<LockoutResult> {
    const now = new Date();
    const nowStr = now.toISOString();

    // Get current lockout entry
    const existing = await db
      .prepare(`
        SELECT * FROM account_lockouts 
        WHERE user_id = ? 
        ORDER BY updated_at DESC LIMIT 1
      `)
      .bind(userId)
      .first();

    if (!existing) {
      // Create new entry
      const id = crypto.randomUUID();
      await db
        .prepare(`
          INSERT INTO account_lockouts (id, user_id, email, failed_attempts, first_failed_at, last_failed_at, locked_until, created_at, updated_at)
          VALUES (?, ?, ?, 1, ?, ?, NULL, ?, ?)
        `)
        .bind(id, userId, email, nowStr, nowStr, nowStr, nowStr)
        .run();

      return {
        locked: false,
        failedAttempts: 1,
        remainingAttempts: this.config.maxFailedAttempts - 1,
        lockedUntil: null,
        timeUntilUnlockMs: 0,
      };
    }

    // Check if reset window expired
    const lastFailed = new Date(existing.last_failed_at);
    if (now.getTime() - lastFailed.getTime() > this.config.resetWindowMs) {
      // Reset and start fresh
      await db
        .prepare(`
          UPDATE account_lockouts 
          SET failed_attempts = 1, first_failed_at = ?, last_failed_at = ?, locked_until = NULL, updated_at = ?
          WHERE id = ?
        `)
        .bind(nowStr, nowStr, nowStr, existing.id)
        .run();

      return {
        locked: false,
        failedAttempts: 1,
        remainingAttempts: this.config.maxFailedAttempts - 1,
        lockedUntil: null,
        timeUntilUnlockMs: 0,
      };
    }

    // Increment failed attempts
    const newAttempts = existing.failed_attempts + 1;
    let lockedUntil: string | null = null;

    if (newAttempts >= this.config.maxFailedAttempts) {
      lockedUntil = new Date(now.getTime() + this.config.lockoutDurationMs).toISOString();
    }

    await db
      .prepare(`
        UPDATE account_lockouts 
        SET failed_attempts = ?, last_failed_at = ?, locked_until = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(newAttempts, nowStr, lockedUntil, nowStr, existing.id)
      .run();

    if (lockedUntil) {
      return {
        locked: true,
        failedAttempts: newAttempts,
        remainingAttempts: 0,
        lockedUntil,
        timeUntilUnlockMs: this.config.lockoutDurationMs,
      };
    }

    return {
      locked: false,
      failedAttempts: newAttempts,
      remainingAttempts: Math.max(0, this.config.maxFailedAttempts - newAttempts),
      lockedUntil: null,
      timeUntilUnlockMs: 0,
    };
  }

  /**
   * Reset lockout for account (e.g., after successful login)
   */
  async reset(db: any, userId: string): Promise<void> {
    await db
      .prepare('DELETE FROM account_lockouts WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  /**
   * Clean up expired lockouts
   */
  async cleanup(db: any): Promise<void> {
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db
      .prepare(`
        DELETE FROM account_lockouts 
        WHERE (locked_until IS NOT NULL AND locked_until < ?) 
        OR (locked_until IS NULL AND last_failed_at < ?)
      `)
      .bind(now, cutoff)
      .run();
  }
}

// Export singleton instance
export const accountLockout = new D1AccountLockout(DEFAULT_LOCKOUT_CONFIG);
