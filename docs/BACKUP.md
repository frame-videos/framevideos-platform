# Backup Strategy — Frame Videos

## D1 Time Travel (Automático)
- **Retenção**: 30 dias (plano Workers Paid)
- **Granularidade**: Point-in-time recovery
- **Ativação**: Automática, sem configuração
- **Restauração**: Via Cloudflare Dashboard ou API
  ```bash
  curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/time-travel/restore" \
    -H "Authorization: Bearer {api_token}" \
    -d '{"timestamp": "2026-03-28T00:00:00Z"}'
  ```

## R2 Storage
- **Conteúdo**: Thumbnails, uploads de vídeos, admin SPA assets
- **Lifecycle Rules**: Configurar via Dashboard para cleanup de objetos temporários
- **Versionamento**: Ativar R2 object versioning para proteção contra deleção acidental

## Manual Export
### D1 Database
```bash
# Exportar todas as tabelas
wrangler d1 export frame-videos-db --output=backup-$(date +%Y%m%d).sql
```

### R2 Bucket
```bash
# Listar e sincronizar objetos
wrangler r2 object list frame-videos-storage --prefix=tenants/
```

## KV Cache
- **Não precisa backup**: Cache é efêmero, reconstruído automaticamente
- **TTL**: 5 minutos padrão

## Disaster Recovery
1. **D1 corrompido**: Restaurar via Time Travel (< 30 dias)
2. **R2 perdido**: Re-upload de assets; thumbnails podem ser re-geradas
3. **Worker down**: Re-deploy via GitHub Actions (`git push` ou manual trigger)
4. **DNS issues**: Cloudflare for SaaS mantém fallback origin automático

## Checklist Mensal
- [ ] Verificar D1 Time Travel está ativo
- [ ] Testar restore de D1 em staging
- [ ] Verificar R2 lifecycle rules
- [ ] Revisar logs de erro (structured logging)
- [ ] Verificar SSL dos custom hostnames
