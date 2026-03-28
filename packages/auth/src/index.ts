// @frame-videos/auth — re-exports centralizados

export { hashPassword, verifyPassword } from './hash.js';
export { signAccessToken, signRefreshToken, verifyToken } from './jwt.js';
export type { JwtPayload } from './jwt.js';
export {
  createSession,
  refreshSession,
  invalidateSession,
  invalidateAllSessions,
} from './session.js';
export { hasPermission, requirePermission } from './rbac.js';
export type { Resource, Action } from './rbac.js';
export { authMiddleware, optionalAuth } from './middleware.js';
