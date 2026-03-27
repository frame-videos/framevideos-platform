import { MiddlewareHandler } from 'hono';

/**
 * Security Headers Middleware
 * 
 * Aplica headers de segurança em todas as respostas HTTP para proteger contra
 * vulnerabilidades comuns (XSS, clickjacking, MIME sniffing, etc.)
 */
export const securityHeaders = (): MiddlewareHandler => {
  return async (c, next) => {
    await next();

    // Previne MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff');

    // Previne clickjacking
    c.header('X-Frame-Options', 'DENY');

    // Proteção XSS (legacy, mas ainda útil para browsers antigos)
    c.header('X-XSS-Protection', '1; mode=block');

    // Force HTTPS por 1 ano (incluindo subdomínios)
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Content Security Policy - permite apenas recursos do próprio domínio
    // unsafe-inline é necessário para alguns frameworks, mas deve ser removido quando possível
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    );

    // Controla quanto de informação do Referer é enviado
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Desabilita APIs sensíveis do browser
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  };
};
