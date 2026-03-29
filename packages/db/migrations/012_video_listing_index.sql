-- Migration 012: Index composto para listagem de vídeos
-- Elimina USE TEMP B-TREE FOR ORDER BY nas queries de listagem
-- Cobre o padrão: WHERE tenant_id = ? AND status = 'published' ORDER BY created_at DESC

CREATE INDEX IF NOT EXISTS idx_videos_tenant_status_created
ON videos(tenant_id, status, created_at DESC);
