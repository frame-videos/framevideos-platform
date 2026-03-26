# Video Search API Documentation

## Endpoint

```
GET /api/v1/videos/search
```

## Description

Search and filter videos for the authenticated tenant with full-text search, category/tag filtering, pagination, and sorting.

## Authentication

Required: JWT Bearer Token in `Authorization` header

```
Authorization: Bearer <jwt_token>
```

## Query Parameters

### Search & Filtering

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | No | - | Search query (searches title and description, case-insensitive) |
| `category` | string | No | - | Filter by category ID |
| `tag` | string | No | - | Filter by tag ID |

### Sorting

| Parameter | Type | Required | Default | Options | Description |
|-----------|------|----------|---------|---------|-------------|
| `sort` | string | No | `date` | `date`, `views`, `title` | Field to sort by |
| `order` | string | No | `desc` | `asc`, `desc` | Sort order (ascending/descending) |

### Pagination

| Parameter | Type | Required | Default | Constraints | Description |
|-----------|------|----------|---------|------------|-------------|
| `limit` | number | No | `20` | 1-100 | Results per page |
| `offset` | number | No | `0` | ≥ 0 | Pagination offset |

## Examples

### Basic Search

Search for videos containing "tutorial":

```bash
curl -X GET "https://api.framevideos.com/api/v1/videos/search?q=tutorial" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Search with Sorting

Search for "react" sorted by views (most viewed first):

```bash
curl -X GET "https://api.framevideos.com/api/v1/videos/search?q=react&sort=views&order=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Category Filter

Get all videos in a specific category, sorted by date:

```bash
curl -X GET "https://api.framevideos.com/api/v1/videos/search?category=cat_123&sort=date&order=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Pagination

Get second page of results (20 results per page):

```bash
curl -X GET "https://api.framevideos.com/api/v1/videos/search?q=tutorial&limit=20&offset=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Combined Filters

Search with multiple filters:

```bash
curl -X GET "https://api.framevideos.com/api/v1/videos/search?q=javascript&category=cat_456&sort=views&order=desc&limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Response

### Success Response (200 OK)

```json
{
  "videos": [
    {
      "id": "vid_123",
      "tenantId": "tenant_abc",
      "title": "JavaScript Tutorial",
      "description": "Learn JavaScript from scratch",
      "url": "https://example.com/video.mp4",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "duration": 3600,
      "views": 1250,
      "createdAt": "2026-03-25T10:30:00Z"
    },
    {
      "id": "vid_124",
      "tenantId": "tenant_abc",
      "title": "Advanced JavaScript",
      "description": "Advanced concepts in JavaScript",
      "url": "https://example.com/video2.mp4",
      "thumbnailUrl": "https://example.com/thumb2.jpg",
      "duration": 4200,
      "views": 890,
      "createdAt": "2026-03-24T15:45:00Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0,
  "hasMore": false,
  "query": {
    "q": "javascript",
    "category": null,
    "tag": null,
    "sort": "date",
    "order": "desc"
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "error": "Limit must be between 1 and 100"
}
```

### Error Response (401 Unauthorized)

```json
{
  "error": "Unauthorized"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "error": "Search failed",
  "message": "Database error"
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `videos` | array | Array of video objects matching the search criteria |
| `total` | number | Total number of results (across all pages) |
| `limit` | number | Results per page (as requested) |
| `offset` | number | Pagination offset (as requested) |
| `hasMore` | boolean | Whether there are more results beyond current page |
| `query` | object | Echo of the search parameters |

## Sorting Behavior

### By Date (default)
- Newest videos first when `order=desc`
- Oldest videos first when `order=asc`

### By Views
- Most viewed videos first when `order=desc`
- Least viewed videos first when `order=asc`

### By Title
- Alphabetically sorted A-Z when `order=asc`
- Alphabetically sorted Z-A when `order=desc`

## Search Behavior

- **Case-insensitive**: "JavaScript" = "javascript" = "JAVASCRIPT"
- **Partial matching**: Query "script" matches "JavaScript Tutorial"
- **Multi-field**: Searches both title and description
- **AND logic**: All filters must match (if multiple filters provided)

## Pagination

Use `limit` and `offset` for cursor-based pagination:

```javascript
// Page 1
?limit=20&offset=0

// Page 2
?limit=20&offset=20

// Page 3
?limit=20&offset=40
```

## Validation Rules

| Parameter | Rule | Example |
|-----------|------|---------|
| `limit` | 1-100 | Invalid: `?limit=150`, Valid: `?limit=50` |
| `offset` | ≥ 0 | Invalid: `?offset=-5`, Valid: `?offset=0` |
| `sort` | One of: date, views, title | Invalid: `?sort=random`, Valid: `?sort=views` |
| `order` | One of: asc, desc | Invalid: `?order=random`, Valid: `?order=asc` |

## Rate Limiting

Subject to tenant rate limits. See [SECURITY.md](./SECURITY.md) for details.

## Multi-Tenant Security

- Results are automatically filtered to the authenticated tenant
- Cannot search videos from other tenants
- Row-level security enforced at database layer

## Future Enhancements

- [ ] Full-text search with ranking
- [ ] Category filter implementation
- [ ] Tag filter implementation
- [ ] Advanced filters (duration, view count range, date range)
- [ ] Search suggestions/autocomplete
- [ ] Search analytics
