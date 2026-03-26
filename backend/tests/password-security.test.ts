import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validatePasswordStrength } from '../src/auth';
import { D1RateLimiter, DEFAULT_RATE_LIMIT_CONFIG } from '../src/rate-limiter';
import { D1AccountLockout, DEFAULT_LOCKOUT_CONFIG } from '../src/account-lockout';
import { logSecurityEvent, SecurityEventType } from '../src/security-audit';

function createMockDB() {
  const store: Record<string, any[]> = {
    login_attempts: [],
    account_lockouts: [],
    security_audit_log: [],
  };
  const mockDB = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: any[]) => ({
        first: vi.fn(async () => {
          if (sql.includes('FROM account_lockouts') && sql.includes('WHERE user_id')) {
            const recs = store.account_lockouts.filter(r => r.user_id === args[0]);
            return recs.length > 0 ? recs[recs.length - 1] : null;
          }
          if (sql.includes('FROM login_attempts') && sql.includes('blocked_until')) {
            return store.login_attempts.find(
              r => r.ip_address === args[0] && r.blocked_until && r.blocked_until > args[1]
            ) || null;
          }
          if (sql.includes('COUNT(*)') && sql.includes('login_attempts')) {
            const count = store.login_attempts.filter(
              r => r.ip_address === args[0] && r.success === 0 && r.attempted_at > args[1]
            ).length;
            return { count };
          }
          return null;
        }),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO login_attempts')) {
            store.login_attempts.push({
              id: args[0], ip_address: args[1], email: args[2],
              attempted_at: args[3], success: args[4], user_agent: args[5], blocked_until: args[6],
            });
          }
          if (sql.includes('INSERT INTO account_lockouts')) {
            store.account_lockouts.push({
              id: args[0], user_id: args[1], email: args[2], failed_attempts: 1,
              first_failed_at: args[3], last_failed_at: args[4], locked_until: args[5],
              created_at: args[6], updated_at: args[7],
            });
          }
          if (sql.includes('INSERT INTO security_audit_log')) {
            store.security_audit_log.push({
              id: args[0], event_type: args[1], ip_address: args[2],
              email: args[3], user_id: args[4], details: args[5], created_at: args[6],
            });
          }
          if (sql.includes('UPDATE account_lockouts') && sql.includes('WHERE id')) {
            const id = args[args.length - 1];
            const rec = store.account_lockouts.find(r => r.id === id);
            if (rec) {
              rec.failed_attempts = args[0];
              if (sql.includes('first_failed_at')) {
                rec.first_failed_at = args[1]; rec.last_failed_at = args[2];
                rec.locked_until = args[3]; rec.updated_at = args[4];
              } else {
                rec.last_failed_at = args[1]; rec.locked_until = args[2]; rec.updated_at = args[3];
              }
            }
          }
          if (sql.includes('UPDATE login_attempts') && sql.includes('blocked_until = NULL')) {
            store.login_attempts.forEach(r => { if (r.ip_address === args[0]) r.blocked_until = null; });
          }
          if (sql.includes('DELETE FROM account_lockouts') && sql.includes('user_id')) {
            for (let i = store.account_lockouts.length - 1; i >= 0; i--) {
              if (store.account_lockouts[i].user_id === args[0]) store.account_lockouts.splice(i, 1);
            }
          }
          return { success: true };
        }),
      })),
    })),
    _store: store,
  };
  return mockDB;
}

describe('Password Strength Validation', () => {
  it('rejects short passwords', () => {
    const r = validatePasswordStrength('Ab1!xyz');
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Password must be at least 8 characters long');
  });
  it('rejects no uppercase', () => {
    expect(validatePasswordStrength('abcdef1!xyz').valid).toBe(false);
  });
  it('rejects no lowercase', () => {
    expect(validatePasswordStrength('ABCDEF1!XYZ').valid).toBe(false);
  });
  it('rejects no numbers', () => {
    expect(validatePasswordStrength('Abcdefgh!').valid).toBe(false);
  });
  it('rejects no special chars', () => {
    expect(validatePasswordStrength('Abcdefgh1').valid).toBe(false);
  });
  it('accepts strong password', () => {
    const r = validatePasswordStrength('MyP@ssw0rd!');
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('weak strength', () => {
    expect(validatePasswordStrength('abcdefgh').strength).toBe('weak');
  });
  it('medium strength', () => {
    expect(validatePasswordStrength('Abcdef1!').strength).toBe('medium');
  });
  it('strong strength', () => {
    expect(validatePasswordStrength('MyStr0ng!P@ssword123').strength).toBe('strong');
  });
  it('multiple errors for very weak', () => {
    expect(validatePasswordStrength('abc').errors.length).toBeGreaterThanOrEqual(3);
  });
  it('handles empty string', () => {
    expect(validatePasswordStrength('').errors.length).toBeGreaterThanOrEqual(4);
  });
  it('only special chars invalid', () => {
    expect(validatePasswordStrength('!@#$%^&*').valid).toBe(false);
  });
  it('only numbers invalid', () => {
    expect(validatePasswordStrength('12345678').valid).toBe(false);
  });
  it('minimum valid password', () => {
    const r = validatePasswordStrength('Abc1234!');
    expect(r.valid).toBe(true);
    expect(r.strength).toBe('medium');
  });
});

describe('D1 Rate Limiter', () => {
  let limiter: D1RateLimiter;
  let db: any;
  beforeEach(() => { limiter = new D1RateLimiter(DEFAULT_RATE_LIMIT_CONFIG); db = createMockDB(); });

  it('allows clean IP', async () => {
    const r = await limiter.checkRateLimit(db, '192.168.1.1');
    expect(r.allowed).toBe(true);
    expect(r.remainingAttempts).toBe(5);
  });
  it('records failed attempt', async () => {
    await limiter.recordAttempt(db, '192.168.1.1', 'a@b.com', false, 'ua');
    expect(db._store.login_attempts.length).toBe(1);
    expect(db._store.login_attempts[0].success).toBe(0);
  });
  it('records success attempt', async () => {
    await limiter.recordAttempt(db, '192.168.1.1', 'a@b.com', true, 'ua');
    expect(db._store.login_attempts[0].success).toBe(1);
  });
  it('resets blocked_until', async () => {
    db._store.login_attempts.push({
      id: 'b1', ip_address: '1.1.1.1', email: 'x@x.com',
      attempted_at: new Date().toISOString(), success: 0, user_agent: 'bot',
      blocked_until: new Date(Date.now() + 1800000).toISOString(),
    });
    await limiter.resetForIP(db, '1.1.1.1');
    expect(db._store.login_attempts[0].blocked_until).toBeNull();
  });
  it('default config correct', () => {
    expect(DEFAULT_RATE_LIMIT_CONFIG.maxAttempts).toBe(5);
    expect(DEFAULT_RATE_LIMIT_CONFIG.windowMs).toBe(900000);
    expect(DEFAULT_RATE_LIMIT_CONFIG.blockDurationMs).toBe(1800000);
  });
  it('extracts IP from X-Forwarded-For', () => {
    const req = { headers: { get: (n: string) => n === 'x-forwarded-for' ? '10.0.0.1, 1.2.3.4' : null } } as any;
    expect(D1RateLimiter.getClientIP(req)).toBe('10.0.0.1');
  });
  it('extracts IP from CF-Connecting-IP', () => {
    const req = { headers: { get: (n: string) => n === 'cf-connecting-ip' ? '203.0.113.42' : null } } as any;
    expect(D1RateLimiter.getClientIP(req)).toBe('203.0.113.42');
  });
  it('fallback 0.0.0.0', () => {
    const req = { headers: { get: () => null } } as any;
    expect(D1RateLimiter.getClientIP(req)).toBe('0.0.0.0');
  });
  it('detects blocked IP', async () => {
    db._store.login_attempts.push({
      id: 'bl', ip_address: '10.0.0.5', email: 'a@a.com',
      attempted_at: new Date().toISOString(), success: 0, user_agent: 'bot',
      blocked_until: new Date(Date.now() + 1800000).toISOString(),
    });
    const r = await limiter.checkRateLimit(db, '10.0.0.5');
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });
});

describe('D1 Account Lockout', () => {
  let lockout: D1AccountLockout;
  let db: any;
  beforeEach(() => { lockout = new D1AccountLockout(DEFAULT_LOCKOUT_CONFIG); db = createMockDB(); });

  it('new user not locked', async () => {
    const r = await lockout.isLocked(db, 'u1');
    expect(r.locked).toBe(false);
    expect(r.remainingAttempts).toBe(10);
  });
  it('records first failed attempt', async () => {
    const r = await lockout.recordFailedAttempt(db, 'u1', 't@t.com');
    expect(r.failedAttempts).toBe(1);
    expect(r.locked).toBe(false);
    expect(r.remainingAttempts).toBe(9);
  });
  it('increments on subsequent calls', async () => {
    await lockout.recordFailedAttempt(db, 'u1', 't@t.com');
    const r = await lockout.recordFailedAttempt(db, 'u1', 't@t.com');
    expect(r.failedAttempts).toBe(2);
    expect(r.remainingAttempts).toBe(8);
  });
  it('resets lockout', async () => {
    await lockout.recordFailedAttempt(db, 'u1', 't@t.com');
    await lockout.reset(db, 'u1');
    expect(db._store.account_lockouts.filter((r: any) => r.user_id === 'u1').length).toBe(0);
  });
  it('default config correct', () => {
    expect(DEFAULT_LOCKOUT_CONFIG.maxFailedAttempts).toBe(10);
    expect(DEFAULT_LOCKOUT_CONFIG.lockoutDurationMs).toBe(3600000);
    expect(DEFAULT_LOCKOUT_CONFIG.resetWindowMs).toBe(1800000);
  });
  it('detects locked account', async () => {
    db._store.account_lockouts.push({
      id: 'lk1', user_id: 'ulocked', email: 'l@l.com', failed_attempts: 10,
      first_failed_at: new Date().toISOString(), last_failed_at: new Date().toISOString(),
      locked_until: new Date(Date.now() + 3600000).toISOString(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    const r = await lockout.isLocked(db, 'ulocked');
    expect(r.locked).toBe(true);
    expect(r.timeUntilUnlockMs).toBeGreaterThan(0);
  });
});

describe('Security Audit Logger', () => {
  let db: any;
  beforeEach(() => { db = createMockDB(); });

  it('logs a security event', async () => {
    await logSecurityEvent(db, {
      eventType: SecurityEventType.LOGIN_SUCCESS,
      ipAddress: '192.168.1.1', email: 'test@test.com', userId: 'u1',
      details: { tenantId: 't1' },
    });
    expect(db._store.security_audit_log.length).toBe(1);
    expect(db._store.security_audit_log[0].event_type).toBe('LOGIN_SUCCESS');
  });
  it('logs different event types', async () => {
    const types = [SecurityEventType.LOGIN_FAILED, SecurityEventType.LOGIN_RATE_LIMITED,
      SecurityEventType.ACCOUNT_LOCKED, SecurityEventType.REGISTER_SUCCESS, SecurityEventType.PASSWORD_WEAK];
    for (const t of types) await logSecurityEvent(db, { eventType: t, ipAddress: '10.0.0.1' });
    expect(db._store.security_audit_log.length).toBe(5);
  });
  it('handles null optional fields', async () => {
    await logSecurityEvent(db, { eventType: SecurityEventType.IP_BLOCKED });
    const log = db._store.security_audit_log[0];
    expect(log.ip_address).toBeNull();
    expect(log.email).toBeNull();
  });
  it('does not throw on DB errors', async () => {
    const broken = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({
      run: vi.fn(async () => { throw new Error('DB fail'); }),
    })) })) };
    await expect(logSecurityEvent(broken as any, { eventType: SecurityEventType.LOGIN_FAILED })).resolves.toBeUndefined();
  });
});
