# API Reference — Frame Videos

**Base URL**: `https://api.framevideos.com/api/v1`

## Authentication
All authenticated endpoints require `Authorization: Bearer <token>` header.

### POST /auth/signup
Create a new tenant account.
```json
{ "email": "user@example.com", "password": "...", "name": "Name", "tenantName": "My Site" }
```

### POST /auth/login
```json
{ "email": "user@example.com", "password": "..." }
→ { "user": {...}, "tokens": { "accessToken": "...", "refreshToken": "..." } }
```

### POST /auth/refresh
```json
{ "refreshToken": "..." }
→ { "accessToken": "...", "refreshToken": "..." }
```

### POST /auth/logout
Requires auth. Invalidates refresh token.

---

## Content (Authenticated)

### GET /content/videos
Query: `?page=1&limit=24&category=slug&search=term&sort=newest`

### POST /content/videos
```json
{ "title": "...", "slug": "...", "description": "...", "sourceUrl": "...", "thumbnailUrl": "...", "duration": 120, "categoryId": "..." }
```

### GET /content/videos/:id
### PUT /content/videos/:id
### DELETE /content/videos/:id

### GET /content/categories
### POST /content/categories
### GET /content/categories/:id
### PUT /content/categories/:id
### DELETE /content/categories/:id

### GET /content/tags
### POST /content/tags
### GET /content/performers
### POST /content/performers
### GET /content/channels
### POST /content/channels
### GET /content/pages
### POST /content/pages

---

## Analytics

### POST /analytics/track (Public, no auth)
```json
{ "tenantId": "...", "path": "/", "referrer": "...", "userAgent": "...", "country": "BR", "deviceType": "desktop" }
→ 204 No Content
```

### GET /analytics/dashboard
Returns: totalPageviews, todayPageviews, dailyPageviews[], topPages[], topReferrers[], devices[], countries[]

### GET /analytics/daily?days=7

---

## Newsletter

### POST /newsletter/subscribe (Public)
```json
{ "email": "...", "tenant_id": "..." }
→ { "success": true, "confirmToken": "..." }
```

### GET /newsletter/subscribers
### POST /newsletter/campaigns
### GET /newsletter/campaigns

---

## Monitoring

### GET /monitoring/status
### GET /monitoring/history
### GET /monitoring/incidents
### POST /monitoring/check
```json
{ "domain": "example.com" }
```

---

## Email

### GET /email/templates
### PUT /email/templates/:type
### POST /email/send

---

## Credits (LLM)

### GET /credits/balance
```json
→ { "balance": 50, "totalCredited": 50, "totalDebited": 0 }
```

### GET /credits/transactions?page=1&limit=10
### GET /credits/usage?page=1&limit=10
### POST /credits/check
```json
{ "amount": 5 }
→ { "sufficient": true, "balance": 50, "required": 5 }
```

---

## AI (LLM Generation)

### POST /ai/generate/title
```json
{ "videoId": "..." }
→ { "title": "...", "creditsUsed": 2 }
```
Cost: 2 credits

### POST /ai/generate/description
Cost: 3 credits

### POST /ai/generate/keywords
Cost: 2 credits

### POST /ai/generate/faq
Cost: 5 credits

### POST /ai/translate
```json
{ "text": "...", "targetLocale": "en" }
```
Cost: 3 credits per language

---

## Crawler

### GET /crawler/sources
### POST /crawler/sources
```json
{ "name": "...", "url": "https://...", "selectors": { "videoLink": "a.video", "title": "h3", "thumbnail": "img" }, "schedule": "daily" }
```

### PUT /crawler/sources/:id
### DELETE /crawler/sources/:id
### POST /crawler/sources/:id/run
### GET /crawler/runs
### GET /crawler/runs/:id

---

## Domains

### GET /domains
### POST /domains
```json
{ "domain": "example.com" }
```
### DELETE /domains/:id
### POST /domains/:id/verify

---

## Billing

### POST /billing/checkout
### POST /billing/portal
### POST /billing/webhook (Stripe webhook)

---

## Admin (super_admin only)

### GET /admin/tenants
### GET /admin/users
### GET /admin/plans

---

## Security (super_admin only)

### GET /security/audit

---

## Error Codes
| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

## Rate Limits
| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /auth/login | 5 | 1 min |
| POST /auth/signup | 3 | 1 min |
| POST /analytics/track | 60 | 1 min |
| POST /newsletter/subscribe | 3 | 1 min |
| Authenticated endpoints | 100 | 1 min |

## Headers
All responses include:
- `X-Request-Id` — Unique request identifier
- `Strict-Transport-Security` — HSTS
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
