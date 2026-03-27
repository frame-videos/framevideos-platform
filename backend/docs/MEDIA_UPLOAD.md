# Media Upload System - Task 4.3

Sistema completo de upload de mídia (imagens, vídeos) para Cloudflare R2.

## Visão Geral

O sistema de media upload oferece:

- ✅ **Presigned URLs** para upload direto do browser para R2
- ✅ **Multipart Upload** para arquivos grandes
- ✅ **Geração automática de thumbnails** em múltiplos tamanhos
- ✅ **Validação de tipos e tamanhos** de arquivo
- ✅ **Metadata extraction** (duração, resolução, codec)
- ✅ **Tenant isolation** completo
- ✅ **Rate limiting** e audit logging

## Endpoints

### 1. Validar Mídia

```http
POST /api/v1/media/validate
Authorization: Bearer {token}
Content-Type: application/json

{
  "fileName": "video.mp4",
  "contentType": "video/mp4",
  "fileSize": 10485760
}
```

**Response:**
```json
{
  "valid": true,
  "type": "video",
  "maxSize": 524288000
}
```

### 2. Gerar Presigned URL

```http
POST /api/v1/media/presigned-url
Authorization: Bearer {token}
Content-Type: application/json

{
  "fileName": "video.mp4",
  "contentType": "video/mp4",
  "fileSize": 10485760
}
```

**Response:**
```json
{
  "uploadUrl": "https://upload.framevideos.com/r2/videos/tenant-123/media-456/original.mp4",
  "key": "videos/tenant-123/media-456/original.mp4",
  "mediaId": "media-456",
  "expiresIn": 3600,
  "type": "video"
}
```

### 3. Upload Multipart

```http
POST /api/v1/media/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="video"; filename="video.mp4"
Content-Type: video/mp4

[binary data]
--boundary
Content-Disposition: form-data; name="title"

My Video Title
--boundary
Content-Disposition: form-data; name="description"

Video description
--boundary--
```

**Response:**
```json
{
  "message": "Mídia enviada com sucesso",
  "mediaId": "media-456",
  "type": "video",
  "url": "https://pub-frame-videos.r2.dev/videos/tenant-123/media-456/original.mp4",
  "size": 10485760
}
```

### 4. Gerar Thumbnails Automáticos

```http
POST /api/v1/media/{mediaId}/thumbnail?sizes=sm,md,lg
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Thumbnails gerados com sucesso",
  "thumbnails": {
    "sm": "https://pub-frame-videos.r2.dev/thumbnails/tenant-123/media-456/sm.jpg",
    "md": "https://pub-frame-videos.r2.dev/thumbnails/tenant-123/media-456/md.jpg",
    "lg": "https://pub-frame-videos.r2.dev/thumbnails/tenant-123/media-456/lg.jpg"
  }
}
```

### 5. Upload Thumbnail Customizado

```http
PUT /api/v1/media/{mediaId}/thumbnail
Authorization: Bearer {token}
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="thumbnail"; filename="thumb.jpg"
Content-Type: image/jpeg

[binary data]
--boundary--
```

**Response:**
```json
{
  "message": "Thumbnail customizado enviado com sucesso",
  "thumbnailUrl": "https://pub-frame-videos.r2.dev/thumbnails/tenant-123/media-456/custom.jpg"
}
```

### 6. Extrair Metadata

```http
GET /api/v1/media/{mediaId}/metadata
Authorization: Bearer {token}
```

**Response (Video):**
```json
{
  "duration": 120,
  "resolution": {
    "width": 1920,
    "height": 1080
  },
  "codec": "h264",
  "bitrate": 5000000,
  "fps": 30
}
```

**Response (Image):**
```json
{
  "width": 1920,
  "height": 1080,
  "format": "image/jpeg",
  "size": 524288
}
```

### 7. Obter Informações da Mídia

```http
GET /api/v1/media/{mediaId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "id": "media-456",
  "userId": "user-123",
  "tenantId": "tenant-123",
  "type": "video",
  "title": "My Video",
  "description": "Video description",
  "url": "https://pub-frame-videos.r2.dev/videos/tenant-123/media-456/original.mp4",
  "key": "videos/tenant-123/media-456/original.mp4",
  "size": 10485760,
  "contentType": "video/mp4",
  "status": "processing",
  "createdAt": "2024-03-27T10:00:00.000Z",
  "thumbnails": {
    "sm": "...",
    "md": "...",
    "lg": "..."
  }
}
```

### 8. Deletar Mídia

```http
DELETE /api/v1/media/{mediaId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Mídia deletada com sucesso"
}
```

## Tipos de Arquivo Suportados

### Vídeos (Max: 500MB)
- `video/mp4` (.mp4)
- `video/quicktime` (.mov)
- `video/x-msvideo` (.avi)
- `video/x-matroska` (.mkv)
- `video/webm` (.webm)

### Imagens (Max: 10MB)
- `image/jpeg` (.jpg, .jpeg)
- `image/png` (.png)
- `image/webp` (.webp)
- `image/gif` (.gif)

## Tamanhos de Thumbnail

| Size | Dimensions | Use Case |
|------|------------|----------|
| sm   | 320x180    | Lista de vídeos, mobile |
| md   | 640x360    | Grid de vídeos, desktop |
| lg   | 1280x720   | Player preview, hero |

## Estrutura de Armazenamento R2

```
frame-videos-storage/
├── videos/
│   └── {tenantId}/
│       └── {mediaId}/
│           └── original.mp4
├── images/
│   └── {tenantId}/
│       └── {mediaId}/
│           └── original.jpg
└── thumbnails/
    └── {tenantId}/
        └── {mediaId}/
            ├── sm.jpg
            ├── md.jpg
            ├── lg.jpg
            └── custom.jpg
```

## Tenant Isolation

Todas as operações são isoladas por tenant:

- ✅ Uploads são armazenados em `{type}/{tenantId}/{mediaId}/`
- ✅ Usuários só podem acessar mídia do próprio tenant
- ✅ Cache KV usa chave `media:{tenantId}:{mediaId}`
- ✅ Audit logs registram todas as operações

## Rate Limiting

- **Upload**: 10 req/min por usuário
- **Public endpoints**: 100 req/min por IP

## Validações

### Arquivo
- ✅ Tipo de arquivo (whitelist)
- ✅ Tamanho máximo (500MB vídeo, 10MB imagem)
- ✅ Nome de arquivo
- ✅ Content-Type header

### Request
- ✅ Autenticação JWT
- ✅ Tenant ID válido
- ✅ UUID válido para mediaId
- ✅ Campos obrigatórios

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Tipo de arquivo não suportado | Formato inválido |
| 400 | Arquivo muito grande | Excedeu limite de tamanho |
| 401 | Authentication required | Token ausente/inválido |
| 404 | Media not found | Mídia não encontrada |
| 429 | Rate limit exceeded | Muitos uploads |
| 500 | Storage error | Erro no R2 |

## Audit Logging

Todas as operações são registradas:

```json
{
  "eventType": "VIDEO_UPLOAD",
  "userId": "user-123",
  "tenantId": "tenant-123",
  "resourceType": "media",
  "resourceId": "media-456",
  "ipAddress": "203.0.113.1",
  "userAgent": "Mozilla/5.0...",
  "details": {
    "type": "video",
    "title": "My Video",
    "size": 10485760,
    "contentType": "video/mp4"
  }
}
```

## Próximos Passos

### Fase 2 (Futuro)
- [ ] Integração com Cloudflare Images para thumbnails reais
- [ ] FFmpeg para metadata extraction real
- [ ] Transcodificação automática de vídeos
- [ ] Suporte a HLS/DASH streaming
- [ ] Watermark automático
- [ ] Compressão automática de imagens

## Testing

```bash
# Rodar testes
cd backend
npm test tests/media-upload.test.ts

# Coverage
npm run test:coverage
```

## Deploy

O deploy é feito via GitHub Actions:

```bash
git add .
git commit -m "feat: media upload system (task 4.3)"
git push origin feature/task-4.3
```

## Referências

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Hono Multipart](https://hono.dev/helpers/file)
- [Task 4.3 Epic](../../docs/epics/04-cms.md)
