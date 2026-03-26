# 🚀 CI/CD Pipeline Documentation

**Status**: ✅ Implemented & Ready  
**Date**: 2026-03-25  
**Version**: 1.0

---

## 📋 Overview

Este documento descreve o pipeline de CI/CD automatizado para Frame Videos, implementado com GitHub Actions.

### O que é CI/CD?

- **CI (Continuous Integration)**: Testes e validação automática a cada push
- **CD (Continuous Deployment)**: Deploy automático para produção

---

## 🎯 Objetivos do Pipeline

✅ **Qualidade de Código**
- Validação de sintaxe (ESLint)
- Type checking (TypeScript)
- Testes automatizados (Jest/Vitest)

✅ **Segurança**
- Scan de vulnerabilidades (npm audit)
- Dependency checking (OWASP)

✅ **Deploy Automático**
- Deploy backend para Cloudflare Workers
- Deploy frontend para Cloudflare Pages

✅ **Notificações**
- Slack notifications (opcional)
- GitHub Actions UI

---

## 🔄 Fluxo do Pipeline

```
Push para GitHub
    ↓
┌─────────────────────────────────────┐
│  Lint & Type Check (Paralelo)       │
│  - Backend ESLint                   │
│  - Frontend ESLint                  │
│  - TypeScript checking              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Tests (Paralelo)                   │
│  - Backend unit tests               │
│  - Frontend unit tests              │
│  - Coverage reports                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Build (Paralelo)                   │
│  - Backend build                    │
│  - Frontend build                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Security Check                     │
│  - npm audit                        │
│  - OWASP scan                       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Deploy (Somente main branch)       │
│  - Backend → Cloudflare Workers     │
│  - Frontend → Cloudflare Pages      │
└─────────────────────────────────────┘
    ↓
✅ Pipeline Completo
```

---

## 📊 Jobs Detalhados

### 1. Backend Lint & Type Check
**Arquivo**: `.github/workflows/ci-cd.yml` → `backend-lint`

```yaml
- ESLint validation
- TypeScript type checking
- Rápido (~2-3 min)
- Falha se houver erros
```

**Executado em**: Todos os pushes

---

### 2. Backend Tests
**Arquivo**: `.github/workflows/ci-cd.yml` → `backend-test`

```yaml
- npm test (Jest/Vitest)
- Coverage report generation
- Upload para Codecov (opcional)
- ~5-10 min
```

**Executado em**: Todos os pushes (após lint passar)

---

### 3. Backend Build
**Arquivo**: `.github/workflows/ci-cd.yml` → `backend-build`

```yaml
- npm run build
- Gera dist/ para Cloudflare Workers
- Upload artifact para reuso
- ~5-10 min
```

**Executado em**: Todos os pushes (após lint passar)

---

### 4. Frontend Lint & Type Check
**Arquivo**: `.github/workflows/ci-cd.yml` → `frontend-lint`

```yaml
- ESLint validation
- TypeScript type checking
- ~2-3 min
```

**Executado em**: Todos os pushes

---

### 5. Frontend Tests
**Arquivo**: `.github/workflows/ci-cd.yml` → `frontend-test`

```yaml
- npm test (Jest/Vitest)
- ~5-10 min
```

**Executado em**: Todos os pushes (após lint passar)

---

### 6. Frontend Build
**Arquivo**: `.github/workflows/ci-cd.yml` → `frontend-build`

```yaml
- npm run build (Next.js)
- Gera .next/ para Cloudflare Pages
- Upload artifact para reuso
- ~5-10 min
```

**Executado em**: Todos os pushes (após lint passar)

---

### 7. Security Check
**Arquivo**: `.github/workflows/ci-cd.yml` → `security-check`

```yaml
- npm audit (vulnerabilidades)
- OWASP Dependency Check
- Continue on error (não falha pipeline)
- ~5-10 min
```

**Executado em**: Todos os pushes

---

### 8. Deploy Backend
**Arquivo**: `.github/workflows/ci-cd.yml` → `deploy-backend`

```yaml
- Roda SOMENTE em main branch
- Roda SOMENTE em push (não em PR)
- npm run build
- npx wrangler deploy
- Deploy para Cloudflare Workers
- ~3-5 min
```

**Executado em**: main branch push (após testes passarem)

---

### 9. Deploy Frontend
**Arquivo**: `.github/workflows/ci-cd.yml` → `deploy-frontend`

```yaml
- Roda SOMENTE em main branch
- Roda SOMENTE em push (não em PR)
- npm run build (Next.js)
- Deploy para Cloudflare Pages
- ~3-5 min
```

**Executado em**: main branch push (após testes passarem)

---

### 10. Notify
**Arquivo**: `.github/workflows/ci-cd.yml` → `notify`

```yaml
- Verifica se todos os jobs passaram
- Falha se algum job crítico falhou
- Envia Slack notification (opcional)
- ~1 min
```

**Executado em**: Sempre (ao final)

---

## 🔐 Secrets Necessários

| Secret | Valor | Obter em |
|--------|-------|----------|
| `CLOUDFLARE_API_TOKEN` | API token | https://dash.cloudflare.com/profile/api-tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID | https://dash.cloudflare.com/ |
| `SLACK_WEBHOOK_URL` | Webhook URL | https://api.slack.com/apps (opcional) |

**Configurar em**: GitHub → Settings → Secrets and variables → Actions

---

## 📈 Timing Esperado

### Pull Request (develop branch)
- Lint: 2-3 min
- Tests: 5-10 min
- Build: 5-10 min
- Security: 5-10 min
- **Total**: ~20-30 min
- **Deploy**: ❌ Não roda

### Main Branch Push
- Lint: 2-3 min
- Tests: 5-10 min
- Build: 5-10 min
- Security: 5-10 min
- Deploy: 3-5 min
- **Total**: ~30-40 min
- **Deploy**: ✅ Automático

---

## 🎯 Triggers

### Quando o Pipeline Roda?

```yaml
on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main
      - develop
```

**Roda em:**
- ✅ Push para `main`
- ✅ Push para `develop`
- ✅ Pull request para `main`
- ✅ Pull request para `develop`

**NÃO roda em:**
- ❌ Push para outras branches
- ❌ Tags

---

## 🚀 Como Usar

### 1. Configurar Secrets
```bash
# GitHub → Settings → Secrets and variables → Actions
# Adicionar:
# - CLOUDFLARE_API_TOKEN
# - CLOUDFLARE_ACCOUNT_ID
```

### 2. Push para GitHub
```bash
git add .
git commit -m "feat: new feature"
git push origin main
```

### 3. Monitorar Pipeline
```
GitHub → Actions → CI/CD Pipeline
```

### 4. Verificar Deploy
```
# Backend
https://frame-videos-prod.frame-videos.workers.dev

# Frontend
https://production.frame-videos-frontend.pages.dev
```

---

## 📊 Visualizar Resultados

### No GitHub
1. Vá para: **Actions → CI/CD Pipeline**
2. Clique no workflow que rodou
3. Veja status de cada job
4. Clique em um job para ver logs

### No Terminal
```bash
# Ver status local
git log --oneline

# Clonar e testar localmente
npm ci
npm run lint
npm test
npm run build
```

---

## ❌ Troubleshooting

### Build falha com "npm ci"
**Problema**: Não consegue instalar dependências  
**Solução**:
```bash
rm -rf node_modules package-lock.json
npm install
npm ci
```

### Tests falham
**Problema**: Testes falhando no CI mas passando localmente  
**Solução**:
```bash
# Executar localmente como CI
npm ci
npm run lint
npm test
npm run build
```

### Deploy falha com "Invalid token"
**Problema**: Cloudflare token inválido ou expirado  
**Solução**:
1. Gerar novo token em: https://dash.cloudflare.com/profile/api-tokens
2. Atualizar secret no GitHub
3. Fazer novo push

### Deploy falha com "Not found"
**Problema**: Projeto Cloudflare não existe  
**Solução**:
1. Verificar nome do projeto em `wrangler.toml`
2. Verificar se projeto existe em Cloudflare Dashboard
3. Criar projeto se necessário

---

## 🔄 Próximas Melhorias

### Curto Prazo
- [ ] Adicionar E2E tests com Playwright
- [ ] Adicionar performance benchmarks
- [ ] Adicionar changelog generation

### Médio Prazo
- [ ] SonarQube integration
- [ ] Automated security scanning
- [ ] Docker image building
- [ ] Staging environment deploy

### Longo Prazo
- [ ] Blue-green deployment
- [ ] Canary releases
- [ ] Automated rollback
- [ ] Performance monitoring

---

## 📚 Referências

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Jest Testing](https://jestjs.io/)

---

**Status**: ✅ **PRONTO PARA PRODUÇÃO**

_Última atualização: 2026-03-25_
