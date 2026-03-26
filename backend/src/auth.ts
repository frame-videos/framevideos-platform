import * as bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  tenantId: string;
  createdAt: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  tenantId: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = 'frame-videos-secret-key-change-in-production-12345';

// Simple JWT implementation for MVP
function base64UrlEncode(data: string): string {
  return btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(data: string): string {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

async function signToken(payload: JWTPayload): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));

  const message = `${headerEncoded}.${payloadEncoded}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureEncoded = base64UrlEncode(
    String.fromCharCode(...signatureArray)
  );

  return `${message}.${signatureEncoded}`;
}

async function verifyTokenSignature(token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const message = `${headerEncoded}.${payloadEncoded}`;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = new Uint8Array(
      base64UrlDecode(signatureEncoded)
        .split('')
        .map(c => c.charCodeAt(0))
    );

    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(message));
  } catch (error) {
    return false;
  }
}

export async function generateToken(user: User): Promise<string> {
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    tenantId: user.tenantId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };

  return signToken(payload);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const isValid = await verifyTokenSignature(token);
    if (!isValid) return null;

    const parts = token.split('.');
    const payloadEncoded = parts[1];
    const payloadJson = base64UrlDecode(payloadEncoded);
    const payload = JSON.parse(payloadJson) as JWTPayload;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Hash password using bcrypt with automatic salt generation
 * Salt rounds: 10 (recommended for good security/performance balance)
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Password strength validation
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Calculate strength
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const criteriaCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  if (criteriaCount >= 5 && password.length >= 12) {
    strength = 'strong';
  } else if (criteriaCount >= 4) {
    strength = 'medium';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}
