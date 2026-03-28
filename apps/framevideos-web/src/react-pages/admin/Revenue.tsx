import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/constants';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface MrrByPlan {
  plan_id: string;
  plan_name: string;
  subscriber_count: number;
  mrr_cents: number;
}

interface RevenueData {
  mrr: {
    totalCents: number;
    byPlan: MrrByPlan[];
  };
  credits: {
    revenueCents: number;
    totalCreditsSold: number;
  };
  llmCost: {
    totalCostCents: number;
  };
  adRevenue: {
    platformShareCents: number;
  };
  margin: {
    totalRevenueCents: number;
    totalCostCents: number;
    marginCents: number;
  };
}

export function Revenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}/api/v1/admin/revenue`, { headers });
        const json = await res.json();
        setData(json?.data ?? null);
      } catch (err) {
        console.error('Failed to load revenue:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const formatUsd = (cents: number) => `$${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const marginPct = data && data.margin.totalRevenueCents > 0
    ? Math.round((data.margin.marginCents / data.margin.totalRevenueCents) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Receita</h1>
        <p className="text-sm text-dark-400 mt-1">
          Visão detalhada de receita, custos e margem da plataforma.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-dark-900 rounded-xl p-5 border border-dark-800 animate-pulse">
              <div className="h-4 bg-dark-800 rounded w-20 mb-3" />
              <div className="h-8 bg-dark-800 rounded w-16" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard
              title="MRR Total"
              value={formatUsd(data.mrr.totalCents)}
              iconColor="bg-green-600/20 text-green-400"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatsCard
              title="Receita Créditos"
              value={formatUsd(data.credits.revenueCents)}
              iconColor="bg-blue-600/20 text-blue-400"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
            <StatsCard
              title="Receita Ads"
              value={formatUsd(data.adRevenue.platformShareCents)}
              iconColor="bg-purple-600/20 text-purple-400"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              }
            />
            <StatsCard
              title="Custo LLM"
              value={formatUsd(data.llmCost.totalCostCents)}
              iconColor="bg-red-600/20 text-red-400"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              }
            />
            <StatsCard
              title="Margem"
              value={`${marginPct}%`}
              iconColor="bg-yellow-600/20 text-yellow-400"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
          </div>

          {/* MRR Breakdown by Plan */}
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">MRR por Plano</h3>
            {data.mrr.byPlan.length === 0 ? (
              <p className="text-sm text-dark-500 py-4">Nenhuma assinatura ativa.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-3 font-medium text-dark-400">Plano</th>
                      <th className="pb-3 font-medium text-dark-400 text-right">Assinantes</th>
                      <th className="pb-3 font-medium text-dark-400 text-right">MRR</th>
                      <th className="pb-3 font-medium text-dark-400 text-right">% do Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mrr.byPlan.map((row) => {
                      const pct = data.mrr.totalCents > 0
                        ? Math.round((row.mrr_cents / data.mrr.totalCents) * 100)
                        : 0;
                      return (
                        <tr key={row.plan_id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 font-medium text-white">{row.plan_name}</td>
                          <td className="py-3 text-dark-200 text-right">{row.subscriber_count}</td>
                          <td className="py-3 text-dark-200 text-right font-mono">{formatUsd(row.mrr_cents)}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-dark-800 rounded-full h-1.5">
                                <div
                                  className="bg-primary-500 h-1.5 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-dark-400 text-xs w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border">
                      <td className="pt-3 font-semibold text-white">Total</td>
                      <td className="pt-3 text-dark-200 text-right font-semibold">
                        {data.mrr.byPlan.reduce((s, r) => s + r.subscriber_count, 0)}
                      </td>
                      <td className="pt-3 text-primary-400 text-right font-mono font-semibold">
                        {formatUsd(data.mrr.totalCents)}
                      </td>
                      <td className="pt-3 text-right">
                        <Badge variant="success">100%</Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* Revenue Summary */}
          <Card>
            <h3 className="text-lg font-semibold text-white mb-4">Resumo Financeiro</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-dark-300">Receita Assinaturas (MRR)</span>
                <span className="text-sm font-mono text-green-400">+{formatUsd(data.mrr.totalCents)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-dark-300">Receita Créditos LLM ({data.credits.totalCreditsSold.toLocaleString('pt-BR')} vendidos)</span>
                <span className="text-sm font-mono text-green-400">+{formatUsd(data.credits.revenueCents)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-dark-300">Receita Ads (plataforma)</span>
                <span className="text-sm font-mono text-green-400">+{formatUsd(data.adRevenue.platformShareCents)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-dark-300">Custo LLM</span>
                <span className="text-sm font-mono text-red-400">-{formatUsd(data.llmCost.totalCostCents)}</span>
              </div>
              <div className="flex items-center justify-between py-2 pt-3">
                <span className="text-sm font-semibold text-white">Margem Bruta</span>
                <span className={`text-sm font-mono font-semibold ${data.margin.marginCents >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatUsd(data.margin.marginCents)} ({marginPct}%)
                </span>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <div className="text-center py-12 text-dark-500">
          <p>Não foi possível carregar dados de receita.</p>
        </div>
      )}
    </div>
  );
}

export default Revenue;
