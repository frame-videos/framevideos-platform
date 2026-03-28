import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface DashboardData {
  period: string;
  totalPageviews: number;
  todayPageviews: number;
  dailyPageviews: Array<{ date: string; count: number }>;
  topPages: Array<{ path: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  devices: Array<{ device_type: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
}

const DEVICE_LABELS: Record<string, string> = {
  desktop: '🖥️ Desktop',
  mobile: '📱 Mobile',
  tablet: '📟 Tablet',
};

function BarChart({ data, maxValue }: { data: Array<{ label: string; value: number }>; maxValue: number }) {
  if (data.length === 0) {
    return <p className="text-gray-500 text-sm">Sem dados ainda.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-32 truncate shrink-0" title={item.label}>
              {item.label}
            </span>
            <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="text-xs text-gray-300 w-12 text-right shrink-0">
              {formatNumber(item.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DailyChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length === 0) {
    return <p className="text-gray-500 text-sm">Sem dados ainda.</p>;
  }

  // Sort by date ascending for chart
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const maxCount = Math.max(...sorted.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-40">
      {sorted.map((day) => {
        const pct = (day.count / maxCount) * 100;
        const dateLabel = day.date.slice(5); // MM-DD
        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] text-gray-400">{formatNumber(day.count)}</span>
            <div className="w-full bg-gray-800 rounded-t relative" style={{ height: '120px' }}>
              <div
                className="absolute bottom-0 w-full bg-purple-600 rounded-t transition-all duration-500"
                style={{ height: `${Math.max(pct, 3)}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-500 truncate w-full text-center">{dateLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await api<DashboardData>('/api/v1/analytics/dashboard');
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar analytics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-5 border border-gray-800 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-800 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const topPagesMax = data.topPages.length > 0 ? data.topPages[0]!.count : 1;
  const topRefMax = data.topReferrers.length > 0 ? data.topReferrers[0]!.count : 1;
  const devicesMax = data.devices.length > 0 ? Math.max(...data.devices.map((d) => d.count)) : 1;
  const countriesMax = data.countries.length > 0 ? data.countries[0]!.count : 1;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <p className="text-sm text-gray-400 mb-1">Pageviews (30 dias)</p>
          <p className="text-3xl font-bold text-purple-400">{formatNumber(data.totalPageviews)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <p className="text-sm text-gray-400 mb-1">Pageviews (hoje)</p>
          <p className="text-3xl font-bold text-green-400">{formatNumber(data.todayPageviews)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <p className="text-sm text-gray-400 mb-1">Média diária</p>
          <p className="text-3xl font-bold text-blue-400">
            {data.dailyPageviews.length > 0
              ? formatNumber(Math.round(data.totalPageviews / Math.max(data.dailyPageviews.length, 1)))
              : '0'}
          </p>
        </div>
      </div>

      {/* Daily chart */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <h2 className="text-lg font-semibold mb-4">Pageviews por dia</h2>
        <DailyChart data={data.dailyPageviews} />
      </div>

      {/* Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Pages */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Páginas mais visitadas</h2>
          <BarChart
            data={data.topPages.map((p) => ({ label: p.path, value: p.count }))}
            maxValue={topPagesMax}
          />
        </div>

        {/* Top Referrers */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Referências</h2>
          <BarChart
            data={data.topReferrers.map((r) => ({
              label: r.referrer || '(direto)',
              value: r.count,
            }))}
            maxValue={topRefMax}
          />
        </div>

        {/* Devices */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Dispositivos</h2>
          <BarChart
            data={data.devices.map((d) => ({
              label: DEVICE_LABELS[d.device_type] ?? d.device_type,
              value: d.count,
            }))}
            maxValue={devicesMax}
          />
        </div>

        {/* Countries */}
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Países</h2>
          <BarChart
            data={data.countries.map((co) => ({ label: co.country || '(desconhecido)', value: co.count }))}
            maxValue={countriesMax}
          />
        </div>
      </div>
    </div>
  );
}
