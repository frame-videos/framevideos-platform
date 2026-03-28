import { apiClient } from './client';

export interface SignupRequest {
  name: string;
  email: string;
  tenantName: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

interface ApiSignupResponse {
  user: { id: string; name: string; email: string; role: string };
  tenant: { id: string; name: string; slug: string };
  tokens: { accessToken: string; refreshToken: string };
}

interface ApiLoginResponse {
  user: { id: string; name: string; email: string; role: string; tenantId: string };
  tokens: { accessToken: string; refreshToken: string };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  const res = await apiClient<ApiSignupResponse>('/api/v1/auth/signup', {
    method: 'POST',
    body: data,
  });
  return {
    accessToken: res.tokens.accessToken,
    refreshToken: res.tokens.refreshToken,
    user: {
      id: res.user.id,
      name: res.user.name,
      email: res.user.email,
      role: res.user.role,
      tenantId: res.tenant.id,
    },
  };
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await apiClient<ApiLoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: data,
  });
  return {
    accessToken: res.tokens.accessToken,
    refreshToken: res.tokens.refreshToken,
    user: res.user,
  };
}

export async function logout(): Promise<void> {
  try {
    await apiClient('/api/v1/auth/logout', { method: 'POST' });
  } catch {
    // Ignora erro no logout — limpa tokens localmente
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}
