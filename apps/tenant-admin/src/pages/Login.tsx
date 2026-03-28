import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { api, setTokens, setStoredUser } from '@/lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const { isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // Direct API call to check mustChangePassword flag
      const data = await api<{
        mustChangePassword?: boolean;
        user: { id: string; email: string; name: string; role: string; tenantId: string };
        tokens: { accessToken: string; refreshToken: string };
      }>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      if (data.user.role !== 'tenant_admin' && data.user.role !== 'super_admin') {
        throw new Error('Apenas administradores podem acessar o painel');
      }

      // Store tokens and user
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);
      setStoredUser(data.user);
      useAuthStore.setState({ user: data.user as any, isLoading: false });

      if (data.mustChangePassword) {
        setCurrentPasswordForChange(password);
        setShowChangePassword(true);
        return;
      }

      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');

    if (newPassword !== confirmPassword) {
      setChangePasswordError('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 8) {
      setChangePasswordError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setChangePasswordLoading(true);
    try {
      await api('/api/v1/auth/change-password', {
        method: 'POST',
        body: {
          currentPassword: currentPasswordForChange,
          newPassword,
        },
      });
      setShowChangePassword(false);
      navigate('/admin');
    } catch (err) {
      setChangePasswordError(err instanceof Error ? err.message : 'Erro ao alterar senha');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  if (showChangePassword) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Alterar Senha</h1>
            <p className="text-gray-500 text-sm">Você precisa alterar sua senha antes de continuar</p>
          </div>

          <form onSubmit={handleChangePassword} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            {changePasswordError && (
              <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
                {changePasswordError}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Nova senha
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                minLength={8}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Confirmar nova senha
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="Repita a nova senha"
              />
            </div>

            <button
              type="submit"
              disabled={changePasswordLoading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {changePasswordLoading ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Painel Admin</h1>
          <p className="text-gray-500 text-sm">Faça login para gerenciar seu site</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              placeholder="seu@email.com"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="text-center mt-4">
            <a href="/forgot-password" className="text-sm text-purple-500 hover:text-purple-400 transition-colors">
              Esqueceu sua senha?
            </a>
          </div>
        </form>

        {/* White-label: no branding in admin panel */}
      </div>
    </div>
  );
}
