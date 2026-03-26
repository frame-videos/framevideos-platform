const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://frame-videos-prod.frame-videos.workers.dev/api/v1';

export function apiUrl(path: string): string {
  // Remove leading /api/v1 if present (for backward compat)
  const cleanPath = path.replace(/^\/api\/v1/, '');
  return `${API_BASE}${cleanPath}`;
}

export { API_BASE };
