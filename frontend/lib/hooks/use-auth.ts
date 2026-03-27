import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api-client';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      // Só tenta buscar /me se tiver token
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        return null;
      }
      try {
        const response = await api.auth.me();
        return response.data;
      } catch {
        // Token inválido ou expirado — limpar
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos (antigo cacheTime)
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await api.auth.login(email, password);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        // Invalidar query de auth pra buscar user info
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        // Redirect baseado no role
        const role = data.user?.role;
        const redirectTo = (role === 'admin' || role === 'super_admin') ? '/admin' : '/dashboard';
        router.push(redirectTo);
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ name, email, password }: { name?: string; email: string; password: string }) => {
      const response = await api.auth.register(email, password, name);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        // Redirect baseado no role
        const role = data.user?.role;
        const redirectTo = (role === 'admin' || role === 'super_admin') ? '/admin' : '/dashboard';
        router.push(redirectTo);
      }
    },
  });

  const logout = () => {
    localStorage.removeItem('auth_token');
    queryClient.setQueryData(['auth', 'me'], null);
    router.push('/auth/login');
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}
