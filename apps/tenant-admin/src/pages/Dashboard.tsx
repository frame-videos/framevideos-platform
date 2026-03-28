import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface Stats {
  totalVideos: number;
  totalCategories: number;
  totalTags: number;
  totalPerformers: number;
  totalChannels: number;
}

interface BalanceData {
  balance: number;
  totalCredited: number;
  totalDebited: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [videos, categories, tags, performers, channels, creditsData] = await Promise.all([
          api<{ pagination: { total: number } }>('/api/v1/content/videos?limit=1'),
          api<{ pagination: { total: number } }>('/api/v1/content/categories?limit=1'),
          api<{ pagination: { total: number } }>('/api/v1/content/tags?limit=1'),
          api<{ pagination: { total: number } }>('/api/v1/content/performers?limit=1'),
          api<{ pagination: { total: number } }>('/api/v1/content/channels?limit=1'),
          api<BalanceData>('/api/v1/credits/balance').catch(() => null),
        ]);
        setStats({
          totalVideos: videos.pagination.total,
          totalCategories: categories.pagination.total,
          totalTags: tags.pagination.total,
          totalPerformers: performers.pagination.total,
          totalChannels: channels.pagination.total,
        });
        if (creditsData) setBalance(creditsData);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    { label: 'Vídeos', value: stats?.totalVideos ?? 0, icon: '🎬', href: '/admin/videos', color: 'purple' },
    { label: 'Categorias', value: stats?.totalCategories ?? 0, icon: '📁', href: '/admin/categories', color: 'blue' },
    { label: 'Tags', value: stats?.totalTags ?? 0, icon: '🏷️', href: '/admin/tags', color: 'green' },
    { label: 'Modelos', value: stats?.totalPerformers ?? 0, icon: '👤', href: '/admin/performers', color: 'pink' },
    { label: 'Canais', value: stats?.totalChannels ?? 0, icon: '📺', href: '/admin/channels', color: 'orange' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-5 border border-gray-800 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {statCards.map((card) => (
              <a
                key={card.label}
                href={card.href}
                className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors group"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-400">{card.label}</p>
                  <span className="text-xl">{card.icon}</span>
                </div>
                <p className="text-3xl font-bold text-white group-hover:text-purple-400 transition-colors">
                  {formatNumber(card.value)}
                </p>
              </a>
            ))}
          </div>

          {/* AI Credits card */}
          {balance !== null && (
            <div className="mt-6">
              <a
                href="/admin/credits"
                className="block bg-gradient-to-r from-purple-900/40 to-indigo-900/40 rounded-xl p-5 border border-purple-800/50 hover:border-purple-700/60 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🤖</span>
                      <p className="text-sm text-gray-400">Créditos de IA</p>
                    </div>
                    <p className="text-3xl font-bold text-purple-400 group-hover:text-purple-300 transition-colors">
                      {formatNumber(balance.balance)} <span className="text-base font-normal text-gray-500">créditos</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      Usado: {formatNumber(balance.totalDebited)} / Recebido: {formatNumber(balance.totalCredited)}
                    </p>
                    <p className="text-xs text-purple-400 mt-1 group-hover:underline">
                      Ver detalhes →
                    </p>
                  </div>
                </div>
              </a>
            </div>
          )}
        </>
      )}

      <div className="mt-8 bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <a
            href="/admin/videos/new"
            className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-750 hover:ring-1 hover:ring-purple-500/30 transition-all"
          >
            <span className="text-2xl">➕</span>
            <div>
              <p className="font-medium">Adicionar Vídeo</p>
              <p className="text-xs text-gray-500">Criar novo vídeo no site</p>
            </div>
          </a>
          <a
            href="/admin/categories"
            className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-750 hover:ring-1 hover:ring-purple-500/30 transition-all"
          >
            <span className="text-2xl">📁</span>
            <div>
              <p className="font-medium">Gerenciar Categorias</p>
              <p className="text-xs text-gray-500">Organizar conteúdo</p>
            </div>
          </a>
          <a
            href="/admin/credits"
            className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-750 hover:ring-1 hover:ring-purple-500/30 transition-all"
          >
            <span className="text-2xl">🤖</span>
            <div>
              <p className="font-medium">Créditos de IA</p>
              <p className="text-xs text-gray-500">Gerar conteúdo com inteligência artificial</p>
            </div>
          </a>
          <a
            href="/admin/settings"
            className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-750 hover:ring-1 hover:ring-purple-500/30 transition-all"
          >
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="font-medium">Configurações</p>
              <p className="text-xs text-gray-500">Personalizar o site</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
