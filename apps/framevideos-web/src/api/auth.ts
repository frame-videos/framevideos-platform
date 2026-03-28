import { apiClient } from './client';

export interface SignupRequest {
  name: string;
  email: string;
  siteName: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
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
  return apiClient<AuthResponse>('/api/v1/auth/signup', {
    method: 'POST',
    body: data,
  });
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: data,
  });
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
