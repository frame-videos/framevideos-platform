# DNS Setup - framevideos.com

## ✅ Cloudflare Nameservers

**Adicione estes nameservers no Dynadot:**

```
colette.ns.cloudflare.com
henry.ns.cloudflare.com
```

**Passos no Dynadot:**
1. Acesse: https://www.dynadot.com/account/domain/name-servers.html
2. Selecione: `framevideos.com`
3. Escolha: "Use Cloudflare Nameservers"
4. Adicione:
   - `colette.ns.cloudflare.com`
   - `henry.ns.cloudflare.com`
5. Salve

---

## ✅ Registros DNS (já criados no Cloudflare)

| Tipo  | Nome | Destino | Status |
|-------|------|---------|--------|
| CNAME | api  | frame-videos-prod.frame-videos.workers.dev | ✅ Criado |
| CNAME | @    | production.frame-videos-frontend.pages.dev | ✅ Criado |
| CNAME | www  | production.frame-videos-frontend.pages.dev | ✅ Criado |

**Proxied:** ✅ Sim (todos os registros passam pelo Cloudflare)

---

## 🔗 URLs Finais

Após propagação DNS (5-30 minutos):

- **Frontend:** https://framevideos.com
- **Frontend (www):** https://www.framevideos.com
- **API Backend:** https://api.framevideos.com

---

## 📊 Status

- **Zone ID:** `b1c8e3ac5ac0fffd79a1748e0c17da20`
- **Status:** `pending` (aguardando nameservers no Dynadot)
- **Registros DNS:** ✅ Criados
- **SSL:** 🔄 Será provisionado automaticamente após ativação

---

## 🔍 Verificar Propagação

```bash
# Verificar nameservers
dig framevideos.com NS +short

# Verificar registro API
dig api.framevideos.com +short

# Verificar registro root
dig framevideos.com +short
```

---

**Próximo passo:** Adicione os nameservers no Dynadot e aguarde 5-30 minutos para propagação.
