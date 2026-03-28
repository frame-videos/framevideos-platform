// API client for tenant-admin
// Uses the same auth endpoints as framevideos-web

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api.framevideos.com';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export class ApiError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getTokens() {
  const accessToken = localStorage.getItem('admin_accessToken');
  const refreshToken = localStorage.getItem('admin_refreshToken');
  return { accessToken, refreshToken };
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('admin_accessToken', accessToken);
  localStorage.setItem('admin_refreshToken', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('admin_accessToken');
  localStorage.removeItem('admin_refreshToken');
}

export function getStoredUser() {
  const raw = localStorage.getItem('admin_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setStoredUser(user: Record<string, unknown>) {
  localStorage.setItem('admin_user', JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem('admin_user');
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const { refreshToken } = getTokens();
      if (!refreshToken) return false;

      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function api<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken } = getTokens();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const config: RequestInit = { ...options, headers };
  if (options.body) config.body = JSON.stringify(options.body);

  let response = await fetch(`${API_URL}${endpoint}`, config);

  if (response.status === 401 && accessToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const { accessToken: newToken } = getTokens();
      headers['Authorization'] = `Bearer ${newToken}`;
      config.headers = headers;
      response = await fetch(`${API_URL}${endpoint}`, config);
    } else {
      clearTokens();
      clearStoredUser();
      window.location.href = '/admin/login';
      throw new ApiError('Sessão expirada. Faça login novamente.', 401);
    }
  }

  if (!response.ok) {
    let msg = 'Erro no servidor';
    let code: string | undefined;
    try {
      const raw = await response.json();
      if (raw.error) {
        const fields = raw.error.fields as Array<{ message: string }> | undefined;
        msg = fields?.map((f) => f.message).join('. ') || raw.error.message || msg;
        code = raw.error.code;
      }
    } catch { /* ignore */ }
    throw new ApiError(msg, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

/**
 * Upload a file via multipart/form-data.
 * Used for thumbnail upload to R2.
 */
export async function apiUpload<T = unknown>(endpoint: string, file: File, fieldName = 'file'): Promise<T> {
  const { accessToken } = getTokens();

  const formData = new FormData();
  formData.append(fieldName, file);

  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  // Note: do NOT set Content-Type — browser will set it with boundary for multipart

  let response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.status === 401 && accessToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const { accessToken: newToken } = getTokens();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } else {
      clearTokens();
      clearStoredUser();
      window.location.href = '/admin/login';
      throw new ApiError('Sessão expirada. Faça login novamente.', 401);
    }
  }

  if (!response.ok) {
    let msg = 'Erro no upload';
    try {
      const raw = await response.json();
      if (raw.error) msg = raw.error.message || msg;
    } catch { /* ignore */ }
    throw new ApiError(msg, response.status);
  }

  return response.json();
}
