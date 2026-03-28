# Migrations — Frame Videos

## Overview

O sistema de migrations gerencia o schema do banco D1 (SQLite) de forma versionada e reproduzível.

## Estrutura

```
packages/db/
├── migrations/           # Migrations versionadas (fonte da verdade)
│   ├── 001_initial_schema.sql
│   ├── 002_stripe_price_ids.sql
│   ├── 003_cf_hostname_id.sql
│   ├── 004_analytics.sql
│   ├── 005_email_newsletter.sql
│   ├── 006_llm_credits.sql
│   └── runner.ts         # Migration runner (Node.js)
└── src/
    └── migrations/       # Cópia legada (manter sincronizado)
        ├── 001_initial_schema.sql
        ├── 002_stripe_price_ids.sql
        └── 003_cf_hostname_id.sql

scripts/
└── migrate.sh            # Script shell para rodar migrations
```

## Convenções

### Nomenclatura de arquivos

```
NNN_description.sql
```

- `NNN` — número sequencial com 3 dígitos (001, 002, ...)
- `description` — nome descritivo em snake_case
- Extensão `.sql`

### Conteúdo do arquivo SQL

- Use `CREATE TABLE IF NOT EXISTS` para tabelas novas
- Use `CREATE INDEX IF NOT EXISTS` para índices
- Cada migration deve ser **idempotente** quando possível
- Termine com `INSERT INTO _migrations (name) VALUES ('NNN_description');`
- Comente o propósito no topo do arquivo

### Tabela `_migrations`

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Registra quais migrations já foram aplicadas. O runner verifica esta tabela antes de executar.

## Como usar

### Via script shell (recomendado)

```bash
# Configurar variáveis de ambiente
export CF_ACCOUNT_ID="..."
export CF_API_TOKEN="..."
export D1_DATABASE_ID="dae9bd51-c863-42b0-b5b6-21f4569aa6c9"

# Rodar migrations pendentes
./scripts/migrate.sh

# Dry run — ver o que seria aplicado
./scripts/migrate.sh --dry-run
```

### Via runner TypeScript

```bash
CF_ACCOUNT_ID="..." CF_API_TOKEN="..." D1_DATABASE_ID="..." \
  npx tsx packages/db/migrations/runner.ts
```

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `CF_ACCOUNT_ID` | ID da conta Cloudflare |
| `CF_API_TOKEN` | Token da API com permissão D1 write |
| `D1_DATABASE_ID` | ID do banco D1 (`dae9bd51-c863-42b0-b5b6-21f4569aa6c9`) |

## Criando uma nova migration

1. Crie o arquivo `packages/db/migrations/NNN_description.sql`
2. Use o próximo número sequencial disponível
3. Use `IF NOT EXISTS` / `IF EXISTS` quando possível
4. Adicione `INSERT INTO _migrations (name) VALUES ('NNN_description');` no final
5. Teste localmente com `--dry-run` antes de aplicar em produção
6. Commit e push — migrations rodam manualmente (não automático no deploy)

## Histórico de migrations

| # | Nome | Descrição |
|---|---|---|
| 001 | `initial_schema` | Schema completo: tenants, users, sessions, domains, videos, categories, tags, performers, channels, pages, plans, subscriptions, llm_wallets, llm_transactions, ads, crawler, audit |
| 002 | `stripe_price_ids` | Adiciona `stripe_price_id`, `billing_interval` aos planos + `stripe_customer_id` ao tenant |
| 003 | `cf_hostname_id` | Adiciona `cf_hostname_id` à tabela domains |
| 004 | `analytics` | Tabelas `page_views` e `daily_stats` |
| 005 | `email_newsletter` | Tabelas `email_templates`, `email_log`, `newsletter_subscribers`, `newsletter_campaigns`, `newsletter_sends`, `monitoring_checks`, `monitoring_incidents` |
| 006 | `llm_credits` | Adiciona `operation_type` a `llm_transactions` + tabela `llm_usage_log` |

## Notas importantes

- **Não use `wrangler d1 migrations`** — usamos nosso próprio sistema de tracking
- **Não crie tabelas via curl** — sempre use migrations versionadas
- **SQLite não suporta** `ALTER TABLE ... DROP COLUMN` (antes do 3.35.0) nem `ALTER TABLE ... ADD CONSTRAINT`
- Para mudanças destrutivas em constraints, crie nova tabela + migre dados + drop antiga
- Migrations são executadas **sequencialmente** — ordem importa
- Em caso de falha, o runner para imediatamente — corrija e re-execute
