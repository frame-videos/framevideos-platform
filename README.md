# Frame Videos

Plataforma SaaS multi-tenant para criação e gerenciamento de sites de vídeos. Infraestrutura 100% Cloudflare.

## Stack

- **Runtime:** Cloudflare Workers
- **API:** Hono
- **Frontend:** Astro + React
- **Linguagem:** TypeScript (strict mode)
- **Monorepo:** Turborepo + pnpm
- **Banco de dados:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2
- **Cache:** Cloudflare KV
- **CI/CD:** GitHub Actions

## Pré-requisitos

- Node.js >= 22
- pnpm >= 9.15

## Setup

```bash
# Instalar dependências
pnpm install

# Rodar em desenvolvimento
pnpm dev
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Inicia todos os apps em modo desenvolvimento |
| `pnpm build` | Build de todos os packages e apps |
| `pnpm test` | Roda todos os testes |
| `pnpm test:unit` | Roda testes unitários |
| `pnpm lint` | Linting em todo o monorepo |
| `pnpm typecheck` | Verificação de tipos TypeScript |
| `pnpm format` | Formata código com Prettier |
| `pnpm format:check` | Verifica formatação |
| `pnpm clean` | Limpa builds e node_modules |

## Estrutura do Monorepo

```
framevideos-platform/
├── apps/
│   ├── framevideos-api/      # API principal (Cloudflare Worker + Hono)
│   ├── framevideos-web/       # Site institucional (Astro)
│   ├── tenant-admin/          # Painel administrativo do tenant (React)
│   ├── tenant-site/           # Site público do tenant (Astro)
│   └── advertiser-portal/     # Portal do anunciante (React)
├── packages/
│   ├── shared/                # Tipos, constantes, utils compartilhados
│   ├── db/                    # Cliente D1, migrations, middleware
│   ├── auth/                  # Autenticação, JWT, RBAC
│   ├── seo/                   # SEO e meta tags
│   ├── i18n/                  # Internacionalização
│   ├── billing/               # Integração Stripe
│   ├── ads/                   # Sistema de anúncios
│   ├── analytics/             # Analytics e métricas
│   ├── llm/                   # Integração com LLMs
│   └── ui/                    # Componentes UI compartilhados
├── .github/workflows/         # CI/CD pipelines
├── turbo.json                 # Configuração Turborepo
├── tsconfig.base.json         # TypeScript base config
└── package.json               # Root package
```

## Deploy

**Deploy é feito APENAS via GitHub Actions.** Nunca faça deploy local.

- Push para `main` → deploy automático para produção
- Pull Requests → CI roda typecheck, lint e testes

## Licença

UNLICENSED — Projeto privado.
