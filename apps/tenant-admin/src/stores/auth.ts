import { create } from 'zustand';
import { api, setTokens, clearTokens, getStoredUser, setStoredUser, clearStoredUser } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  initialize: () => {
    const stored = getStoredUser();
    if (stored && stored.role === 'tenant_admin') {
      set({ user: stored as User, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api<{
        user: User;
        tokens: { accessToken: string; refreshToken: string };
      }>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      if (data.user.role !== 'tenant_admin' && data.user.role !== 'super_admin') {
        throw new Error('Apenas administradores podem acessar o painel');
      }

      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      setStoredUser(data.user);
      set({ user: data.user, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api('/api/v1/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    clearTokens();
    clearStoredUser();
    set({ user: null });
  },
}));
