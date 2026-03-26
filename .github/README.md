# 🚀 GitHub Actions Workflows

Este diretório contém todos os workflows de CI/CD para Frame Videos.

## 📋 Workflows Disponíveis

### 1. **CI/CD Pipeline** (`ci-cd.yml`)
Pipeline principal que roda em todos os pushes e pull requests.

**O que faz:**
- ✅ Lint & type checking (backend + frontend)
- ✅ Unit tests (backend + frontend)
- ✅ Build (backend + frontend)
- ✅ Security checks (npm audit + OWASP)
- ✅ Deploy automático (somente main branch)

**Quando roda:**
- Push para `main` ou `develop`
- Pull request para `main` ou `develop`

**Tempo esperado:**
- PR: ~20-30 min
- Main push: ~30-40 min (inclui deploy)

---

### 2. **Tests & Coverage** (`tests.yml`)
Workflow detalhado de testes com coverage reports.

**O que faz:**
- ✅ Unit tests (Node 20 + 22)
- ✅ Coverage reports (Codecov)
- ✅ Integration tests
- ✅ E2E tests (Playwright)

**Quando roda:**
- Push para `main` ou `develop`
- Pull request para `main` ou `develop`

**Tempo esperado:**
- ~15-25 min

---

### 3. **CodeQL Security** (`codeql.yml`)
Análise de segurança com CodeQL.

**O que faz:**
- ✅ Security scanning (JavaScript/TypeScript)
- ✅ Detecção de vulnerabilidades
- ✅ Code quality analysis

**Quando roda:**
- Push para `main` ou `develop`
- Pull request para `main` ou `develop`
- Agendado: Segunda-feira 2 AM UTC

**Tempo esperado:**
- ~10-15 min

---

## 🔐 Configuração Necessária

### Secrets do GitHub
Você precisa configurar os seguintes secrets em:
**Settings → Secrets and variables → Actions**

1. **CLOUDFLARE_API_TOKEN**
   - Obter em: https://dash.cloudflare.com/profile/api-tokens

2. **CLOUDFLARE_ACCOUNT_ID**
   - Obter em: https://dash.cloudflare.com/
   - Valor: `54150e744dccd84f0ae67d6dcd485bf3`

3. **SLACK_WEBHOOK_URL** (Opcional)
   - Para notificações no Slack
   - Obter em: https://api.slack.com/apps

---

## 📊 Visualizar Resultados

### No GitHub
1. Vá para: **Actions**
2. Clique no workflow que quer ver
3. Clique na execução
4. Veja logs de cada job

### Status Badge
Adicione ao seu README.md:
```markdown
[![CI/CD Pipeline](https://github.com/framevideos-platform/framevideos/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/framevideos-platform/framevideos/actions/workflows/ci-cd.yml)
```

---

## 🎯 Fluxo Típico

### 1. Desenvolvimento Local
```bash
git checkout -b feature/my-feature
# ... fazer mudanças ...
npm run lint
npm test
npm run build
```

### 2. Push para GitHub
```bash
git add .
git commit -m "feat: my feature"
git push origin feature/my-feature
```

### 3. Pull Request
- Cria PR para `develop`
- CI/CD pipeline roda automaticamente
- Espera todos os checks passarem ✅

### 4. Merge para Develop
```bash
# Após aprovação do PR
git checkout develop
git merge feature/my-feature
git push origin develop
```

### 5. Deploy para Produção
```bash
git checkout main
git merge develop
git push origin main
# ✅ Deploy automático para Cloudflare!
```

---

## ❌ Troubleshooting

### Build falha
**Problema**: Erro no build  
**Solução**:
```bash
npm ci
npm run build
# Verificar erro localmente
```

### Tests falham
**Problema**: Testes falhando no CI  
**Solução**:
```bash
npm ci
npm test
# Rodar localmente e debugar
```

### Deploy falha
**Problema**: Erro no deploy  
**Solução**:
1. Verificar secrets no GitHub
2. Verificar credenciais Cloudflare
3. Verificar wrangler.toml
4. Testar localmente: `wrangler deploy`

---

## 📚 Documentação Completa

- **[CI_CD_PIPELINE.md](../docs/CI_CD_PIPELINE.md)** - Documentação detalhada do pipeline
- **[SECRETS_SETUP.md](./SECRETS_SETUP.md)** - Como configurar secrets
- **[GitHub Actions Docs](https://docs.github.com/en/actions)** - Documentação oficial

---

## 🔄 Próximas Melhorias

- [ ] Adicionar performance benchmarks
- [ ] Adicionar SonarQube integration
- [ ] Adicionar automated changelog
- [ ] Adicionar staging environment
- [ ] Adicionar blue-green deployment

---

**Status**: ✅ **PRONTO PARA PRODUÇÃO**

_Última atualização: 2026-03-26_
