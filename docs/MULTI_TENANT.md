# Multi-Tenant Architecture - Frame Videos

## Overview

Frame Videos implements **strict tenant isolation** to ensure complete data separation between different customers (tenants). Each tenant's data is isolated at multiple layers:

1. **Authentication Layer** - JWT tokens include tenantId
2. **Middleware Layer** - All routes validate tenant context
3. **Database Layer** - Row-level security on all queries
4. **Logging Layer** - Audit trail of all tenant access

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Request                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Authentication Middleware                   │
│  - Validates JWT token                                   │
│  - Extracts tenantId from token                          │
│  - Sets tenantContext in request                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Tenant Isolation Middleware                 │
│  - Validates tenantId exists                             │
│  - Logs access for audit trail                           │
│  - Blocks unauthenticated requests                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Route Handler                          │
│  - Extracts tenantContext from request                   │
│  - Passes tenantId to database layer                     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Secure Database Layer                       │
│  - ALL queries MUST include tenantId parameter           │
│  - Row-level security checks on every operation          │
│  - Validates resource ownership before access            │
│  - Prevents cross-tenant data leakage                    │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Authentication Layer

**File:** `src/auth.ts`

JWT tokens include the user's `tenantId`:

```typescript
interface JWTPayload {
  sub: string;        // User ID
  email: string;      // User email
  tenantId: string;   // Tenant ID
  iat: number;        // Issued at
  exp: number;        // Expiration
}
```

### 2. Middleware Layer

**File:** `src/middleware/tenant-isolation.ts`

All protected routes MUST use the `tenantIsolation` middleware:

```typescript
import { tenantIsolation, getTenantContext } from '../middleware/tenant-isolation';

const videos = new Hono();

// Apply to ALL routes
videos.use('*', tenantIsolation);

videos.get('/', async (c) => {
  const { tenantId } = getTenantContext(c);
  // Use tenantId in queries...
});
```

**Key Functions:**

- `tenantIsolation(c, next)` - Validates authentication and sets tenant context
- `getTenantContext(c)` - Retrieves tenant context from request
- `validateTenantOwnership(c, resourceTenantId)` - Validates resource ownership

### 3. Database Layer

**File:** `src/database-secure.ts`

ALL database methods REQUIRE `tenantId` parameter:

```typescript
// ❌ WRONG - No tenant validation
await db.getVideoById(videoId);

// ✅ CORRECT - Validates tenant ownership
await secureDb.getVideoById(videoId, tenantId);
```

**Row-Level Security:**

Every database operation validates that:
1. The `tenantId` parameter matches the resource's `tenantId`
2. Cross-tenant access attempts are blocked and logged
3. Modifications to `tenantId` are prevented

### 4. Logging Layer

All tenant access is logged for security auditing:

```json
{
  "timestamp": "2026-03-25T22:10:00.000Z",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "method": "GET",
  "path": "/api/v1/videos/video-789",
  "ip": "203.0.113.42",
  "userAgent": "Mozilla/5.0..."
}
```

Security violations are logged as warnings:

```json
{
  "timestamp": "2026-03-25T22:10:00.000Z",
  "userId": "user-456",
  "userTenantId": "tenant-123",
  "resourceTenantId": "tenant-999",
  "path": "/api/v1/videos/video-789"
}
```

## Security Guarantees

### ✅ What IS Protected

1. **Video Access** - Tenant A cannot read Tenant B's videos
2. **Video Modification** - Tenant A cannot update/delete Tenant B's videos
3. **Video Creation** - Videos are always created with authenticated tenant's ID
4. **View Counting** - Cross-tenant view increments are blocked
5. **Tenant ID Immutability** - Cannot change a resource's tenantId after creation

### ⚠️ What is NOT Protected (by design)

1. **Tenant Metadata** - Tenant names/domains are public (for signup/login)
2. **User Enumeration** - Email existence can be determined via registration
3. **Public Endpoints** - Health check and API info are public

## Testing

### Running Isolation Tests

```bash
cd backend
npm test
```

The test suite validates:

1. ✅ Tenant can access their own resources
2. ✅ Tenant CANNOT access other tenant's resources
3. ✅ Cross-tenant modifications are blocked
4. ✅ Cross-tenant deletions are blocked
5. ✅ TenantId cannot be modified
6. ✅ Mismatched tenantId creation is blocked

**Expected Output:**

```
🧪 Starting Tenant Isolation Tests...

✅ Test 1: Tenant A can access their own video
✅ Test 2: Tenant A blocked from accessing Tenant B video
✅ Test 3: Tenant B can access their own video
✅ Test 4: Tenant B blocked from accessing Tenant A video
✅ Test 5: getVideosByTenant correctly isolates data
✅ Test 6: Cross-tenant update blocked
✅ Test 7: Cross-tenant delete blocked
✅ Test 8: Cross-tenant view increment blocked
✅ Test 9: Mismatched tenantId creation blocked
✅ Test 10: tenantId modification blocked

📊 Test Results:
   ✅ Passed: 10
   ❌ Failed: 0
   📈 Success Rate: 100.0%

🎉 All tests passed! Tenant isolation is working correctly.
```

## Migration Guide

### Converting Existing Routes

**Before (Insecure):**

```typescript
videos.get('/:id', authenticate, async (c) => {
  const id = c.req.param('id');
  const video = await db.getVideoById(id); // ❌ No tenant check!
  return c.json(video);
});
```

**After (Secure):**

```typescript
videos.use('*', tenantIsolation);

videos.get('/:id', async (c) => {
  const id = c.req.param('id');
  const { tenantId } = getTenantContext(c);
  const video = await secureDb.getVideoById(id, tenantId); // ✅ Validated!
  
  if (!video) {
    return c.json({ error: 'Video not found' }, 404);
  }
  
  return c.json(video);
});
```

### Checklist for New Routes

- [ ] Apply `tenantIsolation` middleware
- [ ] Extract `tenantId` using `getTenantContext(c)`
- [ ] Pass `tenantId` to ALL database methods
- [ ] Use `secureDb` instead of `db`
- [ ] Add error handling for cross-tenant access
- [ ] Add tests for tenant isolation
- [ ] Log access for audit trail

## Best Practices

### 1. Never Trust Client Input

```typescript
// ❌ WRONG - Client could send any tenantId
const { tenantId } = await c.req.json();
await secureDb.createVideo(video, tenantId);

// ✅ CORRECT - Use authenticated tenant
const { tenantId } = getTenantContext(c);
await secureDb.createVideo(video, tenantId);
```

### 2. Always Validate Ownership

```typescript
// ❌ WRONG - Assumes video exists and belongs to tenant
const video = await secureDb.getVideoById(id, tenantId);
await secureDb.updateVideo(id, updates, tenantId);

// ✅ CORRECT - Check video exists and belongs to tenant
const video = await secureDb.getVideoById(id, tenantId);
if (!video) {
  return c.json({ error: 'Video not found' }, 404);
}
validateTenantOwnership(c, video.tenantId);
await secureDb.updateVideo(id, updates, tenantId);
```

### 3. Log Security Events

```typescript
// Log successful access
console.log('[VIDEO_ACCESS]', {
  timestamp: new Date().toISOString(),
  userId: context.userId,
  tenantId: context.tenantId,
  videoId: id,
});

// Log security violations
console.warn('[SECURITY_VIOLATION]', {
  timestamp: new Date().toISOString(),
  userId: context.userId,
  attemptedTenantId: resourceTenantId,
  actualTenantId: context.tenantId,
});
```

### 4. Use TypeScript Strictly

```typescript
// Force tenantId parameter at type level
async getVideoById(id: string, tenantId: string): Promise<Video | null> {
  // Implementation...
}

// Compiler will error if tenantId is missing
const video = await secureDb.getVideoById(id); // ❌ Compile error!
const video = await secureDb.getVideoById(id, tenantId); // ✅ OK
```

## Production Considerations

### 1. Database Migration

When moving to a real database (D1, PostgreSQL, etc.):

```sql
-- Add tenant_id column to all tables
ALTER TABLE videos ADD COLUMN tenant_id TEXT NOT NULL;

-- Create index for performance
CREATE INDEX idx_videos_tenant_id ON videos(tenant_id);

-- Add row-level security policies (PostgreSQL)
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON videos
  USING (tenant_id = current_setting('app.current_tenant_id'));
```

### 2. Monitoring & Alerts

Set up alerts for:

- Failed authentication attempts
- Cross-tenant access attempts
- Unusual access patterns
- High volume of 403 errors

### 3. Regular Audits

- Review access logs monthly
- Run isolation tests in CI/CD
- Perform penetration testing
- Audit new routes for isolation compliance

## Troubleshooting

### "Tenant context not found" Error

**Cause:** Route is missing `tenantIsolation` middleware

**Fix:**
```typescript
videos.use('*', tenantIsolation);
```

### "Access denied: resource belongs to different tenant"

**Cause:** User trying to access another tenant's resource

**Expected Behavior:** This is correct! The system is blocking unauthorized access.

### Tests Failing

1. Check that all routes use `secureDb` instead of `db`
2. Verify `tenantIsolation` middleware is applied
3. Ensure all database methods receive `tenantId` parameter
4. Review logs for security violations

## References

- [OWASP Multi-Tenancy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multitenant_Architecture_Cheat_Sheet.html)
- [Cloudflare Workers Security Best Practices](https://developers.cloudflare.com/workers/platform/security/)
- JWT Best Practices: [RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725)

---

**Last Updated:** 2026-03-25  
**Version:** 1.0.0  
**Status:** ✅ Implemented & Tested
