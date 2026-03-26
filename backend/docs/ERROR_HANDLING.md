# Error Handling Guide

## Overview

Frame Videos uses a centralized error handling system that provides consistent error responses across all endpoints.

## Error Response Format

All errors return a standardized JSON response:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "statusCode": 400,
  "details": {
    "field": "additional context"
  },
  "timestamp": "2026-03-25T23:30:00Z"
}
```

## Error Codes

### 400 - Bad Request
- `INVALID_INPUT` - Invalid input data
- `MISSING_FIELD` - Required field is missing
- `INVALID_EMAIL` - Email format is invalid
- `WEAK_PASSWORD` - Password doesn't meet strength requirements

### 401 - Unauthorized
- `UNAUTHORIZED` - Missing or invalid authentication
- `INVALID_TOKEN` - JWT token is invalid
- `TOKEN_EXPIRED` - JWT token has expired
- `INVALID_CREDENTIALS` - Wrong email/password combination

### 403 - Forbidden
- `FORBIDDEN` - Access denied
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `TENANT_MISMATCH` - Attempting to access another tenant's data

### 404 - Not Found
- `NOT_FOUND` - Generic not found
- `USER_NOT_FOUND` - User doesn't exist
- `VIDEO_NOT_FOUND` - Video doesn't exist
- `TENANT_NOT_FOUND` - Tenant doesn't exist
- `CATEGORY_NOT_FOUND` - Category doesn't exist
- `TAG_NOT_FOUND` - Tag doesn't exist

### 409 - Conflict
- `DUPLICATE_EMAIL` - Email already registered
- `DUPLICATE_SLUG` - Slug already exists
- `RESOURCE_EXISTS` - Resource already exists

### 429 - Too Many Requests
- `RATE_LIMITED` - Rate limit exceeded
- `ACCOUNT_LOCKED` - Account is locked due to too many failed login attempts

### 500 - Internal Server Error
- `INTERNAL_ERROR` - Unexpected server error
- `DATABASE_ERROR` - Database operation failed
- `STORAGE_ERROR` - Storage operation failed

## Usage Examples

### Handling Errors in Routes

```typescript
import { FrameVideosError, ErrorCode } from '../error-handler';

app.post('/api/v1/videos', async (c) => {
  try {
    const { title, url } = await c.req.json();

    // Validate required fields
    if (!title || !url) {
      throw new FrameVideosError(
        ErrorCode.MISSING_FIELD,
        400,
        'Title and URL are required',
        { missing: ['title', 'url'] }
      );
    }

    // Create video...
    return c.json({ video: newVideo });
  } catch (error: any) {
    if (error instanceof FrameVideosError) {
      return c.json(
        {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        error.statusCode
      );
    }

    // Handle unexpected errors
    return c.json(
      {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
      500
    );
  }
});
```

### Validation Helpers

```typescript
import {
  validateRequired,
  validateEmail,
  validatePasswordStrength,
} from '../error-handler';

// Validate required fields
validateRequired(data, ['email', 'password']); // Throws if missing

// Validate email
validateEmail('user@example.com'); // Throws if invalid

// Validate password strength
const result = validatePasswordStrength('MyPassword@123');
// Returns: { valid: true, strength: 'strong', checks: {...} }
```

## Error Logging

All errors are automatically logged with context:

```json
{
  "timestamp": "2026-03-25T23:30:00Z",
  "code": "INVALID_TOKEN",
  "message": "Invalid or expired token",
  "statusCode": 401,
  "context": {
    "endpoint": "/api/v1/videos",
    "method": "GET",
    "ip": "192.168.1.1",
    "tenantId": "tenant-123",
    "userId": "user-456"
  }
}
```

## Best Practices

1. **Always validate input** - Use validation helpers before processing
2. **Use specific error codes** - Be as specific as possible
3. **Include context** - Add details that help debugging
4. **Log errors** - All FrameVideosErrors are automatically logged
5. **Handle unknown errors** - Always catch and return INTERNAL_ERROR for unexpected issues
6. **Don't expose sensitive data** - Don't include passwords or tokens in error responses

## Rate Limiting & Account Lockout

When rate limiting or account lockout occurs:

```json
{
  "code": "RATE_LIMITED",
  "message": "Too many login attempts. Please try again in 15 minutes.",
  "statusCode": 429,
  "details": {
    "attemptsRemaining": 0,
    "lockoutUntil": "2026-03-25T23:45:00Z"
  }
}
```

## Client-Side Handling

Clients should:

1. Check the `statusCode` for HTTP status
2. Check the `code` for specific error handling
3. Display the `message` to users
4. Use `details` for additional context (e.g., validation errors)
5. Implement retry logic for 429 errors with exponential backoff

```javascript
const response = await fetch('/api/v1/videos', { method: 'POST', body });
const data = await response.json();

if (!response.ok) {
  switch (data.code) {
    case 'RATE_LIMITED':
      // Show "Too many requests" message
      break;
    case 'INVALID_TOKEN':
      // Redirect to login
      break;
    case 'TENANT_MISMATCH':
      // Show "Access denied" message
      break;
    default:
      // Show generic error message
      console.error(data.message);
  }
}
```
