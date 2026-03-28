import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  budgetCents: number;
  spentCents: number;
  startDate: string;
  endDate: string | null;
  advertiserId: string;
  creativeCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdCampaignFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [budgetReais, setBudgetReais] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const res = await api<CampaignDetail>(`/api/v1/ads/campaigns/${id}`);
        setName(res.name);
        setBudgetReais((res.budgetCents / 100).toFixed(2));
        setStartDate(res.startDate);
        setEndDate(res.endDate ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar campanha');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const budgetCents = Math.round(parseFloat(budgetReais) * 100);
    if (isNaN(budgetCents) || budgetCents < 100) {
      setError('Orçamento mínimo: R$ 1,00');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name,
        budgetCents,
        startDate,
        endDate: endDate || undefined,
      };

      if (isEditing) {
        await api(`/api/v1/ads/campaigns/${id}`, { method: 'PUT', body: payload });
      } else {
        await api('/api/v1/ads/campaigns', { method: 'POST', body: payload });
      }

      navigate('/admin/ads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar campanha');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/ads')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold">
          {isEditing ? '✏️ Editar Campanha' : '📢 Nova Campanha'}
        </h1>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Nome da campanha *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={200}
            placeholder="Ex: Promoção de Verão 2026"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Orçamento (R$) *
          </label>
          <input
            type="number"
            value={budgetReais}
            onChange={(e) => setBudgetReais(e.target.value)}
            required
            min="1"
            step="0.01"
            placeholder="100.00"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          <p className="text-xs text-gray-500 mt-1">Orçamento mínimo: R$ 1,00. Custo por clique: R$ 0,10</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Data de início *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Data de término
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <p className="text-xs text-gray-500 mt-1">Opcional. Sem data de término, roda até o orçamento acabar.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={() => navigate('/admin/ads')}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Campanha'}
          </button>
        </div>
      </form>
    </div>
  );
}
