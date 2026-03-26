'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const { login, loginError } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-primary-800/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md px-4 relative z-10 animate-fadeInUp">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-600/30">
            F
          </div>
          <span className="text-2xl font-bold">Frame Videos</span>
        </Link>

        {/* Card */}
        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Bem-vindo de volta</h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            Entre na sua conta para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/5 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Senha
                </label>
                <Link href="#" className="text-xs text-primary-400 hover:text-primary-300 transition">
                  Esqueceu a senha?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/5 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="bg-red-900/30 border border-red-700/30 text-red-300 px-4 py-3 rounded-xl text-sm animate-fadeIn">
                {loginError instanceof Error ? loginError.message : 'Erro ao fazer login'}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40"
            >
              Entrar
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-700/50" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-gray-700/50" />
          </div>

          <div className="text-center">
            <p className="text-gray-400 text-sm">
              Não tem conta?{' '}
              <Link href="/auth/register" className="text-primary-400 hover:text-primary-300 font-medium transition">
                Crie uma grátis
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-8">
          © {new Date().getFullYear()} Frame Videos. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
