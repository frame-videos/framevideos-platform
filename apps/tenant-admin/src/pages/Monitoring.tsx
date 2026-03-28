import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface DomainStatus {
  domain: string;
  isPrimary: boolean;
  lastCheck: {
    statusCode: number;
    responseTimeMs: number;
    isHealthy: boolean;
    checkedAt: string;
  } | null;
  hasOpenIncident: boolean;
  incidentStartedAt: string | null;
}

interface Incident {
  id: string;
  domain: string;
  started_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
  status: string;
  alert_sent: boolean;
}

interface CheckResult {
  domain: string;
  statusCode: number;
  responseTimeMs: number;
  isHealthy: boolean;
  checkedAt: string;
}

function StatusBadge({ healthy }: { healthy: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        healthy ? 'bg-green-900/40 text-green-400 border border-green-800/50' : 'bg-red-900/40 text-red-400 border border-red-800/50'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${healthy ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
      {healthy ? 'Online' : 'Offline'}
    </span>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}min`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function MonitoringPage() {
  const [domains, setDomains] = useState<DomainStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [statusRes, incidentsRes] = await Promise.all([
        api<{ domains: DomainStatus[] }>('/api/v1/monitoring/status'),
        api<{ incidents: Incident[] }>('/api/v1/monitoring/incidents?limit=10'),
      ]);
      setDomains(statusRes.domains);
      setIncidents(incidentsRes.incidents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function runCheck(domain: string) {
    setChecking(domain);
    try {
      await api<CheckResult>('/api/v1/monitoring/check', {
        method: 'POST',
        body: { domain },
      });
      // Reload data after check
      await loadData();
    } catch (err) {
      console.error('Check failed:', err);
    } finally {
      setChecking(null);
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Monitoramento</h1>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-5 border border-gray-800 animate-pulse">
              <div className="h-5 bg-gray-800 rounded w-48 mb-3" />
              <div className="h-4 bg-gray-800 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Monitoramento</h1>
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300">{error}</div>
      </div>
    );
  }

  const allHealthy = domains.length > 0 && domains.every((d) => d.lastCheck?.isHealthy !== false && !d.hasOpenIncident);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Monitoramento</h1>

      {/* Overall status */}
      <div
        className={`rounded-xl p-5 border mb-6 ${
          allHealthy
            ? 'bg-green-900/20 border-green-800/50'
            : domains.length === 0
              ? 'bg-gray-900 border-gray-800'
              : 'bg-red-900/20 border-red-800/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{allHealthy ? '✅' : domains.length === 0 ? '🔍' : '⚠️'}</span>
          <div>
            <p className="text-lg font-semibold">
              {allHealthy
                ? 'Todos os domínios estão online'
                : domains.length === 0
                  ? 'Nenhum domínio ativo encontrado'
                  : 'Alguns domínios podem estar com problemas'}
            </p>
            <p className="text-sm text-gray-400">
              {domains.length} domínio{domains.length !== 1 ? 's' : ''} monitorado{domains.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Domain cards */}
      {domains.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-lg font-semibold">Domínios</h2>
          {domains.map((d) => (
            <div key={d.domain} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <StatusBadge healthy={d.lastCheck?.isHealthy !== false && !d.hasOpenIncident} />
                  <div>
                    <p className="font-medium">
                      {d.domain}
                      {d.isPrimary && (
                        <span className="ml-2 text-xs bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded-full">
                          primário
                        </span>
                      )}
                    </p>
                    {d.lastCheck && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        HTTP {d.lastCheck.statusCode} · {d.lastCheck.responseTimeMs}ms · {formatTime(d.lastCheck.checkedAt)}
                      </p>
                    )}
                    {d.hasOpenIncident && d.incidentStartedAt && (
                      <p className="text-xs text-red-400 mt-0.5">
                        ⚠️ Incidente aberto desde {formatTime(d.incidentStartedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => runCheck(d.domain)}
                  disabled={checking === d.domain}
                  className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {checking === d.domain ? '⏳ Verificando...' : '🔄 Verificar agora'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incidents */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-lg font-semibold mb-4">Incidentes recentes</h2>
        {incidents.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhum incidente registrado. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-2 pr-4">Domínio</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Início</th>
                  <th className="pb-2 pr-4">Resolução</th>
                  <th className="pb-2">Duração</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} className="border-b border-gray-800/50">
                    <td className="py-2.5 pr-4 font-medium">{inc.domain}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
                          inc.status === 'open'
                            ? 'bg-red-900/40 text-red-400'
                            : 'bg-green-900/40 text-green-400'
                        }`}
                      >
                        {inc.status === 'open' ? '🔴 Aberto' : '✅ Resolvido'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{formatTime(inc.started_at)}</td>
                    <td className="py-2.5 pr-4 text-gray-400">
                      {inc.resolved_at ? formatTime(inc.resolved_at) : '-'}
                    </td>
                    <td className="py-2.5 text-gray-400">{formatDuration(inc.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
