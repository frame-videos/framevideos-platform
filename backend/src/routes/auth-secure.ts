import { Hono } from 'hono';
import { User } from '../database';
import { D1Database } from '../database-d1';
import { generateToken, hashPassword, verifyPassword, verifyToken, extractToken, validatePasswordStrength as validatePasswordAuth } from '../auth';
import {
  asyncHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  FrameVideosError,
  ErrorCode,
  ErrorCategory,
  validateRequired,
  validateEmail,
  validatePasswordStrength,
  withRetry,
} from '../error-handler';
import { D1RateLimiter, rateLimiter } from '../rate-limiter';
import { D1AccountLockout, accountLockout } from '../account-lockout';
import { logSecurityEvent, SecurityEventType } from '../security-audit';
import { logAuditEvent, AuditEventType } from '../audit';
import { loginRateLimit, registerRateLimit } from '../middleware/rate-limit';

type Bindings = {
  DB: any;
};

type Variables = {
  db: D1Database;
};

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Helper to get the raw D1 binding from context
 */
function getRawDB(c: any): any {
  return c.env.DB;
}

/**
 * Helper to get client IP
 */
function getClientIP(c: any): string {
  return c.req.header('cf-connecting-ip') 
    || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || '0.0.0.0';
}

// ============================================================================
// Register
// ============================================================================

auth.post('/register', registerRateLimit, asyncHandler(async (c) => {
  const body = await c.req.json();
  const { email, password, name, acceptTerms, acceptPrivacy } = body;
  let { tenantId } = body;
  const db = c.get('db');
  const rawDB = getRawDB(c);
  const clientIP = getClientIP(c);
  const userAgent = c.req.header('user-agent') || '';

  // Validation
  validateRequired(body, ['email', 'password', 'acceptTerms', 'acceptPrivacy']);
  
  // GDPR: Require explicit consent
  if (!acceptTerms || !acceptPrivacy) {
    throw new ValidationError('You must accept the Terms of Service and Privacy Policy to register');
  }
  
  validateEmail(email);

  // Validate password strength
  const passwordResult = validatePasswordAuth(password);
  if (!passwordResult.valid) {
    await logSecurityEvent(rawDB, {
      eventType: SecurityEventType.PASSWORD_WEAK,
      ipAddress: clientIP,
      email,
      details: { errors: passwordResult.errors, strength: passwordResult.strength },
    });
    
    throw new ValidationError('Password does not meet strength requirements', {
      errors: passwordResult.errors,
      strength: passwordResult.strength,
    });
  }

  // Also validate via error-handler
  validatePasswordStrength(password);

  // Check if user exists FIRST (before creating tenant)
  const existingUserCheck = await withRetry(() => db.getUserByEmail(email));
  if (existingUserCheck) {
    await logSecurityEvent(rawDB, {
      eventType: SecurityEventType.REGISTER_FAILED,
      ipAddress: clientIP,
      email,
      details: { reason: 'duplicate_email' },
    });
    throw new ConflictError('User already exists', { email });
  }

  // Resolve tenant: use provided tenantId or auto-create one
  let tenant;
  if (tenantId) {
    // Validate tenant exists (with retry)
    tenant = await withRetry(() => db.getTenantById(tenantId));
    if (!tenant) {
      throw new ValidationError('Invalid tenant ID', { tenantId });
    }
  } else {
    // Auto-create tenant with unique domain per user
    const emailPrefix = email.split('@')[0];
    const uniqueDomain = `${emailPrefix}-${crypto.randomUUID().slice(0, 8)}.framevideos.com`;
    const tenantName = name || emailPrefix;
    tenant = {
      id: crypto.randomUUID(),
      name: tenantName,
      domain: uniqueDomain,
      createdAt: new Date().toISOString(),
    };
    await withRetry(() => db.createTenant(tenant));
    tenantId = tenant.id;
  }


  // Detect if registering on framevideos.com (admin) or custom domain (user)
  const origin = c.req.header('origin') || '';
  const referer = c.req.header('referer') || '';
  const isFrameVideosDomain = origin.includes('framevideos.com') || referer.includes('framevideos.com');
  const userRole = isFrameVideosDomain ? 'admin' : 'user';

  // Create user
  const now = new Date().toISOString();
  const user: User = {
    id: crypto.randomUUID(),
    email,
    password: await hashPassword(password),
    role: userRole,
    tenantId,
    createdAt: now,
    privacyPolicyAcceptedAt: now,
    termsAcceptedAt: now,
  };

  await withRetry(() => db.createUser(user));

  // Generate token
  const token = await generateToken(user);

  // Log registration success
  await logSecurityEvent(rawDB, {
    eventType: SecurityEventType.REGISTER_SUCCESS,
    ipAddress: clientIP,
    email: user.email,
    userId: user.id,
    details: { tenantId: user.tenantId },
  });

  // Audit log
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.REGISTER_SUCCESS,
    userId: user.id,
    tenantId: user.tenantId,
    ipAddress: clientIP,
    userAgent,
    details: { email: user.email },
  });

  console.log('[USER_REGISTERED]', {
    timestamp: new Date().toISOString(),
    userId: user.id,
    email: user.email,
    tenantId: user.tenantId,
    ip: clientIP,
  });

  return c.json({
    message: 'User created successfully',
    user: {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    },
    token,
  }, 201);
}));

// ============================================================================
// Login (with Rate Limiting + Account Lockout)
// ============================================================================

auth.post('/login', loginRateLimit, asyncHandler(async (c) => {
  const body = await c.req.json();
  const { email, password } = body;
  const db = c.get('db');
  const rawDB = getRawDB(c);
  const clientIP = getClientIP(c);
  const userAgent = c.req.header('user-agent') || '';

  // Validation
  validateRequired(body, ['email', 'password']);

  // ── Step 1: Check IP-based rate limit ──
  const rateResult = await rateLimiter.checkRateLimit(rawDB, clientIP);
  
  if (!rateResult.allowed) {
    const retryAfterSeconds = Math.ceil(rateResult.retryAfterMs / 1000);
    
    await logSecurityEvent(rawDB, {
      eventType: SecurityEventType.LOGIN_RATE_LIMITED,
      ipAddress: clientIP,
      email,
      details: {
        totalAttempts: rateResult.totalAttempts,
        retryAfterSeconds,
      },
    });

    console.warn('[RATE_LIMITED]', {
      timestamp: new Date().toISOString(),
      ip: clientIP,
      email,
      retryAfterSeconds,
    });

    // Return HTTP 429
    c.header('Retry-After', String(retryAfterSeconds));
    return c.json({
      error: {
        message: 'Too many login attempts. Please try again later.',
        code: 429,
        category: 'RATE_LIMIT',
        retryAfterSeconds,
        timestamp: new Date().toISOString(),
      },
    }, 429);
  }

  // ── Step 2: Find user ──
  const user = await withRetry(() => db.getUserByEmail(email));
  
  if (!user) {
    // Record failed attempt (IP-based) even if user doesn't exist
    await rateLimiter.recordAttempt(rawDB, clientIP, email, false, userAgent);
    
    await logSecurityEvent(rawDB, {
      eventType: SecurityEventType.LOGIN_FAILED,
      ipAddress: clientIP,
      email,
      details: { reason: 'user_not_found' },
    });

    // Don't reveal if user exists or not
    throw new AuthenticationError('Invalid credentials');
  }

  // ── Step 3: Check account lockout ──
  const lockoutResult = await accountLockout.isLocked(rawDB, user.id);
  
  if (lockoutResult.locked) {
    const unlockTimeMs = lockoutResult.timeUntilUnlockMs;
    const unlockTimeMinutes = Math.ceil(unlockTimeMs / 60000);

    await logSecurityEvent(rawDB, {
      eventType: SecurityEventType.ACCOUNT_LOCKED,
      ipAddress: clientIP,
      email,
      userId: user.id,
      details: {
        failedAttempts: lockoutResult.failedAttempts,
        lockedUntil: lockoutResult.lockedUntil,
        unlockTimeMinutes,
      },
    });

    console.warn('[ACCOUNT_LOCKED]', {
      timestamp: new Date().toISOString(),
      userId: user.id,
      email,
      lockedUntil: lockoutResult.lockedUntil,
    });

    // Return HTTP 423 (Locked)
    return c.json({
      error: {
        message: 'Account is temporarily locked due to too many failed login attempts.',
        code: 423,
        category: 'ACCOUNT_LOCKED',
        lockedUntil: lockoutResult.lockedUntil,
        unlockTimeMinutes,
        timestamp: new Date().toISOString(),
      },
    }, 423);
  }

  // ── Step 4: Verify password ──
  const isValid = await verifyPassword(password, user.password);
  
  if (!isValid) {
    // Record failed attempt (IP-based)
    await rateLimiter.recordAttempt(rawDB, clientIP, email, false, userAgent);
    
    // Record failed attempt (account-based)
    const lockResult = await accountLockout.recordFailedAttempt(rawDB, user.id, email);

    await logSecurityEvent(rawDB, {
      eventType: SecurityEventType.LOGIN_FAILED,
      ipAddress: clientIP,
      email,
      userId: user.id,
      details: {
        reason: 'invalid_password',
        failedAttempts: lockResult.failedAttempts,
        remainingAttempts: lockResult.remainingAttempts,
        accountLocked: lockResult.locked,
      },
    });

    // Audit log
    await logAuditEvent(rawDB, {
      eventType: AuditEventType.LOGIN_FAILED,
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress: clientIP,
      userAgent,
      details: { 
        email,
        reason: 'invalid_password',
        failedAttempts: lockResult.failedAttempts,
      },
    });

    console.warn('[LOGIN_FAILED]', {
      timestamp: new Date().toISOString(),
      email,
      ip: clientIP,
      failedAttempts: lockResult.failedAttempts,
      accountLocked: lockResult.locked,
    });
    
    // If account just got locked, return 423
    if (lockResult.locked) {
      return c.json({
        error: {
          message: 'Account is temporarily locked due to too many failed login attempts.',
          code: 423,
          category: 'ACCOUNT_LOCKED',
          lockedUntil: lockResult.lockedUntil,
          unlockTimeMinutes: Math.ceil(lockResult.timeUntilUnlockMs / 60000),
          timestamp: new Date().toISOString(),
        },
      }, 423);
    }

    throw new AuthenticationError('Invalid credentials');
  }

  // ── Step 5: Successful login ──
  // Reset rate limit and account lockout
  await rateLimiter.recordAttempt(rawDB, clientIP, email, true, userAgent);
  await rateLimiter.resetForIP(rawDB, clientIP);
  await accountLockout.reset(rawDB, user.id);

  // Generate token
  const token = await generateToken(user);

  await logSecurityEvent(rawDB, {
    eventType: SecurityEventType.LOGIN_SUCCESS,
    ipAddress: clientIP,
    email: user.email,
    userId: user.id,
    details: { tenantId: user.tenantId },
  });

  // Audit log
  await logAuditEvent(rawDB, {
    eventType: AuditEventType.LOGIN_SUCCESS,
    userId: user.id,
    tenantId: user.tenantId,
    ipAddress: clientIP,
    userAgent,
    details: { email: user.email },
  });

  console.log('[USER_LOGIN]', {
    timestamp: new Date().toISOString(),
    userId: user.id,
    email: user.email,
    tenantId: user.tenantId,
    ip: clientIP,
  });

  return c.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    },
    token,
  });
}));

// ============================================================================
// Password Strength Validation
// ============================================================================

auth.post('/password-strength', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { password } = body;

  validateRequired(body, ['password']);

  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>_+\-=\[\]{};':\\|]/.test(password),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  if (passedChecks === 5 && password.length >= 12) {
    strength = 'strong';
  } else if (passedChecks >= 4) {
    strength = 'medium';
  }

  const errors: string[] = [];
  if (!checks.minLength) errors.push('Password must be at least 8 characters');
  if (!checks.hasUppercase) errors.push('Password must contain an uppercase letter');
  if (!checks.hasLowercase) errors.push('Password must contain a lowercase letter');
  if (!checks.hasNumber) errors.push('Password must contain a number');
  if (!checks.hasSpecial) errors.push('Password must contain a special character');

  return c.json({
    valid: errors.length === 0,
    strength,
    checks,
    errors,
  });
}));

// ============================================================================
// Get Current User
// ============================================================================

auth.get('/me', asyncHandler(async (c) => {
  const token = extractToken(c.req.header('Authorization'));
  const db = c.get('db');
  
  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  const payload = await verifyToken(token);
  
  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }

  const user = await withRetry(() => db.getUserById(payload.sub));
  
  if (!user) {
    throw new NotFoundError('User', payload.sub);
  }

  const tenant = await withRetry(() => db.getTenantById(user.tenantId));
  
  if (!tenant) {
    throw new NotFoundError('Tenant', user.tenantId);
  }

  return c.json({
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
    },
  });
}));

// ============================================================================
// Security Status (admin endpoint)
// ============================================================================

auth.get('/security-status', asyncHandler(async (c) => {
  const token = extractToken(c.req.header('Authorization'));
  
  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }

  const rawDB = getRawDB(c);

  // Get recent security events
  const recentEvents = await rawDB
    .prepare(`
      SELECT event_type, COUNT(*) as count 
      FROM security_audit_log 
      WHERE created_at > datetime('now', '-24 hours')
      GROUP BY event_type
      ORDER BY count DESC
    `)
    .all();

  // Get currently blocked IPs
  const blockedIPs = await rawDB
    .prepare(`
      SELECT DISTINCT ip_address, blocked_until 
      FROM login_attempts 
      WHERE blocked_until IS NOT NULL AND blocked_until > datetime('now')
    `)
    .all();

  // Get currently locked accounts
  const lockedAccounts = await rawDB
    .prepare(`
      SELECT email, locked_until, failed_attempts 
      FROM account_lockouts 
      WHERE locked_until IS NOT NULL AND locked_until > datetime('now')
    `)
    .all();

  return c.json({
    recentEvents: recentEvents.results || [],
    blockedIPs: blockedIPs.results || [],
    lockedAccounts: lockedAccounts.results || [],
    timestamp: new Date().toISOString(),
  });
}));

export default auth;