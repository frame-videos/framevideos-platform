# Tenant Lifecycle Management

**Task:** 3.5 - Tenant Lifecycle  
**Branch:** feature/task-3.5  
**Date:** 2026-03-27

## Visão Geral

Sistema completo de gerenciamento do ciclo de vida de tenants, incluindo:
- Suspensão de tenants
- Reativação de tenants
- Cancelamento de tenants
- Controle de acesso baseado em status
- Auditoria completa de mudanças de estado

## Estados do Tenant

### `active`
- Tenant funcionando normalmente
- Acesso completo ao sistema
- Estado padrão de novos tenants

### `suspended`
- Tenant temporariamente bloqueado
- Acesso negado (HTTP 403)
- Pode ser reativado
- Razão armazenada (ex: pagamento atrasado)

### `cancelled`
- Tenant permanentemente cancelado
- Acesso negado (HTTP 403)
- **NÃO** pode ser reativado
- Razão armazenada (ex: pedido do cliente)

### `pending`
- Estado inicial durante criação
- Reservado para uso futuro

## Transições de Estado

```
active ──suspend──> suspended
suspended ──reactivate──> active
active ──cancel──> cancelled
suspended ──cancel──> cancelled
```

### Transições Bloqueadas
- ❌ `cancelled` → `active` (não pode reativar cancelado)
- ❌ `cancelled` → `suspended` (não pode suspender cancelado)
- ❌ `suspended` → `suspended` (já está suspenso)
- ❌ `active` → `active` (já está ativo)

## Endpoints

### POST `/api/super-admin/tenants/:id/suspend`
Suspende um tenant ativo.

**Auth:** Requer role `super_admin`

**Request:**
```json
{
  "reason": "Payment overdue"
}
```

**Response:**
```json
{
  "message": "Tenant suspended successfully",
  "tenant": {
    "id": "uuid",
    "status": "suspended",
    "suspendedAt": "2026-03-27T12:00:00Z",
    "suspendedReason": "Payment overdue",
    ...
  }
}
```

### POST `/api/super-admin/tenants/:id/reactivate`
Reativa um tenant suspenso.

**Auth:** Requer role `super_admin`

**Response:**
```json
{
  "message": "Tenant reactivated successfully",
  "tenant": {
    "id": "uuid",
    "status": "active",
    "reactivatedAt": "2026-03-27T12:30:00Z",
    "suspendedAt": null,
    "suspendedReason": null,
    ...
  }
}
```

### POST `/api/super-admin/tenants/:id/cancel`
Cancela um tenant permanentemente.

**Auth:** Requer role `super_admin`

**Request:**
```json
{
  "reason": "Customer requested cancellation"
}
```

**Response:**
```json
{
  "message": "Tenant cancelled successfully",
  "tenant": {
    "id": "uuid",
    "status": "cancelled",
    "cancelledAt": "2026-03-27T13:00:00Z",
    "cancelledReason": "Customer requested cancellation",
    ...
  }
}
```

### GET `/api/super-admin/tenants/:id/lifecycle-log`
Retorna histórico completo de mudanças de estado.

**Auth:** Requer role `super_admin`

**Response:**
```json
{
  "tenantId": "uuid",
  "logs": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "action": "suspended",
      "previousStatus": "active",
      "newStatus": "suspended",
      "reason": "Payment overdue",
      "performedBy": "admin-user-id",
      "ipAddress": "192.168.1.1",
      "createdAt": "2026-03-27T12:00:00Z"
    },
    ...
  ]
}
```

## Controle de Acesso

O middleware `tenant-routing` bloqueia automaticamente acesso a tenants suspensos ou cancelados:

```typescript
// tenant-routing.ts
if (tenant.status === 'suspended') {
  return c.json({
    error: 'This account has been suspended. Please contact support.',
    code: 'TENANT_SUSPENDED',
  }, 403);
}

if (tenant.status === 'cancelled') {
  return c.json({
    error: 'This account has been cancelled.',
    code: 'TENANT_CANCELLED',
  }, 403);
}
```

## Auditoria

### Audit Events
Novos eventos adicionados ao `AuditEventType`:
- `TENANT_SUSPEND`
- `TENANT_REACTIVATE`
- `TENANT_CANCEL`

### Lifecycle Log
Tabela dedicada `tenant_lifecycle_log` registra:
- Todas as mudanças de estado
- Usuário que executou a ação
- IP address
- Razão da mudança
- Timestamp

## Schema Changes

### Migration: `009_add_tenant_lifecycle.sql`

```sql
-- Novos campos em tenants
ALTER TABLE tenants ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN suspended_at TEXT;
ALTER TABLE tenants ADD COLUMN suspended_reason TEXT;
ALTER TABLE tenants ADD COLUMN cancelled_at TEXT;
ALTER TABLE tenants ADD COLUMN cancelled_reason TEXT;
ALTER TABLE tenants ADD COLUMN reactivated_at TEXT;
ALTER TABLE tenants ADD COLUMN updated_at TEXT;

-- Nova tabela de log
CREATE TABLE tenant_lifecycle_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  performed_by TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

## Database Methods

### `D1Database.updateTenantStatus()`
Atualiza status e campos relacionados do tenant.

### `D1Database.logTenantLifecycleEvent()`
Registra evento no log de lifecycle.

### `D1Database.getTenantLifecycleLog()`
Retorna histórico de eventos do tenant.

## Testes

### `tenant-lifecycle.test.ts`
Suite completa de testes cobrindo:
- ✅ Suspensão de tenant ativo
- ✅ Bloqueio de acesso a tenant suspenso
- ✅ Reativação de tenant suspenso
- ✅ Cancelamento de tenant
- ✅ Bloqueio de acesso a tenant cancelado
- ✅ Validação de transições de estado
- ✅ Autorização (apenas super_admin)
- ✅ Lifecycle log

**Executar testes:**
```bash
cd backend
npm test tenant-lifecycle.test.ts
```

## Logging

Todos os eventos de lifecycle geram logs estruturados:

```typescript
console.log('[TENANT_SUSPENDED]', {
  timestamp: now,
  tenantId: id,
  reason: reason,
  performedBy: user?.id,
});
```

## Próximos Passos

### Futuras Melhorias
- [ ] Email notifications para admins do tenant
- [ ] Backup automático antes de cancelamento
- [ ] Soft delete com período de retenção (30 dias)
- [ ] Dashboard de lifecycle stats
- [ ] Agendamento de ações (ex: suspender em X dias)

### Integração com Billing
- [ ] Auto-suspender por falta de pagamento
- [ ] Auto-reativar após pagamento confirmado
- [ ] Avisos antes de suspensão

## Referências

- Epic: `/docs/epics/03-tenants-domains.md`
- Task: 3.5 - Tenant Lifecycle
- Migration: `backend/migrations/009_add_tenant_lifecycle.sql`
- Tests: `backend/tests/tenant-lifecycle.test.ts`
