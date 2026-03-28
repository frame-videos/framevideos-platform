# Security — Frame Videos

## Headers

Todos os responses da API e do tenant-site incluem headers de segurança OWASP:

| Header | Valor | Propósito |
|--------|-------|-----------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Força HTTPS por 1 ano |
| `X-Content-Type-Options` | `nosniff` | Previne MIME type sniffing |
| `X-Frame-Options` | `DENY` (API) / `SAMEORIGIN` (tenant-site) | Previne clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Ativa filtro XSS do browser |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controla informação de referrer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Desabilita APIs sensíveis |
| `Content-Security-Policy` | Configurado por contexto | Previne XSS e injection |

### CSP da API
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'
```

### CSP do Tenant Site (mais permissivo)
```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com;
style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https:;
frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com;
frame-ancestors 'self'; media-src 'self' https: blob:
```

## Rate Limiting

Rate limiting baseado em Cloudflare KV com sliding window:

| Endpoint | Limite | Janela | Identificador |
|----------|--------|--------|---------------|
| `POST /auth/login` | 5 req | 60s | IP |
| `POST /auth/signup` | 3 req | 60s | IP |
| `POST /track` | 60 req | 60s | IP |
| `POST /newsletter/subscribe` | 3 req | 60s | IP |
| Endpoints autenticados | 100 req | 60s | Tenant ID |

Headers de resposta:
- `X-RateLimit-Limit`: Limite máximo
- `X-RateLimit-Remaining`: Requisições restantes
- `X-RateLimit-Reset`: Timestamp de reset
- `Retry-After`: Segundos até retry (em 429)

## Input Sanitization

Middleware global que sanitiza todo input:

1. **Strip HTML tags**: Remove tags de todos os campos string em POST/PUT/PATCH
2. **Trim whitespace**: Remove espaços em branco nas extremidades
3. **Limite de tamanho**: Máximo 10.000 caracteres por campo string
4. **Content-Type validation**: POST/PUT/PATCH devem usar `application/json`
5. **Payload size limit**: Máximo 1MB por request
6. **Query params**: Sanitização de parâmetros de URL

## Authentication

### JWT-based Auth
- Access tokens com expiração curta (15 min)
- Refresh tokens com expiração longa (7 dias)
- Rotação de refresh tokens a cada uso
- Bcrypt para hashing de senhas (cost factor 12)

### Multi-tenant Isolation
- Todas as queries incluem `tenant_id` no WHERE
- Auth middleware extrai tenant do JWT
- Não é possível acessar dados de outro tenant

### Role-based Access Control (RBAC)
- `super_admin`: Acesso total (gerenciamento de tenants)
- `tenant_admin`: Gerenciamento do próprio tenant
- `editor`: Gerenciamento de conteúdo
- `viewer`: Apenas leitura

## OWASP Compliance

### Auditoria de Segurança
Endpoint: `GET /api/v1/security/audit` (super_admin only)

Verifica:
- ✅ Security headers configurados
- ✅ CORS configuration
- ✅ Rate limiting ativo
- ✅ Tentativas de login falhadas (24h)
- ✅ Status SSL dos domínios
- ✅ Versão do schema (migrations)
- ✅ Input sanitization ativo
- ✅ Authentication configurada

### OWASP Top 10 Coverage

| Risco | Mitigação |
|-------|-----------|
| A01 - Broken Access Control | RBAC, tenant isolation, JWT validation |
| A02 - Cryptographic Failures | HTTPS (HSTS), bcrypt, JWT secrets |
| A03 - Injection | Input sanitization, parameterized queries, CSP |
| A04 - Insecure Design | Security-by-default middleware, audit route |
| A05 - Security Misconfiguration | Security headers, strict CSP, CORS |
| A06 - Vulnerable Components | No external deps in runtime, Cloudflare managed |
| A07 - Auth Failures | Rate limiting, token rotation, bcrypt |
| A08 - Data Integrity Failures | Input validation (Zod), Content-Type checks |
| A09 - Logging & Monitoring | Structured logging, error tracking, audit endpoint |
| A10 - SSRF | URL validation, no server-side redirects to user input |
