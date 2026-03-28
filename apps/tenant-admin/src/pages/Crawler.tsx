import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CrawlerSource {
  id: string;
  name: string;
  url: string;
  selectors: {
    videoLink: string;
    title: string;
    thumbnail: string;
    duration?: string;
  };
  schedule: 'manual' | 'daily' | 'weekly';
  active: boolean;
  lastRunAt: string | null;
  lastRun: {
    status: string;
    videos_found: number;
    videos_new: number;
  } | null;
  createdAt: string;
}

interface CrawlerRun {
  id: string;
  sourceId: string;
  sourceName: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  videosFound: number;
  videosNew: number;
  videosDuplicate: number;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

interface CrawlResult {
  runId: string;
  status: string;
  videosFound: number;
  videosNew: number;
  videosDuplicate: number;
  errors: string[];
}

interface BalanceData {
  balance: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-400' },
  running: { label: 'Executando', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Concluído', color: 'bg-green-500/20 text-green-400' },
  failed: { label: 'Falhou', color: 'bg-red-500/20 text-red-400' },
};

const SCHEDULE_LABELS: Record<string, string> = {
  manual: 'Manual',
  daily: 'Diário',
  weekly: 'Semanal',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CrawlerPage() {
  const [sources, setSources] = useState<CrawlerSource[]>([]);
  const [runs, setRuns] = useState<CrawlerRun[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<CrawlerSource | null>(null);
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [runsPage, setRunsPage] = useState(1);
  const [runsPagination, setRunsPagination] = useState({ total: 0, totalPages: 1 });

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSchedule, setFormSchedule] = useState<'manual' | 'daily' | 'weekly'>('manual');
  const [formVideoLink, setFormVideoLink] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formThumbnail, setFormThumbnail] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const loadSources = useCallback(async () => {
    try {
      const data = await api<PaginatedResponse<CrawlerSource>>('/api/v1/crawler/sources?limit=50');
      setSources(data.data);
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  }, []);

  const loadRuns = useCallback(async (page: number) => {
    try {
      const data = await api<PaginatedResponse<CrawlerRun>>(`/api/v1/crawler/runs?page=${page}&limit=15`);
      setRuns(data.data);
      setRunsPagination({ total: data.pagination.total, totalPages: data.pagination.totalPages });
      setRunsPage(page);
    } catch (err) {
      console.error('Failed to load runs:', err);
    }
  }, []);

  const loadBalance = useCallback(async () => {
    try {
      const data = await api<BalanceData>('/api/v1/credits/balance');
      setBalance(data.balance);
    } catch {
      // Credits endpoint may fail if no wallet
    }
  }, []);

  useEffect(() => {
    Promise.all([loadSources(), loadRuns(1), loadBalance()]).finally(() => setLoading(false));
  }, [loadSources, loadRuns, loadBalance]);

  // ─── Form handlers ──────────────────────────────────────────────────────────

  function openNewForm() {
    setEditingSource(null);
    setFormName('');
    setFormUrl('');
    setFormSchedule('manual');
    setFormVideoLink('');
    setFormTitle('');
    setFormThumbnail('');
    setFormDuration('');
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(source: CrawlerSource) {
    setEditingSource(source);
    setFormName(source.name);
    setFormUrl(source.url);
    setFormSchedule(source.schedule);
    setFormVideoLink(source.selectors.videoLink);
    setFormTitle(source.selectors.title);
    setFormThumbnail(source.selectors.thumbnail);
    setFormDuration(source.selectors.duration ?? '');
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSaving(true);

    const payload = {
      name: formName,
      url: formUrl,
      schedule: formSchedule,
      selectors: {
        videoLink: formVideoLink,
        title: formTitle,
        thumbnail: formThumbnail,
        ...(formDuration ? { duration: formDuration } : {}),
      },
    };

    try {
      if (editingSource) {
        await api(`/api/v1/crawler/sources/${editingSource.id}`, { method: 'PUT', body: payload });
      } else {
        await api('/api/v1/crawler/sources', { method: 'POST', body: payload });
      }
      setShowForm(false);
      await loadSources();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(sourceId: string) {
    if (!confirm('Tem certeza que deseja excluir esta source e todo o histórico de runs?')) return;
    try {
      await api(`/api/v1/crawler/sources/${sourceId}`, { method: 'DELETE' });
      await loadSources();
      await loadRuns(1);
    } catch (err) {
      console.error('Failed to delete source:', err);
    }
  }

  async function handleRun(sourceId: string) {
    setRunningSource(sourceId);
    try {
      const result = await api<CrawlResult>(`/api/v1/crawler/sources/${sourceId}/run`, { method: 'POST' });
      alert(
        result.status === 'completed'
          ? `✅ Crawl concluído!\nEncontrados: ${result.videosFound}\nNovos: ${result.videosNew}\nDuplicados: ${result.videosDuplicate}`
          : `❌ Crawl falhou: ${result.errors.join(', ')}`,
      );
      await loadSources();
      await loadRuns(1);
      await loadBalance();
    } catch (err: unknown) {
      alert(`Erro: ${err instanceof Error ? err.message : 'Falha na execução'}`);
    } finally {
      setRunningSource(null);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🕷️ Crawler</h1>
          <p className="text-gray-400 text-sm mt-1">Importe vídeos automaticamente de sites externos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-sm">
            🪙 {balance} créditos IA
          </div>
          <button
            onClick={openNewForm}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
          >
            + Nova Source
          </button>
        </div>
      </div>

      {/* Sources list */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold">Sources ({sources.length})</h2>
        </div>
        {sources.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Nenhuma source configurada.</p>
            <p className="text-sm mt-1">Clique em "Nova Source" para começar.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {sources.map((source) => (
              <div key={source.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{source.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${source.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {source.active ? 'Ativa' : 'Inativa'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                      {SCHEDULE_LABELS[source.schedule]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 truncate mt-0.5">{source.url}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    Último run: {formatDate(source.lastRunAt)}
                    {source.lastRun && (
                      <span className="ml-2">
                        ({source.lastRun.status} — {source.lastRun.videos_new} novos de {source.lastRun.videos_found})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRun(source.id)}
                    disabled={runningSource === source.id}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                  >
                    {runningSource === source.id ? '⏳ Executando...' : '▶ Executar'}
                  </button>
                  <button
                    onClick={() => openEditForm(source)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run history */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold">Histórico de Runs ({runsPagination.total})</h2>
        </div>
        {runs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum run registrado ainda.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase">
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Encontrados</th>
                    <th className="px-4 py-2 text-right">Novos</th>
                    <th className="px-4 py-2 text-right">Duplicados</th>
                    <th className="px-4 py-2 text-left">Erros</th>
                    <th className="px-4 py-2 text-left">Início</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {runs.map((run) => {
                    const badge = STATUS_BADGES[run.status] ?? STATUS_BADGES['pending']!;
                    return (
                      <tr key={run.id} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2 truncate max-w-[200px]">{run.sourceName ?? run.sourceId.slice(0, 8)}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">{run.videosFound}</td>
                        <td className="px-4 py-2 text-right text-green-400">{run.videosNew}</td>
                        <td className="px-4 py-2 text-right text-yellow-400">{run.videosDuplicate}</td>
                        <td className="px-4 py-2">
                          {run.errors.length > 0 ? (
                            <span className="text-red-400 text-xs" title={run.errors.join('\n')}>
                              {run.errors.length} erro(s)
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500">{formatDate(run.startedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {runsPagination.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Página {runsPage} de {runsPagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadRuns(runsPage - 1)}
                    disabled={runsPage <= 1}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => loadRuns(runsPage + 1)}
                    disabled={runsPage >= runsPagination.totalPages}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded text-sm"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">
              {editingSource ? '✏️ Editar Source' : '➕ Nova Source'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: PornHub Popular"
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">URL</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.com/videos"
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Agendamento</label>
                <select
                  value={formSchedule}
                  onChange={(e) => setFormSchedule(e.target.value as 'manual' | 'daily' | 'weekly')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="manual">Manual</option>
                  <option value="daily">Diário</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Seletores CSS</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Configure os seletores CSS para extrair dados da página. Ex: .video-card, a.title, img.thumb
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Link do vídeo *</label>
                    <input
                      type="text"
                      value={formVideoLink}
                      onChange={(e) => setFormVideoLink(e.target.value)}
                      placeholder="a.video-link ou .video-card"
                      required
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Título *</label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder=".video-title ou h3"
                      required
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Thumbnail *</label>
                    <input
                      type="text"
                      value={formThumbnail}
                      onChange={(e) => setFormThumbnail(e.target.value)}
                      placeholder="img.thumb ou .thumbnail"
                      required
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Duração (opcional)</label>
                    <input
                      type="text"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      placeholder=".duration ou span.time"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  {formSaving ? 'Salvando...' : editingSource ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
