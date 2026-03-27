// API Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.framevideos.com/api/v1';

export function getApiUrl(path: string): string {
  // If path starts with /, remove it
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_URL}/${cleanPath}`;
}

export function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers,
  });
  
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/auth/login';
    }
    throw new Error('Authentication required');
  }
  
  return response;
}

export { API_URL };
