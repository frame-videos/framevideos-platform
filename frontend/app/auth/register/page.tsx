'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [validationError, setValidationError] = useState('');
  const { register, registerError } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    setValidationError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (formData.password !== formData.confirmPassword) {
      setValidationError('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 8) {
      setValidationError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (!formData.acceptTerms || !formData.acceptPrivacy) {
      setValidationError('Você deve aceitar os Termos de Uso e a Política de Privacidade');
      return;
    }

    register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      acceptTerms: formData.acceptTerms,
      acceptPrivacy: formData.acceptPrivacy,
    });
  };

  const error = validationError || (registerError instanceof Error ? registerError.message : registerError ? 'Erro ao criar conta' : '');

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-12">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary-800/10 rounded-full blur-[100px] pointer-events-none" />

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
          <h1 className="text-2xl font-bold text-center mb-2">Crie sua conta</h1>
          <p className="text-gray-400 text-center text-sm mb-8">
            Comece a criar seu site de vídeos agora
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                Nome
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/5 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition"
                placeholder="Seu nome"
              />
            </div>

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
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Senha
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/5 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition"
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirmar Senha
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/5 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition"
                placeholder="Repita a senha"
              />
            </div>

            {/* GDPR Consent */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  required
                  className="mt-1 w-4 h-4 rounded border-gray-700/50 bg-white/5 text-primary-600 focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-0 transition cursor-pointer"
                />
                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition">
                  Eu aceito os{' '}
                  <Link href="/terms" target="_blank" className="text-primary-400 hover:text-primary-300 underline">
                    Termos de Uso
                  </Link>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  name="acceptPrivacy"
                  checked={formData.acceptPrivacy}
                  onChange={handleChange}
                  required
                  className="mt-1 w-4 h-4 rounded border-gray-700/50 bg-white/5 text-primary-600 focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-0 transition cursor-pointer"
                />
                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition">
                  Eu aceito a{' '}
                  <Link href="/privacy" target="_blank" className="text-primary-400 hover:text-primary-300 underline">
                    Política de Privacidade
                  </Link>
                </span>
              </label>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/30 text-red-300 px-4 py-3 rounded-xl text-sm animate-fadeIn">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40"
            >
              Criar Conta
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
              Já tem conta?{' '}
              <Link href="/auth/login" className="text-primary-400 hover:text-primary-300 font-medium transition">
                Faça login
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-8">
          Seus dados são protegidos de acordo com a GDPR.{' '}
          <Link href="/privacy" className="text-gray-500 hover:text-gray-400 underline transition">
            Saiba mais
          </Link>
        </p>
      </div>
    </div>
  );
}
