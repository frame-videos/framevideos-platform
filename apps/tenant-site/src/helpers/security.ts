// Security headers helper for tenant-site — Sprint 10
// More permissive CSP than API (allows analytics scripts, external images, video embeds)

const TENANT_SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https:",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "frame-ancestors 'self'",
    "media-src 'self' https: blob:",
  ].join('; '),
};

/**
 * Adds security headers to an existing Response.
 * Returns a new Response with the headers applied.
 */
export function addSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);

  for (const [header, value] of Object.entries(TENANT_SECURITY_HEADERS)) {
    newHeaders.set(header, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
