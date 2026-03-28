import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  status: string;
  budgetCents: number;
  spentCents: number;
  startDate: string;
  endDate: string | null;
  advertiserId: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse {
  data: Campaign[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500/20 text-gray-400' },
  active: { label: 'Ativa', color: 'bg-green-500/20 text-green-400' },
  paused: { label: 'Pausada', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Concluída', color: 'bg-blue-500/20 text-blue-400' },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/20 text-red-400' },
};

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api<PaginatedResponse>(`/api/v1/ads/campaigns?${params}`);
      setCampaigns(res.data);
      setPagination({ total: res.pagination.total, totalPages: res.pagination.totalPages });
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    setChangingStatus(campaignId);
    try {
      await api(`/api/v1/ads/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      await fetchCampaigns();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status');
    } finally {
      setChangingStatus(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📢 Campanhas de Anúncios</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie suas campanhas publicitárias</p>
        </div>
        <button
          onClick={() => navigate('/admin/ads/campaigns/new')}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Nova Campanha
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          id="field-statusFilter"
          name="statusFilter"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200"
        >
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="active">Ativa</option>
          <option value="paused">Pausada</option>
          <option value="completed">Concluída</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <span className="text-sm text-gray-500">{pagination.total} campanhas</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📢</p>
          <p className="text-lg font-medium">Nenhuma campanha encontrada</p>
          <p className="text-sm mt-1">Crie sua primeira campanha para começar a anunciar</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Orçamento</th>
                <th className="text-right px-4 py-3 font-medium">Gasto</th>
                <th className="text-left px-4 py-3 font-medium">Período</th>
                <th className="text-right px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((camp) => {
                const badge = STATUS_BADGES[camp.status] ?? { label: camp.status, color: 'bg-gray-500/20 text-gray-400' };
                const progress = camp.budgetCents > 0 ? Math.min(100, (camp.spentCents / camp.budgetCents) * 100) : 0;

                return (
                  <tr key={camp.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/ads/campaigns/${camp.id}`)}
                        className="text-purple-400 hover:text-purple-300 font-medium text-left"
                      >
                        {camp.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(camp.budgetCents)}
                      <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                        <div
                          className="bg-purple-500 h-1 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-400">
                      {formatCurrency(camp.spentCents)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {formatDate(camp.startDate)} — {formatDate(camp.endDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/admin/ads/campaigns/${camp.id}/edit`)}
                          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => navigate(`/admin/ads/campaigns/${camp.id}/creatives`)}
                          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                          title="Criativos"
                        >
                          🎨
                        </button>
                        {camp.status === 'draft' && (
                          <button
                            onClick={() => handleStatusChange(camp.id, 'active')}
                            disabled={changingStatus === camp.id}
                            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors"
                          >
                            ▶ Ativar
                          </button>
                        )}
                        {camp.status === 'active' && (
                          <button
                            onClick={() => handleStatusChange(camp.id, 'paused')}
                            disabled={changingStatus === camp.id}
                            className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded transition-colors"
                          >
                            ⏸ Pausar
                          </button>
                        )}
                        {camp.status === 'paused' && (
                          <button
                            onClick={() => handleStatusChange(camp.id, 'active')}
                            disabled={changingStatus === camp.id}
                            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors"
                          >
                            ▶ Retomar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm disabled:opacity-50"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-400">
            Página {page} de {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm disabled:opacity-50"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
