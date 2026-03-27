'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminDashboard() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-gray-400">Gerencie seu site de vídeos</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 border border-gray-700 hover:border-gray-500 rounded-lg transition"
          >
            Voltar ao Site
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">🌐 Seu Site</h3>
            <p className="text-gray-400 text-sm mb-1">Domínio:</p>
            <p className="text-primary-400 font-mono text-sm mb-4">{user?.tenant?.domain}</p>
            <button className="bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg text-sm transition w-full">
              Configurar Domínio Customizado
            </button>
          </div>

          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">📋 CNAME</h3>
            <p className="text-gray-400 text-sm mb-2">Aponte seu domínio para:</p>
            <code className="block bg-black/30 px-3 py-2 rounded text-primary-400 text-xs font-mono mb-4">
              sites.framevideos.com
            </code>
            <button className="border border-primary-600 hover:bg-primary-600/10 px-4 py-2 rounded-lg text-sm transition w-full">
              Ver Instruções
            </button>
          </div>

          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">💎 Plano</h3>
            <p className="text-gray-400 text-sm mb-1">Plano Atual:</p>
            <p className="text-white font-semibold mb-4">Starter - $29/mês</p>
            <button className="border border-primary-600 hover:bg-primary-600/10 px-4 py-2 rounded-lg text-sm transition w-full">
              Fazer Upgrade
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="glass rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4">⚙️ Configurações do Site</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
                <div>
                  <h4 className="font-semibold">Nome do Site</h4>
                  <p className="text-sm text-gray-400">{user?.tenant?.name}</p>
                </div>
                <button className="text-primary-400 hover:text-primary-300 text-sm">
                  Editar
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
                <div>
                  <h4 className="font-semibold">Logo & Branding</h4>
                  <p className="text-sm text-gray-400">Personalize a aparência</p>
                </div>
                <button className="text-primary-400 hover:text-primary-300 text-sm">
                  Configurar
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
                <div>
                  <h4 className="font-semibold">Usuários do Site</h4>
                  <p className="text-sm text-gray-400">Gerencie quem pode adicionar vídeos</p>
                </div>
                <button className="text-primary-400 hover:text-primary-300 text-sm">
                  Gerenciar
                </button>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4">📊 Estatísticas</h2>
            <div className="space-y-4">
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Total de Vídeos</p>
                <p className="text-3xl font-bold">0</p>
              </div>
              
              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Views Totais</p>
                <p className="text-3xl font-bold">0</p>
              </div>

              <div className="p-4 bg-black/20 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Usuários Ativos</p>
                <p className="text-3xl font-bold">1</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-4">🚀 Próximos Passos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-700 rounded-lg hover:border-primary-600 transition cursor-pointer">
              <div className="text-3xl mb-2">1️⃣</div>
              <h4 className="font-semibold mb-1">Configure seu Domínio</h4>
              <p className="text-sm text-gray-400">Aponte seu domínio customizado</p>
            </div>

            <div className="p-4 border border-gray-700 rounded-lg hover:border-primary-600 transition cursor-pointer">
              <div className="text-3xl mb-2">2️⃣</div>
              <h4 className="font-semibold mb-1">Personalize o Site</h4>
              <p className="text-sm text-gray-400">Adicione logo, cores e branding</p>
            </div>

            <div className="p-4 border border-gray-700 rounded-lg hover:border-primary-600 transition cursor-pointer">
              <div className="text-3xl mb-2">3️⃣</div>
              <h4 className="font-semibold mb-1">Adicione Vídeos</h4>
              <p className="text-sm text-gray-400">Faça upload do primeiro conteúdo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
