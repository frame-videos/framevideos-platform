# Frame Videos — Sistema de Anúncios (Ads System)

## Arquitetura

O sistema de anúncios é self-serve e multi-tenant, permitindo que cada tenant tenha seus próprios anunciantes, campanhas e placements.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Tenant Site  │────▶│   API (Ads)  │────▶│     D1       │
│  (SSR/iframe) │     │   Hono       │     │  (Database)  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────┴───────┐
                     │   R2 (Media) │
                     │   KV (Cache) │
                     └──────────────┘
```

### Componentes

- **API Routes** (`apps/framevideos-api/src/routes/ads.ts`): CRUD de campanhas, criativos, placements, serving, tracking, revenue share
- **Tenant Admin** (`apps/tenant-admin/src/pages/Ad*.tsx`): Interface de gerenciamento para admins
- **Tenant Site** (`apps/tenant-site/src/helpers/ads.ts`): Rendering de ad slots via iframe
- **Advertiser Portal** (`apps/tenant-site/src/renderers/advertiser.ts`): Portal SSR white-label para anunciantes
- **Database** (`packages/db/migrations/009_ads_system.sql`): Tabelas de placements, impressions, clicks, stats, revenue

## Fluxo

### 1. Configuração (Admin)

1. Admin cria **placements** (posições no site: header, sidebar, in_content)
2. Admin ou anunciante cria **campanha** com orçamento e datas
3. Anunciante adiciona **criativos** (imagens/vídeos) à campanha
4. Admin aprova criativos → anunciante ativa

### 2. Serving

1. Página do tenant-site carrega com `<iframe>` apontando para `/api/v1/ads/serve?placement=X&tenant=Y`
2. API busca criativos ativos com budget restante
3. Seleção por **weighted random** (peso = budget - spent)
4. Retorna HTML com:
   - Imagem/vídeo do criativo
   - Click wrapper (`/api/v1/ads/track/click?c=X&p=Y`)
   - Tracking pixel (`/api/v1/ads/track/impression?c=X&p=Y`)

### 3. Tracking

- **Impressão**: GET no tracking pixel → registra em `ad_impressions` + incrementa `ad_daily_stats`
- **Click**: GET no click wrapper → registra em `ad_clicks` + incrementa stats + debita CPC do budget → redireciona 302
- **Rate limit**: 1 impressão por IP/creative/5min via KV
- **Privacy**: IP é hasheado com SHA-256 antes de armazenar

### 4. Revenue Share

- Configurável por tenant via `tenant_configs.ad_revenue_share_percent` (default: 70% tenant / 30% plataforma)
- Cálculo mensal via `POST /api/v1/ads/revenue/calculate` (super_admin)
- Armazenado em `ad_revenue_share` por mês/tenant

## API Reference

### Rotas Públicas (sem auth)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/ads/serve?placement=X&tenant=Y` | Serve anúncio (HTML) |
| GET | `/api/v1/ads/track/impression?c=X&p=Y` | Registra impressão (1x1 GIF) |
| GET | `/api/v1/ads/track/click?c=X&p=Y` | Registra click (302 redirect) |
| POST | `/api/v1/ads/track/impression?c=X&p=Y` | Registra impressão (204) |
| POST | `/api/v1/ads/track/click?c=X&p=Y` | Registra click (302 redirect) |

### Campanhas (auth: advertiser/tenant_admin/super_admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/ads/campaigns` | Listar campanhas |
| POST | `/api/v1/ads/campaigns` | Criar campanha |
| GET | `/api/v1/ads/campaigns/:id` | Detalhe da campanha |
| PUT | `/api/v1/ads/campaigns/:id` | Editar campanha |
| PATCH | `/api/v1/ads/campaigns/:id/status` | Alterar status |

### Criativos (auth: advertiser/tenant_admin/super_admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/ads/campaigns/:id/creatives` | Listar criativos |
| POST | `/api/v1/ads/campaigns/:id/creatives` | Criar criativo |
| PUT | `/api/v1/ads/creatives/:id` | Editar criativo |
| PATCH | `/api/v1/ads/creatives/:id/status` | Alterar status |
| POST | `/api/v1/ads/creatives/:id/upload` | Upload media (R2) |

### Placements (auth: tenant_admin/super_admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/ads/placements` | Listar placements |
| POST | `/api/v1/ads/placements` | Criar placement |
| PUT | `/api/v1/ads/placements/:id` | Editar placement |

### Relatórios (auth: advertiser/tenant_admin/super_admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/ads/reports/campaign/:id?days=30` | Stats por campanha |
| GET | `/api/v1/ads/reports/summary` | Resumo geral |

### Revenue Share

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/ads/revenue` | Relatório revenue share |
| POST | `/api/v1/ads/revenue/calculate` | Calcular (super_admin) |

## Placements

### Posições Suportadas

| Posição | Tamanho Padrão | Onde aparece |
|---------|----------------|--------------|
| `header` | 728×90 | Acima do conteúdo principal |
| `sidebar` | 300×250 | Lateral nas páginas de vídeo |
| `in_content` | 468×60 | Entre listagens de vídeos |
| `footer` | 728×90 | Rodapé |
| `overlay` | 320×480 | Sobreposição (popup) |

### Rendering no Tenant Site

Cada slot é renderizado como `<iframe>` sandboxed:
```html
<iframe src="/api/v1/ads/serve?placement=PLACEMENT_ID&tenant=TENANT_ID"
  width="728" height="90" frameborder="0" scrolling="no"
  sandbox="allow-popups allow-popups-to-escape-sandbox"
  loading="lazy">
</iframe>
```

## Revenue Share

### Configuração

Adicionar no `tenant_configs`:
```sql
INSERT INTO tenant_configs (id, tenant_id, config_key, config_value)
VALUES ('...', 'TENANT_ID', 'ad_revenue_share_percent', '70');
```

### Cálculo

O cálculo é feito mensalmente via API:
```bash
curl -X POST /api/v1/ads/revenue/calculate \
  -H "Authorization: Bearer TOKEN" \
  -d '{"month": "2026-03"}'
```

Fórmula:
- `total_revenue = SUM(spent_cents)` do mês
- `tenant_share = ROUND(total_revenue * share_percent / 100)`
- `platform_share = total_revenue - tenant_share`

## Modelo de Custos

- **CPC (Cost Per Click)**: R$ 0,10 por clique
- **Impressões**: Grátis (tracking apenas)
- **Orçamento mínimo**: R$ 1,00

## Tabelas D1

### Existentes (pré-sprint)
- `ad_campaigns` — Campanhas publicitárias
- `ad_creatives` — Criativos (imagens/vídeos)

### Novas (Migration 009)
- `ad_placements` — Posições de anúncio no site
- `ad_impressions` — Log de impressões
- `ad_clicks` — Log de clicks
- `ad_daily_stats` — Estatísticas agregadas por dia
- `ad_revenue_share` — Revenue share mensal

## Status Flows

### Campanha
```
draft → active → paused → active
  ↓        ↓        ↓
cancelled cancelled cancelled
```

### Criativo
```
pending_review → approved → active ↔ paused
      ↓              ↓
   rejected ← ─ ─ ─ ┘
      ↓
pending_review (resubmit)
```

## Segurança

- **IP Hashing**: SHA-256 para privacidade
- **Rate Limiting**: 1 impressão por IP/creative/5min via KV
- **Sandboxed iframes**: `sandbox="allow-popups allow-popups-to-escape-sandbox"`
- **Tenant isolation**: Todas as queries são tenant-scoped
- **Role-based access**: Advertisers só veem suas próprias campanhas
- **Upload validation**: Tipos e tamanhos restritos (imagens ≤2MB, vídeos ≤10MB)

## Advertiser Portal

Portal white-label SSR disponível em:
- `/advertiser/login` — Login
- `/advertiser/dashboard` — Dashboard com KPIs
- `/advertiser/campaigns` — Gerenciar campanhas
- `/advertiser/reports` — Relatórios de desempenho
