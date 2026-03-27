# Tenant Routing - Domain-based Multi-tenancy

## Overview

O sistema de **Tenant Routing** detecta automaticamente o tenant baseado no domínio do request (Host header) e injeta o `tenantId` no contexto de todas as requisições.

## Como Funciona

### 1. Middleware `tenant-routing.ts`

Aplicado **ANTES** de todas as rotas em `/api/v1/*`:

```typescript
app.use('/api/v1/*', tenantRouting);
```

### 2. Detecção de Domínio

O middleware:
1. Extrai o header `Host` do request
2. Remove porta se presente (`localhost:8787` → `localhost`)
3. Busca tenant no banco de dados:
   - Primeiro: `custom_domain` (domínios customizados ativos)
   - Segundo: `domain` (domínio padrão framevideos.com)
4. Se não encontrar: retorna **404 Not Found**

### 3. Contexto Injetado

```typescript
interface DomainTenantContext {
  tenantId: string;           // ID do tenant
  tenantDomain: string;       // Domínio usado no request
  isCustomDomain: boolean;    // true se custom_domain, false se domain padrão
}
```

## Uso nas Rotas

### Rotas Públicas (sem autenticação)

Use `getTenantIdFromDomain()` para filtrar por tenant:

```typescript
import { getTenantIdFromDomain } from '../middleware/tenant-routing';

// Buscar vídeos do tenant do domínio
videosSearch.get('/', async (c) => {
  const tenantId = getTenantIdFromDomain(c);
  const videos = await db.getVideosByTenant(tenantId);
  return c.json({ videos });
});
```

### Rotas Autenticadas

Use `validateDomainTenantMatch()` após `authenticate` para garantir que o JWT pertence ao tenant do domínio:

```typescript
import { authenticate } from '../middleware/auth';
import { validateDomainTenantMatch } from '../middleware/tenant-routing';

videos.post('/', authenticate, async (c) => {
  validateDomainTenantMatch(c); // Valida JWT vs domínio
  
  const user = c.get('user');
  const tenantId = user.tenantId; // Garantido que pertence ao domínio
  
  // ... criar vídeo
});
```

## Exemplos de Uso

### Acesso via Domínio Padrão

```bash
curl https://framevideos.com/api/v1/videos/search
# tenantId: extraído do tenant com domain='framevideos.com'
```

### Acesso via Domínio Customizado

```bash
curl https://meusite.com/api/v1/videos/search
# tenantId: extraído do tenant com custom_domain='meusite.com'
```

### Domínio Não Configurado

```bash
curl https://unknown.com/api/v1/videos/search
# Response: 404 Not Found - Domain not configured: unknown.com
```

## Segurança

### Isolamento por Domínio

- Cada domínio acessa **apenas** os dados do seu tenant
- Impossível acessar dados de outro tenant mudando o domínio
- Logs de auditoria registram domínio + tenantId

### Validação JWT vs Domínio

Para rotas autenticadas:
- JWT contém `tenantId` do usuário
- Middleware valida que `JWT.tenantId === domainTenantId`
- Se diferente: erro 403 (usuário não pertence ao domínio)

### Proteção contra Spoofing

- Host header é confiável no Cloudflare Workers
- Custom domains validados com status `active`
- SSL/TLS gerenciado pelo Cloudflare for SaaS

## Fluxo Completo

```
1. Request chega: Host: meusite.com
   ↓
2. tenant-routing middleware
   ↓
3. Busca tenant com custom_domain='meusite.com'
   ↓
4. Injeta { tenantId: 'xyz', tenantDomain: 'meusite.com', isCustomDomain: true }
   ↓
5. Rotas usam getTenantIdFromDomain(c) → 'xyz'
   ↓
6. Queries filtram por tenant_id='xyz'
   ↓
7. Response retorna apenas dados do tenant 'xyz'
```

## Testando

### Local (wrangler dev)

```bash
# Simular domínio padrão
curl http://localhost:8787/api/v1/videos/search \
  -H "Host: framevideos.com"

# Simular custom domain
curl http://localhost:8787/api/v1/videos/search \
  -H "Host: meusite.com"
```

### Produção

```bash
# Domínio padrão
curl https://framevideos.com/api/v1/videos/search

# Custom domain (após configurar DNS + Cloudflare)
curl https://meusite.com/api/v1/videos/search
```

## Monitoramento

Logs são registrados em cada roteamento:

```json
{
  "message": "[TENANT_ROUTING] Routed:",
  "domain": "meusite.com",
  "tenantId": "xyz",
  "isCustomDomain": true,
  "timestamp": "2026-03-27T11:40:00.000Z"
}
```

Domínios não encontrados são registrados como warnings:

```json
{
  "message": "[TENANT_ROUTING] Domain not found:",
  "domain": "unknown.com",
  "timestamp": "2026-03-27T11:40:00.000Z",
  "ip": "203.0.113.42"
}
```

## Próximos Passos

1. ✅ Middleware criado e aplicado
2. ✅ Rotas públicas usando `getTenantIdFromDomain()`
3. ⏳ Testar em dev com múltiplos domínios
4. ⏳ Deploy e teste em produção
5. ⏳ Configurar custom domains no Cloudflare
6. ⏳ Monitorar logs e performance

---

**Autor:** Rublo 🪙  
**Data:** 2026-03-27  
**Status:** Implementado ✅
