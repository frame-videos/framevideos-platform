import { Hono } from 'hono';
import { db, User } from '../database';
import { generateToken, hashPassword, verifyPassword, validatePasswordStrength } from '../auth';
import { loginRateLimiter } from '../rate-limiter';
import { accountLockout } from '../account-lockout';

const auth = new Hono();

// Helper to get client IP (for rate limiting)
function getClientIP(c: any): string {
  return c.req.header('CF-Connecting-IP') || 
         c.req.header('X-Forwarded-For')?.split(',')[0] || 
         c.req.header('X-Real-IP') || 
         'unknown';
}

// Register
auth.post('/register', async (c) => {
  try {
    const { email, password, tenantId } = await c.req.json();

    // Validation
    if (!email || !password || !tenantId) {
      return c.json({ error: 'Email, password, and tenantId are required' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return c.json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors,
        strength: passwordValidation.strength,
      }, 400);
    }

    // Check if user exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return c.json({ error: 'User already exists' }, 409);
    }

    // Create user
    const user: User = {
      id: crypto.randomUUID(),
      email,
      password: await hashPassword(password),
      tenantId,
      createdAt: new Date().toISOString(),
    };

    await db.createUser(user);

    // Generate token
    const token = await generateToken(user);

    return c.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
      },
      token,
    }, 201);
  } catch (error: any) {
    return c.json({ error: 'Registration failed', message: error.message }, 500);
  }
});

// Login
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    // Validation
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Check IP-based rate limiting
    const clientIP = getClientIP(c);
    if (loginRateLimiter.isRateLimited(clientIP)) {
      const timeUntilUnblocked = loginRateLimiter.getTimeUntilUnblocked(clientIP);
      const minutesRemaining = Math.ceil(timeUntilUnblocked / 60000);
      
      return c.json({ 
        error: 'Too many login attempts',
        message: `Please try again in ${minutesRemaining} minute(s)`,
        retryAfter: timeUntilUnblocked,
      }, 429);
    }

    // Find user
    const user = await db.getUserByEmail(email);
    if (!user) {
      // Record failed attempt for IP
      loginRateLimiter.recordAttempt(clientIP);
      
      return c.json({ 
        error: 'Invalid credentials',
        remainingAttempts: loginRateLimiter.getRemainingAttempts(clientIP),
      }, 401);
    }

    // Check account lockout
    if (accountLockout.isLocked(user.id)) {
      const timeUntilUnlocked = accountLockout.getTimeUntilUnlocked(user.id);
      const minutesRemaining = Math.ceil(timeUntilUnlocked / 60000);
      
      return c.json({ 
        error: 'Account temporarily locked',
        message: `Too many failed login attempts. Account will be unlocked in ${minutesRemaining} minute(s)`,
        retryAfter: timeUntilUnlocked,
      }, 423);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      // Record failed attempts
      loginRateLimiter.recordAttempt(clientIP);
      accountLockout.recordFailedAttempt(user.id);
      
      const remainingIPAttempts = loginRateLimiter.getRemainingAttempts(clientIP);
      const remainingAccountAttempts = accountLockout.getRemainingAttempts(user.id);
      
      return c.json({ 
        error: 'Invalid credentials',
        remainingAttempts: Math.min(remainingIPAttempts, remainingAccountAttempts),
      }, 401);
    }

    // Reset lockouts on successful login
    loginRateLimiter.reset(clientIP);
    accountLockout.reset(user.id);

    // Generate token
    const token = await generateToken(user);

    return c.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
      },
      token,
    });
  } catch (error: any) {
    return c.json({ error: 'Login failed', message: error.message }, 500);
  }
});

// Verify token (for debugging)
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Authorization header required' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const { verifyToken } = await import('../auth');
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const user = await db.getUserById(payload.sub);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
  });
});

// Password strength check endpoint
auth.post('/check-password', async (c) => {
  try {
    const { password } = await c.req.json();
    
    if (!password) {
      return c.json({ error: 'Password is required' }, 400);
    }

    const validation = validatePasswordStrength(password);
    
    return c.json({
      valid: validation.valid,
      strength: validation.strength,
      errors: validation.errors,
    });
  } catch (error: any) {
    return c.json({ error: 'Validation failed', message: error.message }, 500);
  }
});

export default auth;
