/**
 * Consolidated Error Handler - Best of Both Implementations
 * Combines Rublo's error codes + sub-agent's retry logic + validation helpers
 */

import { Context } from 'hono';

// ============================================================================
// ERROR CODES & CATEGORIES (Rublo's approach - cleaner)
// ============================================================================

export enum ErrorCode {
  // 400 - Bad Request
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_EMAIL = 'INVALID_EMAIL',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  INVALID_UUID = 'INVALID_UUID',

  // 401 - Unauthorized
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // 403 - Forbidden
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  TENANT_MISMATCH = 'TENANT_MISMATCH',

  // 404 - Not Found
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  VIDEO_NOT_FOUND = 'VIDEO_NOT_FOUND',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  TAG_NOT_FOUND = 'TAG_NOT_FOUND',

  // 409 - Conflict
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  DUPLICATE_SLUG = 'DUPLICATE_SLUG',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',

  // 429 - Too Many Requests
  RATE_LIMITED = 'RATE_LIMITED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // 500 - Internal Server Error
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
}

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  INTERNAL = 'INTERNAL',
}

// ============================================================================
// CUSTOM ERROR CLASSES (Sub-agent's approach - better for instanceof)
// ============================================================================

export interface ErrorContext {
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  tenantId?: string;
  userId?: string;
  [key: string]: any;
}

export interface ErrorDetails {
  [key: string]: any;
}

export class FrameVideosError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: ErrorDetails,
    public category?: ErrorCategory
  ) {
    super(message);
    this.name = 'FrameVideosError';
  }
}

export class ValidationError extends FrameVideosError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.INVALID_INPUT, 400, message, details, ErrorCategory.VALIDATION);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends FrameVideosError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.UNAUTHORIZED, 401, message, details, ErrorCategory.AUTHENTICATION);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends FrameVideosError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.FORBIDDEN, 403, message, details, ErrorCategory.AUTHORIZATION);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends FrameVideosError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} ${id} not found` : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, 404, message, undefined, ErrorCategory.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends FrameVideosError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.RESOURCE_EXISTS, 409, message, details, ErrorCategory.CONFLICT);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends FrameVideosError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.RATE_LIMITED, 429, message, details, ErrorCategory.RATE_LIMIT);
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends FrameVideosError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.DATABASE_ERROR, 500, message, details, ErrorCategory.INTERNAL);
    this.name = 'DatabaseError';
  }
}

export class StorageError extends FrameVideosError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.STORAGE_ERROR, 500, message, details, ErrorCategory.INTERNAL);
    this.name = 'StorageError';
  }
}

export class ExternalAPIError extends FrameVideosError {
  constructor(message: string, details?: ErrorDetails) {
    super(ErrorCode.EXTERNAL_API_ERROR, 502, message, details, ErrorCategory.INTERNAL);
    this.name = 'ExternalAPIError';
  }
}

// ============================================================================
// VALIDATION HELPERS (Sub-agent's approach)
// ============================================================================

export function validateRequired(
  data: any,
  fields: string[]
): void {
  const missing = fields.filter((f) => !data[f]);
  if (missing.length > 0) {
    throw new ValidationError('Missing required fields', { missing });
  }
}

export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }
}

export interface PasswordStrengthResult {
  valid: boolean;
  strength: 'weak' | 'fair' | 'good' | 'strong';
  checks: {
    hasMinLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';

  if (passedChecks >= 4) strength = 'strong';
  else if (passedChecks >= 3) strength = 'good';
  else if (passedChecks >= 2) strength = 'fair';

  const valid = checks.hasMinLength && checks.hasUppercase && checks.hasLowercase && checks.hasNumber;

  if (!valid) {
    throw new ValidationError('Password does not meet strength requirements', { checks });
  }

  return { valid: true, strength, checks };
}

export function validateUUID(id: string, fieldName: string = 'id'): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}

// ============================================================================
// LOGGING & ERROR RESPONSE (Rublo's approach - cleaner)
// ============================================================================

export function logError(error: FrameVideosError, context: ErrorContext): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    category: error.category,
    context,
    details: error.details,
  };

  console.error('[FrameVideosError]', JSON.stringify(logEntry, null, 2));
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: ErrorDetails
) {
  return {
    code,
    message,
    statusCode,
    details,
    timestamp: new Date().toISOString(),
  };
}

export function getStatusCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    [ErrorCode.INVALID_INPUT]: 400,
    [ErrorCode.MISSING_FIELD]: 400,
    [ErrorCode.INVALID_EMAIL]: 400,
    [ErrorCode.WEAK_PASSWORD]: 400,
    [ErrorCode.INVALID_UUID]: 400,
    [ErrorCode.UNAUTHORIZED]: 401,
    [ErrorCode.INVALID_TOKEN]: 401,
    [ErrorCode.TOKEN_EXPIRED]: 401,
    [ErrorCode.INVALID_CREDENTIALS]: 401,
    [ErrorCode.FORBIDDEN]: 403,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
    [ErrorCode.TENANT_MISMATCH]: 403,
    [ErrorCode.NOT_FOUND]: 404,
    [ErrorCode.USER_NOT_FOUND]: 404,
    [ErrorCode.VIDEO_NOT_FOUND]: 404,
    [ErrorCode.TENANT_NOT_FOUND]: 404,
    [ErrorCode.CATEGORY_NOT_FOUND]: 404,
    [ErrorCode.TAG_NOT_FOUND]: 404,
    [ErrorCode.DUPLICATE_EMAIL]: 409,
    [ErrorCode.DUPLICATE_SLUG]: 409,
    [ErrorCode.RESOURCE_EXISTS]: 409,
    [ErrorCode.RATE_LIMITED]: 429,
    [ErrorCode.ACCOUNT_LOCKED]: 429,
    [ErrorCode.INTERNAL_ERROR]: 500,
    [ErrorCode.DATABASE_ERROR]: 500,
    [ErrorCode.STORAGE_ERROR]: 500,
    [ErrorCode.EXTERNAL_API_ERROR]: 502,
  };

  return statusMap[code] || 500;
}

// ============================================================================
// RETRY LOGIC (Sub-agent's approach - excellent)
// ============================================================================

export interface RetryConfig {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  delayMs: 100,
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // Only retry transient errors
    if (error instanceof FrameVideosError) {
      return [
        ErrorCode.DATABASE_ERROR,
        ErrorCode.STORAGE_ERROR,
        ErrorCode.EXTERNAL_API_ERROR,
      ].includes(error.code);
    }
    return false;
  },
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === finalConfig.maxRetries || !finalConfig.shouldRetry(error)) {
        throw error;
      }

      const delayMs = finalConfig.delayMs * Math.pow(finalConfig.backoffMultiplier, attempt);
      console.log(
        `[Retry] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1}, waiting ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// ============================================================================
// ASYNC HANDLER WRAPPER (Sub-agent's approach)
// ============================================================================

export function asyncHandler(
  handler: (c: Context) => Promise<Response>
) {
  return async (c: Context): Promise<Response> => {
    try {
      return await handler(c);
    } catch (error: any) {
      // Extract context from request
      const req = c.req;
      const context: ErrorContext = {
        endpoint: req.path,
        method: req.method,
        ip: req.header('x-forwarded-for') || req.header('x-real-ip'),
        userAgent: req.header('user-agent'),
      };

      // Handle FrameVideosError
      if (error instanceof FrameVideosError) {
        logError(error, context);
        return c.json(createErrorResponse(error.code, error.message, error.statusCode, error.details), error.statusCode);
      }

      // Handle JWT errors
      if (error.message?.includes('JWT')) {
        const jwtError = new AuthenticationError('Invalid or expired token');
        logError(jwtError, context);
        return c.json(
          createErrorResponse(jwtError.code, jwtError.message, jwtError.statusCode),
          jwtError.statusCode
        );
      }

      // Handle unknown errors
      console.error('[Unhandled Error]', error);
      const unknownError = new FrameVideosError(
        ErrorCode.INTERNAL_ERROR,
        500,
        'An unexpected error occurred',
        { originalError: error.message }
      );
      logError(unknownError, context);
      return c.json(
        createErrorResponse(unknownError.code, unknownError.message, unknownError.statusCode),
        unknownError.statusCode
      );
    }
  };
}
