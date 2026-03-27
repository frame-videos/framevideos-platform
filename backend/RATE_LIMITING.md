# Rate Limiting Implementation

## Overview

Rate limiting implementado usando Cloudflare KV namespace para controle de requisições por IP e por usuário autenticado.

## Configurações

### Endpoints Públicos
- **Limite**: 100 requisições/minuto por IP
- **Aplicado em**: Todos os endpoints `/api/v1/*`
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Login
- **Limite**: 10 requisições/minuto por IP
- **Endpoint**: `/api/v1/auth/login`
- **Proteção adicional**: Rate limiter D1-based para brute force (mantido)

### Registro
- **Limite**: 5 requisições/minuto por IP
- **Endpoint**: `/api/v1/auth/register`

### Upload de Vídeos
- **Limite**: 10 requisições/minuto por usuário autenticado
- **Endpoint**: `/api/v1/videos/upload/*`
- **Fallback**: Se não autenticado, usa IP

### Endpoints Autenticados (futuros)
- **Limite**: 1000 requisições/minuto por usuário
- **Uso**: Para endpoints que requerem autenticação mas não são uploads

## Implementação

### Arquitetura
- **Storage**: Cloudflare KV namespace (`CACHE`)
- **Middleware**: `/src/middleware/rate-limit.ts`
- **Configuração**: Pre-configurados para cada tipo de endpoint

### Rate Limiters Disponíveis

```typescript
import {
  publicRateLimit,        // 100/min por IP
  authenticatedRateLimit, // 1000/min por usuário
  uploadRateLimit,        // 10/min por usuário
  loginRateLimit,         // 10/min por IP
  registerRateLimit,      // 5/min por IP
} from './middleware/rate-limit';
```

### Headers de Resposta

Todos os endpoints com rate limiting retornam:
- `X-RateLimit-Limit`: Limite total
- `X-RateLimit-Remaining`: Requisições restantes
- `X-RateLimit-Reset`: Unix timestamp quando o limite reseta
- `Retry-After`: Segundos para retry (apenas em 429)

### Erro 429 - Too Many Requests

```json
{
  "error": {
    "message": "Too many requests. Please try again later.",
    "code": 429,
    "category": "RATE_LIMIT",
    "limit": 100,
    "remaining": 0,
    "reset": 1711537200,
    "retryAfter": 45,
    "timestamp": "2026-03-27T10:55:00.000Z"
  }
}
```

## Aplicação por Endpoint

| Endpoint | Rate Limiter | Limite | Janela | Chave |
|----------|--------------|--------|--------|-------|
| `/api/v1/auth/login` | `loginRateLimit` | 10 | 1 min | IP |
| `/api/v1/auth/register` | `registerRateLimit` | 5 | 1 min | IP |
| `/api/v1/videos/upload/*` | `uploadRateLimit` | 10 | 1 min | User ID |
| `/api/v1/*` (outros) | `publicRateLimit` | 100 | 1 min | IP |

## Dual Protection para Login

O endpoint `/login` possui **dupla proteção**:

1. **KV Rate Limiter** (novo): 10 req/min por IP
2. **D1 Rate Limiter** (existente): Brute force protection com account lockout

Ambos funcionam em conjunto para máxima segurança.

## Testes

Para testar rate limiting:

```bash
# Testar login rate limit (10 req/min)
for i in {1..12}; do
  curl -X POST https://api.framevideos.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -i
done

# Testar register rate limit (5 req/min)
for i in {1..7}; do
  curl -X POST https://api.framevideos.com/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test'$i'@example.com","password":"Test123!@#"}' \
    -i
done
```

## Monitoramento

Logs de rate limiting:
```
[RATE_LIMIT_EXCEEDED] {
  timestamp: "2026-03-27T10:55:00.000Z",
  key: "192.168.1.1",
  limit: 100,
  path: "/api/v1/videos",
  method: "GET"
}
```

## Considerações

- **Cloudflare KV**: Eventualmente consistente (pode ter delay de propagação)
- **TTL automático**: Entradas expiram automaticamente após a janela
- **Fallback gracioso**: Se KV não disponível, permite requisição (log warning)
- **Identificação de usuário**: Usa `tenantContext.userId` do middleware de autenticação

## Futuras Melhorias

- [ ] Rate limiting por tenant (multi-tenant)
- [ ] Whitelist de IPs confiáveis
- [ ] Rate limiting dinâmico baseado em plano (free/premium)
- [ ] Métricas de rate limiting no analytics
- [ ] Cache de rate limit em Workers Durable Objects (para maior precisão)
