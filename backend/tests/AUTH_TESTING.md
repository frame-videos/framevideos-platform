# Multi-Level Auth Testing Guide

## Setup

### 1. Create Test Users in D1 Database

Execute these SQL statements in your D1 database (via Cloudflare Dashboard or wrangler):

```sql
-- Super Admin User
INSERT INTO users (id, email, password_hash, role, tenant_id, created_at)
VALUES (
  'a5302c5c-9f1d-4c2c-8a4d-7cc835abd6e7',
  'super@framevideos.com',
  '$2b$10$OvADjJfi7qhgBwolDRXDquLarPdW5z4d2X1Lx5GHP/AE0A/ShwD5S',
  'super_admin',
  '00000000-0000-0000-0000-000000000000',
  '2026-03-27T11:04:51.177Z'
);

-- Admin User
INSERT INTO users (id, email, password_hash, role, tenant_id, created_at)
VALUES (
  '5d2726c6-cc64-4d4e-a7fc-2bcddf0539c5',
  'admin@framevideos.com',
  '$2b$10$I0LYF2yuYZUHAKqTMAcuYeI.W1qsQi7L2HNTWFKTRbKJLaCzVWnI2',
  'admin',
  '00000000-0000-0000-0000-000000000000',
  '2026-03-27T11:05:04.918Z'
);
```

### 2. Test Credentials

- **Super Admin**: `super@framevideos.com` / `SuperAdmin123!`
- **Admin**: `admin@framevideos.com` / `Admin123!`
- **Regular User**: Register via `/api/v1/auth/register`

---

## Manual Testing with cURL

### Step 1: Login and Get Tokens

```bash
# Login as Super Admin
SUPER_TOKEN=$(curl -s -X POST https://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"super@framevideos.com","password":"SuperAdmin123!"}' \
  | jq -r '.token')

# Login as Admin
ADMIN_TOKEN=$(curl -s -X POST https://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@framevideos.com","password":"Admin123!"}' \
  | jq -r '.token')

# Register and login as Regular User
USER_TOKEN=$(curl -s -X POST https://your-domain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"User123!","domain":"test.com"}' \
  | jq -r '.token')
```

### Step 2: Test Super Admin Routes (`/api/v1/tenants/*`)

**Expected Results:**
- ✅ Super Admin: 200 OK
- ❌ Admin: 403 Forbidden
- ❌ User: 403 Forbidden
- ❌ No Auth: 401 Unauthorized

```bash
# Super Admin - Should succeed (201 Created)
curl -X POST https://your-domain.com/api/v1/tenants \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Tenant","domain":"test123.framevideos.com"}'

# Admin - Should fail (403 Forbidden)
curl -X POST https://your-domain.com/api/v1/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Tenant","domain":"test456.framevideos.com"}'

# User - Should fail (403 Forbidden)
curl -X POST https://your-domain.com/api/v1/tenants \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Tenant","domain":"test789.framevideos.com"}'

# No Auth - Should fail (401 Unauthorized)
curl -X POST https://your-domain.com/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Tenant","domain":"test000.framevideos.com"}'
```

### Step 3: Test Admin Routes (`/api/v1/analytics/dashboard`)

**Expected Results:**
- ✅ Super Admin: 200 OK
- ✅ Admin: 200 OK
- ❌ User: 403 Forbidden
- ❌ No Auth: 401 Unauthorized

```bash
# Super Admin - Should succeed (200 OK)
curl https://your-domain.com/api/v1/analytics/dashboard \
  -H "Authorization: Bearer $SUPER_TOKEN"

# Admin - Should succeed (200 OK)
curl https://your-domain.com/api/v1/analytics/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# User - Should fail (403 Forbidden)
curl https://your-domain.com/api/v1/analytics/dashboard \
  -H "Authorization: Bearer $USER_TOKEN"

# No Auth - Should fail (401 Unauthorized)
curl https://your-domain.com/api/v1/analytics/dashboard
```

---

## Expected Error Messages

### 401 Unauthorized (No Auth)
```json
{
  "error": "Authentication required",
  "status": 401
}
```

### 403 Forbidden (Insufficient Role - Admin trying Super Admin route)
```json
{
  "error": "Super admin access required",
  "status": 403,
  "details": {
    "requiredRole": "super_admin",
    "userRole": "admin"
  }
}
```

### 403 Forbidden (Insufficient Role - User trying Admin route)
```json
{
  "error": "Admin access required",
  "status": 403,
  "details": {
    "requiredRole": "admin or super_admin",
    "userRole": "user"
  }
}
```

---

## Role Hierarchy

```
super_admin  →  Full access (tenants + analytics + all features)
    ↓
admin        →  Analytics dashboard + tenant-specific management
    ↓
user         →  Basic video access only
```

---

## Automated Testing

Run Playwright tests (when configured):

```bash
cd backend
npm test tests/auth-middleware.spec.ts
```

---

## Troubleshooting

### Issue: All requests return 401
- Check if JWT_SECRET is set in environment variables
- Verify token is not expired (default: 7 days)
- Ensure Authorization header format: `Bearer <token>`

### Issue: Super admin gets 403 on tenant routes
- Verify user role in database is exactly `super_admin` (not `superadmin` or `super-admin`)
- Check middleware order in routes/tenants.ts (authenticate → requireSuperAdmin)

### Issue: Admin can access tenant routes
- Verify requireSuperAdmin middleware is applied to all tenant routes
- Check for middleware bypass or override

---

## Security Notes

- Never commit real passwords or tokens to git
- Rotate JWT_SECRET regularly in production
- Use strong passwords for admin accounts
- Monitor audit logs for unauthorized access attempts
- Consider adding 2FA for admin/super_admin accounts
