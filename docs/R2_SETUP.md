# R2 Storage Setup - Frame Videos

## Status: ✅ IMPLEMENTED (Mock Mode)

R2 storage endpoints são implementados com mock service para desenvolvimento. Pronto para integração real quando R2 estiver habilitado.

## Endpoints Implementados

### 1. Upload URL Generation
```
POST /api/v1/storage/upload-url
Authorization: Bearer <token>

{
  "videoId": "video-123",
  "contentType": "video/mp4",
  "expiresIn": 3600
}

Response:
{
  "uploadUrl": "https://storage.framevideos.com/videos/{tenantId}/{videoId}/video.mp4?token=...",
  "key": "videos/{tenantId}/{videoId}/video.mp4",
  "videoId": "video-123",
  "expiresIn": 3600
}
```

### 2. Direct Video Upload
```
POST /api/v1/storage/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

- file: <video file>
- videoId: "video-123"
- title: "My Video"
- description: "Optional description"

Response:
{
  "message": "Video uploaded successfully",
  "video": { ... },
  "storage": {
    "key": "videos/{tenantId}/{videoId}/video.mp4",
    "size": 1024000
  }
}
```

### 3. Thumbnail Upload
```
POST /api/v1/storage/thumbnail/:videoId
Authorization: Bearer <token>
Content-Type: multipart/form-data

- file: <image file>

Response:
{
  "message": "Thumbnail uploaded successfully",
  "thumbnail": {
    "key": "videos/{tenantId}/{videoId}/thumbnail.jpg",
    "url": "https://storage.framevideos.com/..."
  }
}
```

### 4. Signed URL Generation
```
GET /api/v1/storage/signed-url/:videoId?expiresIn=3600
Authorization: Bearer <token>

Response:
{
  "signedUrl": "https://storage.framevideos.com/...",
  "expiresIn": 3600,
  "expiresAt": "2026-03-25T20:15:00Z"
}
```

### 5. Video Streaming
```
GET /api/v1/storage/stream/:videoId
Authorization: Bearer <token>
Range: bytes=0-1023 (optional)

Response:
- HTTP 200 with video stream
- HTTP 206 with range support for seeking
```

### 6. Video Download
```
GET /api/v1/storage/download/:videoId
Authorization: Bearer <token>

Response:
- Full video file with attachment headers
```

### 7. Delete Video
```
DELETE /api/v1/storage/:videoId
Authorization: Bearer <token>

Response:
{
  "message": "Video deleted successfully"
}
```

## CORS Configuration

Configurado para suportar:
- ✅ GET, POST, PUT, DELETE, OPTIONS
- ✅ Content-Type, Authorization, Range headers
- ✅ Content-Range, Accept-Ranges, Content-Length exposed
- ✅ Credentials habilitadas

## Próximos Passos - R2 Real

1. **Habilitar R2** no Cloudflare Dashboard
2. **Criar bucket**: `frame-videos-storage`
3. **Configurar CORS** no bucket:
   ```json
   {
     "CORSRules": [
       {
         "AllowedOrigins": ["https://framevideos.com", "https://*.framevideos.com"],
         "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
         "AllowedHeaders": ["*"],
         "ExposeHeaders": ["Content-Range", "Accept-Ranges"]
       }
     ]
   }
   ```

4. **Substituir MockStorageService** por StorageService real
5. **Implementar thumbnail generation** com Workers AI

## Arquivo de Configuração

- `wrangler.toml`: Bindings já configurados para R2 e KV
- `src/storage.ts`: Serviço completo para R2 (pronto para uso)
- `src/storage-mock.ts`: Mock para desenvolvimento
- `src/routes/storage.ts`: Endpoints da API

## Features

✅ Upload de vídeos com metadata
✅ Upload de thumbnails
✅ Signed URLs para acesso privado
✅ Video streaming com range requests
✅ Download de vídeos
✅ Deleção de vídeos
✅ Autenticação por tenant
✅ CORS configurado
⏳ Thumbnail generation (Workers AI)
⏳ Otimização de imagens

## Testing

```bash
# Build
npm run build

# Deploy (staging)
npx wrangler deploy --env staging

# Deploy (production)
npx wrangler deploy --env production
```

## Segurança

- ✅ Autenticação obrigatória em todos endpoints
- ✅ Verificação de tenant para acesso
- ✅ Signed URLs com expiração
- ✅ Range requests para streaming seguro
- ✅ Metadata de auditoria (uploadedBy, timestamp)
