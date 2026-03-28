import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Summary {
  totalImpressions: number;
  totalClicks: number;
  totalSpentCents: number;
  ctr: string;
  activeCampaigns: number;
}

interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
  spentCents: number;
  ctr: string;
}

interface Campaign {
  id: string;
  name: string;
}

interface RevenueRecord {
  id: string;
  month: string;
  totalRevenueCents: number;
  tenantShareCents: number;
  platformShareCents: number;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

// Simple bar chart using CSS
function BarChart({ data, maxValue, label, color }: {
  data: { label: string; value: number }[];
  maxValue: number;
  label: string;
  color: string;
}) {
  if (data.length === 0) return <p className="text-gray-500 text-sm">Sem dados</p>;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-300">{label}</p>
      <div className="space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-16 text-gray-500 shrink-0">{d.label}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all`}
                style={{ width: `${maxValue > 0 ? (d.value / maxValue) * 100 : 0}%` }}
              />
            </div>
            <span className="w-16 text-right text-gray-400 shrink-0">{formatNumber(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [revenue, setRevenue] = useState<RevenueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, campaignsRes, revenueRes] = await Promise.all([
        api<Summary>('/api/v1/ads/reports/summary'),
        api<{ data: Campaign[] }>('/api/v1/ads/campaigns?limit=100'),
        api<{ data: RevenueRecord[] }>('/api/v1/ads/revenue'),
      ]);
      setSummary(summaryRes);
      setCampaigns(campaignsRes.data);
      setRevenue(revenueRes.data);

      // Load stats for first campaign
      if (campaignsRes.data.length > 0) {
        const firstId = selectedCampaign || campaignsRes.data[0]!.id;
        setSelectedCampaign(firstId);
        const statsRes = await api<{ data: DailyStat[] }>(`/api/v1/ads/reports/campaign/${firstId}?days=${days}`);
        setDailyStats(statsRes.data);
      }
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCampaignChange = async (campaignId: string) => {
    setSelectedCampaign(campaignId);
    try {
      const statsRes = await api<{ data: DailyStat[] }>(`/api/v1/ads/reports/campaign/${campaignId}?days=${days}`);
      setDailyStats(statsRes.data);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  const maxImpressions = Math.max(...dailyStats.map((s) => s.impressions), 1);
  const maxClicks = Math.max(...dailyStats.map((s) => s.clicks), 1);
  const maxSpent = Math.max(...dailyStats.map((s) => s.spentCents), 1);

  // Last 15 days for chart readability
  const chartData = dailyStats.slice(-15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📊 Relatórios de Anúncios</h1>
        <p className="text-gray-400 text-sm mt-1">Acompanhe o desempenho das suas campanhas</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">Impressões</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(summary.totalImpressions)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">Cliques</p>
            <p className="text-2xl font-bold mt-1">{formatNumber(summary.totalClicks)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">CTR</p>
            <p className="text-2xl font-bold mt-1">{summary.ctr}%</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">Total Gasto</p>
            <p className="text-2xl font-bold mt-1 text-green-400">{formatCurrency(summary.totalSpentCents)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">Campanhas Ativas</p>
            <p className="text-2xl font-bold mt-1 text-purple-400">{summary.activeCampaigns}</p>
          </div>
        </div>
      )}

      {/* Campaign Selector + Period */}
      <div className="flex items-center gap-3">
        <select
          value={selectedCampaign}
          onChange={(e) => handleCampaignChange(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
        >
          <option value={7}>7 dias</option>
          <option value={14}>14 dias</option>
          <option value={30}>30 dias</option>
          <option value={60}>60 dias</option>
          <option value={90}>90 dias</option>
        </select>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <BarChart
            data={chartData.map((s) => ({ label: s.date.slice(5), value: s.impressions }))}
            maxValue={maxImpressions}
            label="👁 Impressões por dia"
            color="bg-blue-500"
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <BarChart
            data={chartData.map((s) => ({ label: s.date.slice(5), value: s.clicks }))}
            maxValue={maxClicks}
            label="👆 Cliques por dia"
            color="bg-green-500"
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <BarChart
            data={chartData.map((s) => ({ label: s.date.slice(5), value: s.spentCents }))}
            maxValue={maxSpent}
            label="💰 Gasto por dia (centavos)"
            color="bg-purple-500"
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <BarChart
            data={chartData.map((s) => ({ label: s.date.slice(5), value: parseFloat(s.ctr) * 100 }))}
            maxValue={Math.max(...chartData.map((s) => parseFloat(s.ctr) * 100), 1)}
            label="📊 CTR por dia (%×100)"
            color="bg-yellow-500"
          />
        </div>
      </div>

      {/* Daily Stats Table */}
      {dailyStats.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="font-medium">📋 Detalhamento Diário</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                  <th className="text-right px-4 py-2 font-medium">Impressões</th>
                  <th className="text-right px-4 py-2 font-medium">Cliques</th>
                  <th className="text-right px-4 py-2 font-medium">CTR</th>
                  <th className="text-right px-4 py-2 font-medium">Gasto</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.slice().reverse().map((s) => (
                  <tr key={s.date} className="border-b border-gray-800/50">
                    <td className="px-4 py-2">{s.date}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatNumber(s.impressions)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatNumber(s.clicks)}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.ctr}%</td>
                    <td className="px-4 py-2 text-right font-mono text-green-400">{formatCurrency(s.spentCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue Share */}
      {revenue.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="font-medium">💰 Revenue Share Mensal</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-2 font-medium">Mês</th>
                <th className="text-right px-4 py-2 font-medium">Receita Total</th>
                <th className="text-right px-4 py-2 font-medium">Sua Parte</th>
                <th className="text-right px-4 py-2 font-medium">Plataforma</th>
              </tr>
            </thead>
            <tbody>
              {revenue.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/50">
                  <td className="px-4 py-2 font-medium">{r.month}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCurrency(r.totalRevenueCents)}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-400">{formatCurrency(r.tenantShareCents)}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-400">{formatCurrency(r.platformShareCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
