# Cloudflare for SaaS - Custom Domains

Este documento descreve como configurar e usar o Cloudflare for SaaS para permitir que tenants usem seus próprios domínios personalizados no Frame Videos.

## O que é Cloudflare for SaaS?

Cloudflare for SaaS permite que aplicações SaaS ofereçam custom hostnames aos seus clientes, com certificados SSL automáticos e gerenciamento simplificado. Cada tenant pode usar seu próprio domínio (ex: `videos.cliente.com`) apontando para a infraestrutura do Frame Videos.

## Pré-requisitos

1. **Conta Cloudflare com plano Enterprise ou acesso ao for SaaS**
2. **Zone ID** da sua zona principal (ex: `framevideos.com`)
3. **API Token** com permissões:
   - `Zone.SSL and Certificates`
   - `Zone.Custom Hostnames`

## Configuração Inicial no Dashboard da Cloudflare

### 1. Ativar SSL for SaaS

1. Acesse o dashboard da Cloudflare
2. Selecione sua zona (ex: `framevideos.com`)
3. Vá em **SSL/TLS** → **Custom Hostnames**
4. Clique em **Enable SSL for SaaS**
5. Configure o **Fallback Origin** (servidor que receberá as requisições):
   - Ex: `framevideos.com` ou seu Workers custom domain

### 2. Criar API Token

1. Vá em **My Profile** → **API Tokens**
2. Clique em **Create Token**
3. Use o template **Edit zone DNS** ou crie um customizado com:
   - Permissions:
     - `Zone - SSL and Certificates - Edit`
     - `Zone - Custom Hostnames - Edit`
   - Zone Resources:
     - Include - Specific zone - `framevideos.com`
4. Copie o token gerado

### 3. Configurar Variáveis de Ambiente

Adicione ao seu `wrangler.toml` ou secrets:

```toml
[vars]
CLOUDFLARE_ZONE_ID = "your-zone-id"

# Secrets (use wrangler secret put)
# CLOUDFLARE_API_TOKEN = "your-api-token"
```

Para adicionar o secret:

```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

## Como Funciona o Fluxo

### 1. Tenant Adiciona Custom Domain

**Request:**
```bash
POST /api/v1/tenants/:tenantId/domain
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "customDomain": "videos.cliente.com"
}
```

**O que acontece:**
1. Backend valida o domínio
2. Cria custom hostname na Cloudflare via API
3. Cloudflare retorna instruções de validação (DNS records)
4. Salva no banco: `custom_domain`, `custom_domain_status: 'pending'`
5. Retorna instruções para o tenant configurar DNS

**Response:**
```json
{
  "message": "Custom domain added successfully",
  "domain": "videos.cliente.com",
  "status": "pending",
  "validation": {
    "type": "cname",
    "name": "videos.cliente.com",
    "value": "framevideos.com"
  },
  "ssl": {
    "status": "pending_validation",
    "method": "http"
  }
}
```

### 2. Tenant Configura DNS

O tenant precisa adicionar um registro CNAME no DNS do domínio dele:

```
Type: CNAME
Name: videos (ou @ se for root domain)
Value: framevideos.com (seu fallback origin)
TTL: Auto
```

**Importante:** Se for root domain (ex: `cliente.com`), alguns provedores DNS não permitem CNAME. Nesse caso, use CNAME flattening ou ALIAS record.

### 3. Validação Automática

A Cloudflare valida automaticamente:
- **DNS Validation**: Verifica se o CNAME aponta corretamente
- **SSL Certificate**: Emite certificado SSL automaticamente (Let's Encrypt)

Esse processo leva de **alguns minutos a 24 horas**.

### 4. Verificar Status

**Request:**
```bash
GET /api/v1/tenants/:tenantId/domain
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "domain": "videos.cliente.com",
  "status": "active",
  "ssl": {
    "status": "active",
    "issuer": "Let's Encrypt",
    "expires_at": "2026-06-27T00:00:00Z"
  },
  "verification": {
    "verified": true,
    "verified_at": "2026-03-27T12:00:00Z"
  }
}
```

**Possíveis status:**
- `pending`: Aguardando configuração DNS
- `active`: Domínio ativo e SSL válido
- `failed`: Falha na validação (DNS incorreto, timeout, etc)

### 5. Remover Custom Domain

**Request:**
```bash
DELETE /api/v1/tenants/:tenantId/domain
Authorization: Bearer <admin-token>
```

Remove o custom hostname da Cloudflare e limpa os campos do banco.

## API da Cloudflare

### Adicionar Custom Hostname

```bash
POST https://api.cloudflare.com/client/v4/zones/:zone_id/custom_hostnames
Authorization: Bearer <api-token>
Content-Type: application/json

{
  "hostname": "videos.cliente.com",
  "ssl": {
    "method": "http",
    "type": "dv",
    "settings": {
      "http2": "on",
      "min_tls_version": "1.2",
      "tls_1_3": "on"
    }
  }
}
```

**Response:**
```json
{
  "result": {
    "id": "custom-hostname-id",
    "hostname": "videos.cliente.com",
    "ssl": {
      "status": "pending_validation",
      "method": "http",
      "type": "dv"
    },
    "status": "pending",
    "verification_errors": [],
    "ownership_verification": {
      "type": "txt",
      "name": "_cf-custom-hostname.videos.cliente.com",
      "value": "verification-token"
    }
  },
  "success": true
}
```

### Verificar Status

```bash
GET https://api.cloudflare.com/client/v4/zones/:zone_id/custom_hostnames/:hostname_id
Authorization: Bearer <api-token>
```

### Remover Custom Hostname

```bash
DELETE https://api.cloudflare.com/client/v4/zones/:zone_id/custom_hostnames/:hostname_id
Authorization: Bearer <api-token>
```

## Troubleshooting

### Domínio fica em "pending" por muito tempo

**Causas comuns:**
1. CNAME não configurado ou incorreto
2. Propagação DNS ainda em andamento
3. Domínio protegido por CAA record que bloqueia Let's Encrypt

**Solução:**
```bash
# Verificar CNAME
dig videos.cliente.com CNAME

# Verificar CAA records
dig cliente.com CAA

# Se houver CAA, adicionar:
# cliente.com. CAA 0 issue "letsencrypt.org"
# cliente.com. CAA 0 issuewild "letsencrypt.org"
```

### SSL não valida

**Causas:**
1. Domínio não aponta para o fallback origin
2. CAA record bloqueando
3. Domínio em lista de bloqueio

**Solução:**
- Verificar CNAME
- Aguardar até 24h
- Verificar CAA records
- Testar com `curl -I https://videos.cliente.com`

### Erro "too many custom hostnames"

Cada zona tem um limite de custom hostnames. No plano Enterprise, geralmente é ilimitado, mas pode haver soft limits.

**Solução:** Contatar suporte da Cloudflare para aumentar limite.

## Segurança

### Validação de Ownership

A Cloudflare valida que o tenant realmente controla o domínio através de:
1. **CNAME validation**: Domínio deve apontar para seu fallback origin
2. **TXT record** (opcional): `_cf-custom-hostname.domain.com`

### Proteção contra Abuse

Implemente rate limiting na API:
- Máximo de 1 custom domain por tenant
- Máximo de 5 tentativas de adicionar domain por dia
- Validar formato do domínio (não permitir IPs, localhost, etc)

### Isolamento

Cada tenant só pode:
- Ver seu próprio custom domain
- Modificar seu próprio custom domain
- Apenas admins do tenant podem gerenciar

## Referências

- [Cloudflare for SaaS Docs](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
- [Custom Hostnames API](https://developers.cloudflare.com/api/operations/custom-hostnames-for-a-zone-create-custom-hostname)
- [SSL for SaaS](https://developers.cloudflare.com/ssl/ssl-for-saas/)

## Exemplo de Uso Completo

```bash
# 1. Admin adiciona custom domain para tenant
curl -X POST https://api.framevideos.com/api/v1/tenants/tenant-123/domain \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{"customDomain": "videos.cliente.com"}'

# Resposta: instruções de configuração DNS

# 2. Tenant configura CNAME no DNS dele
# videos.cliente.com -> framevideos.com

# 3. Aguardar validação (alguns minutos)

# 4. Verificar status
curl https://api.framevideos.com/api/v1/tenants/tenant-123/domain \
  -H "Authorization: Bearer admin-token"

# 5. Quando status = "active", domínio está pronto!
# https://videos.cliente.com agora funciona com SSL válido
```

## Próximos Passos

- [ ] Implementar webhook da Cloudflare para atualizar status automaticamente
- [ ] Dashboard para tenant ver status de validação
- [ ] Suporte a múltiplos custom domains por tenant
- [ ] Renovação automática de certificados (já é automático pela Cloudflare)
