import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';

interface AdminStats {
  totalTenants: number;
  totalUsers: number;
  activeSites: number;
  totalVideos: number;
  mrrCents: number;
}

interface RecentTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

export function AdminHome() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tenants, setTenants] = useState<RecentTenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const [tenantsRes, statsRes] = await Promise.all([
          fetch('/api/v1/admin/tenants?limit=10', { headers }).then(r => r.json()).catch(() => ({ data: [], pagination: { total: 0 } })),
          fetch('/api/v1/admin/stats', { headers }).then(r => r.json()).catch(() => ({ data: { totalTenants: 0, totalUsers: 0, totalVideos: 0, mrrCents: 0 } })),
        ]);

        const tenantList = tenantsRes?.data ?? [];
        const activeSites = tenantList.filter((t: RecentTenant) => t.status === 'active').length;
        const s = statsRes?.data ?? {};

        setStats({
          totalTenants: s.totalTenants ?? tenantsRes?.pagination?.total ?? 0,
          totalUsers: s.totalUsers ?? 0,
          activeSites,
          totalVideos: s.totalVideos ?? 0,
          mrrCents: s.mrrCents ?? 0,
        });
        setTenants(tenantList.slice(0, 5));
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const formatNumber = (n: number) => n.toLocaleString('pt-BR');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
        <p className="text-sm text-dark-400 mt-1">
          Visão geral da plataforma Frame Videos.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-dark-900 rounded-xl p-5 border border-dark-800 animate-pulse">
              <div className="h-4 bg-dark-800 rounded w-20 mb-3" />
              <div className="h-8 bg-dark-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatsCard
            title="MRR"
            value={`$${((stats?.mrrCents ?? 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
            iconColor="bg-green-600/20 text-green-400"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatsCard
            title="Total de Tenants"
            value={formatNumber(stats?.totalTenants ?? 0)}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatsCard
            title="Usuários Totais"
            value={formatNumber(stats?.totalUsers ?? 0)}
            iconColor="bg-blue-600/20 text-blue-400"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <StatsCard
            title="Vídeos Totais"
            value={formatNumber(stats?.totalVideos ?? 0)}
            iconColor="bg-purple-600/20 text-purple-400"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatsCard
            title="Sites Ativos"
            value={formatNumber(stats?.activeSites ?? 0)}
            iconColor="bg-yellow-600/20 text-yellow-400"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
              </svg>
            }
          />
        </div>
      )}

      {/* Recent Tenants */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">Últimos Tenants</h3>
        {tenants.length === 0 ? (
          <p className="text-sm text-dark-500">Nenhum tenant cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600/20 text-primary-400 text-xs font-semibold">
                    {tenant.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-100">{tenant.name}</p>
                    <p className="text-xs text-dark-500">{tenant.slug}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    tenant.status === 'active' ? 'text-green-400 bg-green-600/20' :
                    tenant.status === 'trial' ? 'text-yellow-400 bg-yellow-600/20' :
                    'text-dark-400 bg-dark-700'
                  }`}>
                    {tenant.status === 'active' ? 'Ativo' : tenant.status === 'trial' ? 'Trial' : tenant.status}
                  </span>
                  <p className="text-xs text-dark-500 mt-1">
                    {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
