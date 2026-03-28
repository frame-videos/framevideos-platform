import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';

interface DashboardStats {
  totalVideos: number;
  totalCategories: number;
  totalDomains: number;
  creditsBalance: number;
  totalCredited: number;
  totalDebited: number;
  analyticsPageviews: number;
  analyticsTodayPageviews: number;
  planName: string;
}

export function DashboardHome() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [videosRes, categoriesRes, domainsRes, creditsRes, analyticsRes] = await Promise.all([
          fetch('/api/v1/content/videos?limit=1', { headers }).then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
          fetch('/api/v1/content/categories?limit=1', { headers }).then(r => r.json()).catch(() => ({ pagination: { total: 0 } })),
          fetch('/api/v1/domains', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/v1/credits/balance', { headers }).then(r => r.json()).catch(() => ({ balance: 0, totalCredited: 0, totalDebited: 0 })),
          fetch('/api/v1/analytics/dashboard', { headers }).then(r => r.json()).catch(() => ({ totalPageviews: 0, todayPageviews: 0 })),
        ]);

        setStats({
          totalVideos: videosRes?.pagination?.total ?? videosRes?.data?.length ?? 0,
          totalCategories: categoriesRes?.pagination?.total ?? categoriesRes?.data?.length ?? 0,
          totalDomains: domainsRes?.data?.length ?? 0,
          creditsBalance: creditsRes?.balance ?? 0,
          totalCredited: creditsRes?.totalCredited ?? 0,
          totalDebited: creditsRes?.totalDebited ?? 0,
          analyticsPageviews: analyticsRes?.totalPageviews ?? 0,
          analyticsTodayPageviews: analyticsRes?.todayPageviews ?? 0,
          planName: user?.planName ?? 'Free',
        });
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [user]);

  const formatNumber = (n: number) => n.toLocaleString('pt-BR');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Olá, {user?.name?.split(' ')[0] || 'Usuário'} 👋
        </h1>
        <p className="text-sm text-dark-400 mt-1">
          Aqui está um resumo da sua conta.
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-dark-900 rounded-xl p-5 border border-dark-800 animate-pulse">
              <div className="h-4 bg-dark-800 rounded w-20 mb-3" />
              <div className="h-8 bg-dark-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Pageviews (30d)"
            value={formatNumber(stats?.analyticsPageviews ?? 0)}
            change={`${formatNumber(stats?.analyticsTodayPageviews ?? 0)} hoje`}
            changeType="neutral"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />
          <StatsCard
            title="Vídeos"
            value={formatNumber(stats?.totalVideos ?? 0)}
            change={`${formatNumber(stats?.totalCategories ?? 0)} categorias`}
            changeType="neutral"
            iconColor="bg-blue-600/20 text-blue-400"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatsCard
            title="Domínios"
            value={formatNumber(stats?.totalDomains ?? 0)}
            iconColor="bg-green-600/20 text-green-400"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
              </svg>
            }
          />
          <StatsCard
            title="Créditos IA"
            value={formatNumber(stats?.creditsBalance ?? 0)}
            change={`${formatNumber(stats?.totalDebited ?? 0)} usados`}
            changeType="neutral"
            iconColor="bg-yellow-600/20 text-yellow-400"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <a
            href="/dashboard/sites"
            className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-750 hover:ring-1 hover:ring-primary-500/30 transition-all"
          >
            <span className="text-2xl">🌐</span>
            <div>
              <p className="font-medium text-dark-100">Meus Sites</p>
              <p className="text-xs text-dark-500">Gerenciar sites e domínios</p>
            </div>
          </a>
          <a
            href="/dashboard/plan"
            className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-750 hover:ring-1 hover:ring-primary-500/30 transition-all"
          >
            <span className="text-2xl">💎</span>
            <div>
              <p className="font-medium text-dark-100">Meu Plano</p>
              <p className="text-xs text-dark-500">Upgrade e faturamento</p>
            </div>
          </a>
          <a
            href="/dashboard/credits"
            className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-750 hover:ring-1 hover:ring-primary-500/30 transition-all"
          >
            <span className="text-2xl">🤖</span>
            <div>
              <p className="font-medium text-dark-100">Créditos IA</p>
              <p className="text-xs text-dark-500">Comprar e gerenciar créditos</p>
            </div>
          </a>
          <a
            href="/dashboard/settings"
            className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-750 hover:ring-1 hover:ring-primary-500/30 transition-all"
          >
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="font-medium text-dark-100">Configurações</p>
              <p className="text-xs text-dark-500">Conta e preferências</p>
            </div>
          </a>
        </div>
      </Card>
    </div>
  );
}
