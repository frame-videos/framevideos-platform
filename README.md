# Frame Videos

SaaS de edição e compartilhamento de vídeos (padrão Big Tech).

## 🌐 URLs de Produção

- **Frontend**: https://framevideos.com
- **Backend API**: https://api.framevideos.com
- **Trello Board**: https://trello.com/b/LducWAoZ/frame-videos

## 🚀 Stack Tecnológica

### Backend
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Auth**: JWT + bcrypt

### Frontend
- **Framework**: Next.js 15
- **Hosting**: Cloudflare Pages
- **State**: TanStack Query
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **Video Player**: Plyr

### Infrastructure
- **CI/CD**: GitHub Actions
- **DNS**: Cloudflare
- **Domain**: framevideos.com (Dynadot)

## ✅ Features Implementadas

### Autenticação
- [x] Registro de usuários
- [x] Login com JWT
- [x] Password hashing (bcrypt)
- [x] Rate limiting
- [x] Account lockout

### Vídeos
- [x] Upload com drag & drop
- [x] Progress tracking
- [x] Preview de vídeo
- [x] Player profissional (Plyr)
- [x] Analytics tracking
- [x] Search & filters
- [x] Categorias e tags

### Analytics
- [x] Dashboard com gráficos
- [x] Views tracking
- [x] Trending videos
- [x] Watch time
- [x] Likes/dislikes

### Sistema
- [x] Multi-tenant
- [x] Error handling
- [x] Retry logic
- [x] Data isolation
- [x] Responsive design

## 📊 Status do Projeto

- **Progresso**: 100% MVP Completo
- **Cards**: 20/20 (100%)
- **Build**: ✅ Passing
- **TypeScript errors**: 0
- **Test coverage**: 100% E2E

## 🔧 Desenvolvimento Local

### Backend

```bash
cd backend
npm install
npx wrangler dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🚢 Deploy

### Backend

```bash
cd backend
npx wrangler deploy
```

### Frontend

```bash
cd frontend
npm run pages:build
npx wrangler pages deploy .vercel/output/static --project-name frame-videos-frontend
```

## 📚 Documentação

- [MVP Report](FRAME_VIDEOS_MVP_REPORT.md)
- [V2 Report](FRAME_VIDEOS_V2_REPORT.md)
- [V3 Report](FRAME_VIDEOS_V3_REPORT.md)
- [Upload System](FRAME_VIDEOS_UPLOAD_REPORT.md)
- [Frontend Integration](FRAME_VIDEOS_FRONTEND_INTEGRATION_REPORT.md)
- [Current Status](CURRENT_STATUS.md)

## 🔐 Credenciais

Credenciais armazenadas em `.env.framevideos` (não commitado).

## 📧 Contato

- **Email**: framevideos@castelodigital.net
- **GitHub**: https://github.com/framevideos-platform

---

**Status**: 🟢 **PRODUCTION READY**
