# Error Handling Documentation

## Overview

Frame Videos API implements a **centralized, robust error handling system** with:

- ✅ Standardized HTTP error codes (400, 401, 403, 404, 500, etc.)
- ✅ Custom error classes for different scenarios
- ✅ Contextual logging (tenantId, userId, endpoint)
- ✅ Consistent JSON error responses
- ✅ Automatic retry logic for transient failures
- ✅ Request tracking via Request IDs
- ✅ Development-friendly stack traces

---

## Error Handler Architecture

### Core Components

**File:** `backend/src/error-handler.ts`

#### 1. Error Classes

```typescript
// Base error class
class AppError extends Error {
  code: ErrorCode;           // HTTP status code
  category: ErrorCategory;   // Error classification
  isOperational: boolean;    // Expected vs unexpected
  context?: Record<string, any>;
  timestamp: string;
}

// Specialized error classes
- ValidationError       (400) - Input validation failed
- AuthenticationError   (401) - Authentication required/failed
- AuthorizationError    (403) - Access denied
- NotFoundError         (404) - Resource not found
- ConflictError         (409) - Resource conflict
- RateLimitError        (429) - Too many requests
- DatabaseError         (500) - Database operation failed
- StorageError          (500) - Storage operation failed
- ExternalAPIError      (502) - External service error
```

#### 2. Error Categories

```typescript
enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  DATABASE = 'DATABASE',
  STORAGE = 'STORAGE',
  EXTERNAL_API = 'EXTERNAL_API',
  INTERNAL = 'INTERNAL',
}
```

#### 3. Error Response Format

```json
{
  "error": {
    "message": "User not found",
    "code": 404,
    "category": "NOT_FOUND",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-03-25T23:30:00.000Z",
    "context": {
      "userId": "123",
      "tenantId": "tenant-456"
    },
    "stack": "... (only in development)"
  }
}
```

---

## Usage Guide

### 1. Throwing Errors

#### Validation Error
```typescript
import { ValidationError, validateRequired } from '../error-handler';

// Manual validation
if (!email) {
  throw new ValidationError('Email is required');
}

// Using helpers
validateRequired(body, ['email', 'password']);
validateEmail(email);
validatePasswordStrength(password);
validateUUID(id, 'userId');
```

#### Authentication Error
```typescript
import { AuthenticationError } from '../error-handler';

if (!token) {
  throw new AuthenticationError('Authentication required');
}
```

#### Authorization Error
```typescript
import { AuthorizationError } from '../error-handler';

if (resource.tenantId !== user.tenantId) {
  throw new AuthorizationError('Access denied', { resourceId: resource.id });
}
```

#### Not Found Error
```typescript
import { NotFoundError } from '../error-handler';

const user = await db.getUserById(id);
if (!user) {
  throw new NotFoundError('User', { userId: id });
}
```

#### Other Errors
```typescript
import { ConflictError, DatabaseError, StorageError } from '../error-handler';

// Conflict
throw new ConflictError('User already exists', { email });

// Database
throw new DatabaseError('Failed to save user', { operation: 'insert' });

// Storage
throw new StorageError('Failed to upload file', { videoId });
```

### 2. Using Async Handler Wrapper

Automatically catches errors and formats responses:

```typescript
import { asyncHandler } from '../error-handler';

auth.post('/login', asyncHandler(async (c) => {
  const body = await c.req.json();
  // ... your code here
  // Errors are automatically caught and formatted
  return c.json({ success: true });
}));
```

### 3. Retry Logic

Automatically retry transient failures:

```typescript
import { withRetry } from '../error-handler';

// Basic retry (3 attempts, 1s delay with exponential backoff)
const user = await withRetry(() => db.getUserById(id));

// Custom retry options
const result = await withRetry(
  () => storageService.uploadVideo(data),
  {
    maxRetries: 5,
    delayMs: 500,
    backoffMultiplier: 2,
    retryableErrors: ['STORAGE', 'EXTERNAL_API'],
  }
);
```

**Retryable Errors (by default):**
- DATABASE errors
- STORAGE errors
- EXTERNAL_API errors

**Non-retryable Errors:**
- VALIDATION errors
- AUTHENTICATION errors
- AUTHORIZATION errors
- NOT_FOUND errors
- CONFLICT errors

### 4. Validation Helpers

```typescript
import {
  validateRequired,
  validateEmail,
  validatePasswordStrength,
  validateUUID,
} from '../error-handler';

// Check required fields
validateRequired(body, ['email', 'password', 'tenantId']);

// Validate email format
validateEmail(email); // Throws ValidationError if invalid

// Validate password strength
validatePasswordStrength(password); // Requires 8+ chars, 3 of: uppercase, lowercase, number, special

// Validate UUID format
validateUUID(id, 'userId'); // Throws ValidationError if invalid
```

---

## Logging

### Log Levels

**OPERATIONAL_ERROR** (console.warn)
- Expected errors (validation, auth, not found, etc.)
- User-facing errors

**CRITICAL_ERROR** (console.error)
- Unexpected errors (bugs, system failures)
- Non-operational errors

### Log Format

```json
{
  "timestamp": "2024-03-25T23:30:00.000Z",
  "error": {
    "name": "ValidationError",
    "message": "Email is required",
    "code": 400,
    "category": "VALIDATION",
    "isOperational": true,
    "stack": "..."
  },
  "context": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "tenantId": "tenant-456",
    "userId": "user-123",
    "endpoint": "/api/v1/auth/register",
    "method": "POST",
    "userAgent": "Mozilla/5.0...",
    "ip": "192.168.1.1"
  }
}
```

### Adding Context to Logs

```typescript
import { asyncHandler, withRetry } from '../error-handler';

videos.post('/', asyncHandler(async (c) => {
  const { tenantId, userId } = getTenantContext(c);
  
  // ... your code ...
  
  // Errors automatically include context
}, (c) => ({
  tenantId: getTenantContext(c).tenantId,
  userId: getTenantContext(c).userId,
})));
```

---

## Implementation in Endpoints

### Example: Auth Endpoint

```typescript
import { asyncHandler, ValidationError, AuthenticationError } from '../error-handler';

auth.post('/login', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  // Validation
  validateRequired(body, ['email', 'password']);

  // Find user (with retry)
  const user = await withRetry(() => db.getUserByEmail(email));
  
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password);
  
  if (!isValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Generate token
  const token = await generateToken(user);

  return c.json({
    message: 'Login successful',
    user: { id: user.id, email: user.email },
    token,
  });
}));
```

### Example: Videos Endpoint

```typescript
import { asyncHandler, NotFoundError, AuthorizationError } from '../error-handler';

videos.get('/:id', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const { tenantId } = getTenantContext(c);
  
  // Validate UUID
  validateUUID(id, 'videoId');
  
  // Get video (with retry)
  const video = await withRetry(() => db.getVideoById(id, tenantId));

  if (!video) {
    throw new NotFoundError('Video', { videoId: id });
  }

  return c.json(video);
}));
```

---

## Global Error Handler

The main app.ts includes a global error handler:

```typescript
app.onError((err, c) => {
  const error = err instanceof AppError ? err : new AppError(
    err.message || 'Internal server error',
    500,
    'INTERNAL' as any,
    false
  );
  
  return handleError(error, c);
});
```

This catches any unhandled errors and formats them consistently.

---

## Testing Error Scenarios

### Test Validation Error
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}'

# Response (400)
{
  "error": {
    "message": "Email is required",
    "code": 400,
    "category": "VALIDATION",
    "requestId": "..."
  }
}
```

### Test Authentication Error
```bash
curl -X GET http://localhost:3000/api/v1/videos \
  -H "Authorization: Bearer invalid-token"

# Response (401)
{
  "error": {
    "message": "Invalid or expired token",
    "code": 401,
    "category": "AUTHENTICATION",
    "requestId": "..."
  }
}
```

### Test Not Found Error
```bash
curl -X GET http://localhost:3000/api/v1/videos/invalid-id \
  -H "Authorization: Bearer valid-token"

# Response (404)
{
  "error": {
    "message": "Video not found",
    "code": 404,
    "category": "NOT_FOUND",
    "requestId": "...",
    "context": {
      "videoId": "invalid-id"
    }
  }
}
```

---

## Best Practices

### ✅ DO

1. **Use appropriate error classes** - Choose the right error type for the situation
2. **Add context** - Include relevant IDs and data in error context
3. **Log important events** - Log successful operations and failures
4. **Use retry logic** - Wrap database/storage operations with `withRetry`
5. **Validate early** - Check inputs at the start of handlers
6. **Use validation helpers** - Leverage built-in validators
7. **Include request IDs** - All responses include request IDs for tracking

### ❌ DON'T

1. **Don't expose sensitive data** - Never include passwords or secrets in errors
2. **Don't catch and ignore errors** - Always handle or re-throw
3. **Don't use generic errors** - Use specific error classes
4. **Don't retry non-retryable errors** - Authentication/validation errors won't retry
5. **Don't log sensitive data** - Sanitize PII before logging
6. **Don't return stack traces in production** - Only in development

---

## Error Response Examples

### Validation Error (400)
```json
{
  "error": {
    "message": "Password must be at least 8 characters",
    "code": 400,
    "category": "VALIDATION",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-03-25T23:30:00.000Z"
  }
}
```

### Authentication Error (401)
```json
{
  "error": {
    "message": "Authentication required",
    "code": 401,
    "category": "AUTHENTICATION",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-03-25T23:30:00.000Z"
  }
}
```

### Authorization Error (403)
```json
{
  "error": {
    "message": "Access denied",
    "code": 403,
    "category": "AUTHORIZATION",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-03-25T23:30:00.000Z",
    "context": {
      "resourceId": "video-123",
      "tenantId": "tenant-456"
    }
  }
}
```

### Not Found Error (404)
```json
{
  "error": {
    "message": "User not found",
    "code": 404,
    "category": "NOT_FOUND",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-03-25T23:30:00.000Z",
    "context": {
      "userId": "user-123"
    }
  }
}
```

### Conflict Error (409)
```json
{
  "error": {
    "message": "User already exists",
    "code": 409,
    "category": "CONFLICT",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-03-25T23:30:00.000Z",
    "context": {
      "email": "user@example.com"
    }
  }
}
```

### Internal Server Error (500)
```json
{
  "error": {
    "message": "Failed to save user",
    "code": 500,
    "category": "DATABASE",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-03-25T23:30:00.000Z",
    "context": {
      "operation": "insert",
      "tenantId": "tenant-456"
    }
  }
}
```

---

## Monitoring & Debugging

### Request ID Tracking

All responses include a `requestId` header:
```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

Use this to correlate logs and debug issues:
```bash
# Find all errors for a specific request
grep "550e8400-e29b-41d4-a716-446655440000" app.log
```

### Development Mode

In development (`ENVIRONMENT=development`), error responses include stack traces:

```json
{
  "error": {
    "message": "Failed to save user",
    "code": 500,
    "category": "DATABASE",
    "requestId": "...",
    "timestamp": "...",
    "stack": "Error: Failed to save user\n    at Object.createUser (database.ts:45:12)\n    ..."
  }
}
```

### Production Mode

In production (`ENVIRONMENT=production`), stack traces are excluded for security.

---

## Migration Guide

### From Old Error Handling

**Before:**
```typescript
try {
  const user = await db.getUserById(id);
  return c.json(user);
} catch (error: any) {
  console.error('Error:', error);
  return c.json({ error: