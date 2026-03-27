# Melhorias de Isolamento de Tenant - Task 3.4

## Objetivo
Garantir isolamento completo de dados entre tenants, prevenindo vazamento de dados.

## Problemas Identificados

### 1. Queries sem validação de tenant
- `getUserById(id)` - não valida tenant
- `getAllVideos()` - retorna vídeos de todos os tenants
- `getCategoryById(id)` - não valida tenant
- `getTagById(id)` - não valida tenant
- `updateVideo(id, updates)` - validação opcional
- `deleteVideo(id)` - validação opcional
- `updateCategory(id, updates)` - sem validação
- `deleteCategory(id)` - sem validação

### 2. Métodos que precisam validação obrigatória de tenantId
Todos os métodos que acessam recursos específicos devem SEMPRE receber e validar tenantId:
- ✅ `getVideoById(id, tenantId)` - já tem, mas é opcional
- ❌ `getUserById(id)` - falta tenantId
- ❌ `getCategoryById(id)` - falta tenantId
- ❌ `getTagById(id)` - falta tenantId
- ❌ `updateVideo(id, updates)` - tenantId opcional
- ❌ `deleteVideo(id)` - tenantId opcional

## Melhorias Implementadas

### 1. Helper Functions (`helpers/tenant-query.ts`)
- ✅ `validateTenantId()` - valida formato UUID
- ✅ `validateTenantMatch()` - valida match entre resource e auth
- ✅ `validateResultTenant()` - valida resultado antes de retornar
- ✅ `filterByTenant()` - filtra arrays por tenant
- ✅ `validateResourceCreation()` - valida criação de recursos
- ✅ `logTenantQuery()` - log de auditoria

### 2. Middleware Improvements (`middleware/tenant-isolation.ts`)
- ✅ Validação de formato de tenantId
- ✅ Logs mais detalhados
- ✅ `validateNoTenantInBody()` - previne tenant injection
- ✅ `sanitizeTenantFromBody()` - remove tenantId do body

### 3. Database Layer Changes Needed

#### Tornar tenantId obrigatório em todos os métodos:

```typescript
// ANTES
async getVideoById(id: string, tenantId?: string): Promise<any | null>

// DEPOIS
async getVideoById(id: string, tenantId: string): Promise<any | null>
```

#### Adicionar validação em todos os métodos:

```typescript
async updateVideo(id: string, updates: any, tenantId: string): Promise<any | null> {
  validateTenantId(tenantId);
  
  // Buscar vídeo e validar ownership
  const video = await this.getVideoById(id, tenantId);
  if (!video) {
    throw new Error('Video not found or access denied');
  }
  
  // Prevenir alteração de tenantId
  if (updates.tenantId || updates.tenant_id) {
    throw new Error('Cannot modify tenantId');
  }
  
  // Update query com WHERE tenant_id
  await this.db
    .prepare(`
      UPDATE videos 
      SET title = ?, description = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `)
    .bind(updates.title, updates.description, new Date().toISOString(), id, tenantId)
    .run();
    
  return this.getVideoById(id, tenantId);
}
```

### 4. Remover métodos sem isolamento

Métodos como `getAllVideos()` não devem existir. Sempre usar `getVideosByTenant(tenantId)`.

## Checklist de Implementação

### Database Layer (database-d1.ts)
- [ ] Tornar tenantId obrigatório em todos os getById
- [ ] Adicionar validação em todos os updates
- [ ] Adicionar validação em todos os deletes
- [ ] Remover ou deprecar getAllVideos()
- [ ] Adicionar WHERE tenant_id em todas as queries
- [ ] Prevenir modificação de tenantId em updates
- [ ] Adicionar logs de auditoria

### Routes Layer
- [ ] Usar sanitizeTenantFromBody() em todos os POSTs/PUTs
- [ ] Validar que tenantId vem apenas do JWT
- [ ] Adicionar testes de isolamento para cada rota

### Tests
- [x] Criar tenant-isolation-comprehensive.test.ts
- [ ] Testar cross-tenant access em todos os recursos
- [ ] Testar tenant injection attacks
- [ ] Testar modificação de tenantId
- [ ] Testar search cross-tenant

### Documentation
- [ ] Documentar padrões de isolamento
- [ ] Criar guia de desenvolvimento seguro
- [ ] Adicionar exemplos de uso correto

## Padrões de Código

### ✅ CORRETO
```typescript
// Route
videos.get('/:id', tenantIsolation, async (c) => {
  const db = c.get('db');
  const { tenantId } = getTenantContext(c);
  const id = c.req.param('id');
  
  const video = await db.getVideoById(id, tenantId);
  if (!video) {
    throw new NotFoundError('Video not found');
  }
  
  return c.json(video);
});

// Database
async getVideoById(id: string, tenantId: string): Promise<any | null> {
  validateTenantId(tenantId);
  
  const result = await this.db
    .prepare('SELECT * FROM videos WHERE id = ? AND tenant_id = ?')
    .bind(id, tenantId)
    .first();
    
  return validateResultTenant(result, tenantId, 'video');
}
```

### ❌ INCORRETO
```typescript
// Route - NUNCA confiar em tenantId do body
videos.post('/', async (c) => {
  const body = await c.req.json();
  const { tenantId } = body; // ❌ VULNERABILIDADE!
  
  await db.createVideo({ ...body, tenantId });
});

// Database - NUNCA fazer query sem tenant_id
async getVideoById(id: string): Promise<any | null> {
  // ❌ VULNERABILIDADE! Pode retornar vídeo de outro tenant
  return await this.db
    .prepare('SELECT * FROM videos WHERE id = ?')
    .bind(id)
    .first();
}
```

## Métricas de Sucesso

- ✅ 100% das queries incluem tenant_id no WHERE
- ✅ 0 queries retornam dados de outro tenant
- ✅ Todos os testes de isolamento passam
- ✅ Logs de auditoria capturam todas as tentativas de acesso
- ✅ Middleware bloqueia requests sem tenant context
