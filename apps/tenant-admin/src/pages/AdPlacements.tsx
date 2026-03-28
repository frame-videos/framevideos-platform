import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Placement {
  id: string;
  name: string;
  position: string;
  width: number;
  height: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const POSITION_LABELS: Record<string, string> = {
  header: '🔝 Header (728×90)',
  sidebar: '📐 Sidebar (300×250)',
  in_content: '📄 In-Content (468×60)',
  footer: '🔻 Footer (728×90)',
  overlay: '🎯 Overlay (320×480)',
};

const DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
  header: { width: 728, height: 90 },
  sidebar: { width: 300, height: 250 },
  in_content: { width: 468, height: 60 },
  footer: { width: 728, height: 90 },
  overlay: { width: 320, height: 480 },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AdPlacementsPage() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPosition, setFormPosition] = useState<string>('header');
  const [formWidth, setFormWidth] = useState(728);
  const [formHeight, setFormHeight] = useState(90);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: Placement[] }>('/api/v1/ads/placements');
      setPlacements(res.data);
    } catch (err) {
      console.error('Erro ao carregar placements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlacements(); }, [fetchPlacements]);

  const resetForm = () => {
    setFormName('');
    setFormPosition('header');
    setFormWidth(728);
    setFormHeight(90);
    setFormError('');
    setEditingId(null);
  };

  const handlePositionChange = (pos: string) => {
    setFormPosition(pos);
    const defaults = DEFAULT_SIZES[pos];
    if (defaults) {
      setFormWidth(defaults.width);
      setFormHeight(defaults.height);
    }
  };

  const handleEdit = (placement: Placement) => {
    setEditingId(placement.id);
    setFormName(placement.name);
    setFormPosition(placement.position);
    setFormWidth(placement.width);
    setFormHeight(placement.height);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSaving(true);

    try {
      const payload = {
        name: formName,
        position: formPosition,
        width: formWidth,
        height: formHeight,
      };

      if (editingId) {
        await api(`/api/v1/ads/placements/${editingId}`, { method: 'PUT', body: payload });
      } else {
        await api('/api/v1/ads/placements', { method: 'POST', body: payload });
      }

      setShowForm(false);
      resetForm();
      await fetchPlacements();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar placement');
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleActive = async (placement: Placement) => {
    try {
      await api(`/api/v1/ads/placements/${placement.id}`, {
        method: 'PUT',
        body: { isActive: !placement.isActive },
      });
      await fetchPlacements();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📍 Ad Placements</h1>
          <p className="text-gray-400 text-sm mt-1">Defina onde os anúncios aparecem no seu site</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? '✕ Fechar' : '+ Novo Placement'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold">
            {editingId ? '✏️ Editar Placement' : '📍 Novo Placement'}
          </h3>

          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-placementName" className="block text-sm font-medium text-gray-300 mb-1.5">Nome *</label>
              <input
                id="field-placementName"
                name="placementName"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="Banner Header Principal"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div>
              <label htmlFor="field-position" className="block text-sm font-medium text-gray-300 mb-1.5">Posição *</label>
              <select
                id="field-position"
                name="position"
                value={formPosition}
                onChange={(e) => handlePositionChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {Object.entries(POSITION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-width" className="block text-sm font-medium text-gray-300 mb-1.5">Largura (px)</label>
              <input
                id="field-width"
                name="width"
                type="number"
                value={formWidth}
                onChange={(e) => setFormWidth(parseInt(e.target.value) || 0)}
                min={1}
                max={2000}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div>
              <label htmlFor="field-height" className="block text-sm font-medium text-gray-300 mb-1.5">Altura (px)</label>
              <input
                id="field-height"
                name="height"
                type="number"
                value={formHeight}
                onChange={(e) => setFormHeight(parseInt(e.target.value) || 0)}
                min={1}
                max={2000}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2">Preview do tamanho:</p>
            <div
              className="border border-dashed border-gray-600 rounded flex items-center justify-center text-xs text-gray-500 mx-auto"
              style={{
                width: Math.min(formWidth, 600),
                height: Math.min(formHeight, 200),
                maxWidth: '100%',
              }}
            >
              {formWidth}×{formHeight}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formSaving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {formSaving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Placement'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : placements.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-lg font-medium">Nenhum placement configurado</p>
          <p className="text-sm mt-1">Crie placements para definir onde os anúncios aparecem</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {placements.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium truncate">{p.name}</h3>
                <button
                  onClick={() => handleToggleActive(p)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    p.isActive
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                  }`}
                >
                  {p.isActive ? '✓ Ativo' : '✕ Inativo'}
                </button>
              </div>
              <div className="text-sm text-gray-400">
                <p>{POSITION_LABELS[p.position] ?? p.position}</p>
                <p className="font-mono text-xs mt-1">{p.width}×{p.height}px</p>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                <button
                  onClick={() => handleEdit(p)}
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  ✏️ Editar
                </button>
                <span className="text-xs text-gray-600">ID: {p.id.slice(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
