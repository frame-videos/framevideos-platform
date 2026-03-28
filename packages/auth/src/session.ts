// Gerenciamento de sessões — CRUD no D1

import type { D1Client } from '@frame-videos/db';
import type { UserSession } from '@frame-videos/shared/types';
import { generateUlid } from '@frame-videos/shared/utils';
import { NotFoundError, UnauthorizedError } from '@frame-videos/shared/errors';
import { signAccessToken, signRefreshToken, verifyToken } from './jwt.js';
import type { JwtPayload } from './jwt.js';

const SESSION_EXPIRY_DAYS = 7;
const MAX_SESSIONS_PER_USER = 10;

/**
 * Gera hash SHA-256 de um token (pra armazenar no banco).
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Cria uma nova sessão e retorna access + refresh tokens.
 */
export async function createSession(
  db: D1Client,
  userId: string,
  tenantId: string,
  role: string,
  jwtSecret: string,
  ip?: string | null,
  userAgent?: string | null,
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  // Limpar sessões expiradas do usuário
  await db.execute(
    `DELETE FROM sessions WHERE user_id = ? AND expires_at < datetime('now')`,
    [userId],
  );

  // Limitar sessões ativas por usuário (manter as mais recentes)
  const activeSessions = await db.query<{ id: string }>(
    `SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );

  if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
    // Remover sessões mais antigas
    const sessionsToRemove = activeSessions.slice(MAX_SESSIONS_PER_USER - 1);
    for (const session of sessionsToRemove) {
      await db.execute(`DELETE FROM sessions WHERE id = ?`, [session.id]);
    }
  }

  // Gerar tokens
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: userId,
    tid: tenantId,
    role: role,
  };

  const accessToken = await signAccessToken(payload, jwtSecret);
  const refreshToken = await signRefreshToken(payload, jwtSecret);
  const refreshTokenHash = await hashToken(refreshToken);

  // Calcular expiração
  const expiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const sessionId = generateUlid();

  await db.execute(
    `INSERT INTO sessions (id, user_id, tenant_id, refresh_token_hash, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, tenantId, refreshTokenHash, ip ?? null, userAgent ?? null, expiresAt],
  );

  return { accessToken, refreshToken, sessionId };
}

/**
 * Renova uma sessão usando refresh token.
 * Implementa rotação de tokens (o refresh token antigo é invalidado).
 */
export async function refreshSession(
  db: D1Client,
  refreshToken: string,
  jwtSecret: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Verificar o JWT do refresh token
  const payload = await verifyToken(refreshToken, jwtSecret);
  if (!payload) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Buscar sessão pelo hash do refresh token
  const tokenHash = await hashToken(refreshToken);
  const session = await db.queryOne<UserSession>(
    `SELECT * FROM sessions WHERE refresh_token_hash = ? AND expires_at > datetime('now')`,
    [tokenHash],
  );

  if (!session) {
    throw new UnauthorizedError('Session not found or expired');
  }

  // Gerar novos tokens
  const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: payload.sub,
    tid: payload.tid,
    role: payload.role,
  };

  const newAccessToken = await signAccessToken(newPayload, jwtSecret);
  const newRefreshToken = await signRefreshToken(newPayload, jwtSecret);
  const newRefreshTokenHash = await hashToken(newRefreshToken);

  const newExpiresAt = new Date(
    Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Atualizar sessão com novo refresh token (rotação)
  await db.execute(
    `UPDATE sessions SET refresh_token_hash = ?, expires_at = ? WHERE id = ?`,
    [newRefreshTokenHash, newExpiresAt, session.id],
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

/**
 * Invalida uma sessão específica (logout).
 */
export async function invalidateSession(
  db: D1Client,
  sessionId: string,
): Promise<void> {
  const result = await db.execute(
    `DELETE FROM sessions WHERE id = ?`,
    [sessionId],
  );

  if (result.meta.changes === 0) {
    throw new NotFoundError('Session', sessionId);
  }
}

/**
 * Invalida TODAS as sessões de um usuário (logout global).
 */
export async function invalidateAllSessions(
  db: D1Client,
  userId: string,
): Promise<void> {
  await db.execute(
    `DELETE FROM sessions WHERE user_id = ?`,
    [userId],
  );
}
