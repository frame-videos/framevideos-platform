// JWT com HMAC SHA-256 via crypto.subtle
// Compatível com Cloudflare Workers (Web Crypto API)

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutos em segundos
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 dias em segundos

/**
 * Payload do token JWT.
 */
export interface JwtPayload {
  sub: string; // user ID
  tid: string; // tenant ID
  role: string; // user role
  iat?: number;
  exp?: number;
  jti?: string; // token ID (pra refresh tokens)
}

/**
 * Codifica string para base64url.
 */
function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodifica base64url para string.
 */
function base64UrlDecode(data: string): string {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

/**
 * Importa a chave secreta pra HMAC.
 */
async function importKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Assina um JWT.
 */
async function signJwt(
  payload: JwtPayload,
  secret: string,
  expirySeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expirySeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const message = `${header}.${body}`;

  const key = await importKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  const sigBytes = new Uint8Array(signature);
  let sigString = '';
  for (let i = 0; i < sigBytes.length; i++) {
    sigString += String.fromCharCode(sigBytes[i]!);
  }
  const sig = base64UrlEncode(sigString);

  return `${message}.${sig}`;
}

/**
 * Gera access token (15 minutos).
 */
export async function signAccessToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
): Promise<string> {
  return signJwt(payload as JwtPayload, secret, ACCESS_TOKEN_EXPIRY);
}

/**
 * Gera refresh token (7 dias).
 */
export async function signRefreshToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
): Promise<string> {
  const jti = crypto.randomUUID();
  return signJwt({ ...payload, jti } as JwtPayload, secret, REFRESH_TOKEN_EXPIRY);
}

/**
 * Verifica e decodifica um JWT.
 * Retorna null se inválido ou expirado.
 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts as [string, string, string];
    const message = `${header}.${body}`;

    // Reconstruir assinatura como ArrayBuffer
    const sigString = base64UrlDecode(sig);
    const sigBytes = new Uint8Array(sigString.length);
    for (let i = 0; i < sigString.length; i++) {
      sigBytes[i] = sigString.charCodeAt(i);
    }

    const key = await importKey(secret);
    const encoder = new TextEncoder();
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes.buffer,
      encoder.encode(message),
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;

    // Verificar expiração
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}
