import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import * as authApi from '@/api/auth';

export function useAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, setAuth, clearAuth } = useAuthStore();

  const handleLogin = useCallback(
    async (data: authApi.LoginRequest) => {
      const response = await authApi.login(data);
      setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/dashboard');
    },
    [setAuth, navigate],
  );

  const handleSignup = useCallback(
    async (data: authApi.SignupRequest) => {
      const response = await authApi.signup(data);
      setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/dashboard');
    },
    [setAuth, navigate],
  );

  const handleLogout = useCallback(async () => {
    await authApi.logout();
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login: handleLogin,
    signup: handleSignup,
    logout: handleLogout,
  };
}
