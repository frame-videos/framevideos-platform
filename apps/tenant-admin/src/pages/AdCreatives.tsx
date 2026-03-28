import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Creative {
  id: string;
  name: string;
  status: string;
  creativeType: string;
  contentUrl: string;
  targetUrl: string;
  impressions: number;
  clicks: number;
  ctr: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  budgetCents: number;
  spentCents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending_review: { label: 'Em Revisão', color: 'bg-yellow-500/20 text-yellow-400' },
  approved: { label: 'Aprovado', color: 'bg-blue-500/20 text-blue-400' },
  rejected: { label: 'Rejeitado', color: 'bg-red-500/20 text-red-400' },
  active: { label: 'Ativo', color: 'bg-green-500/20 text-green-400' },
  paused: { label: 'Pausado', color: 'bg-gray-500/20 text-gray-400' },
};

const TYPE_LABELS: Record<string, string> = {
  image: '🖼️ Imagem',
  video: '🎬 Vídeo',
  html: '📄 HTML',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AdCreativesPage() {
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'image' | 'video' | 'html'>('image');
  const [formContentUrl, setFormContentUrl] = useState('');
  const [formTargetUrl, setFormTargetUrl] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const fetchData = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const [campRes, crRes] = await Promise.all([
        api<CampaignDetail>(`/api/v1/ads/campaigns/${campaignId}`),
        api<{ data: Creative[] }>(`/api/v1/ads/campaigns/${campaignId}/creatives`),
      ]);
      setCampaign(campRes);
      setCreatives(crRes.data);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateCreative = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSaving(true);

    try {
      await api(`/api/v1/ads/campaigns/${campaignId}/creatives`, {
        method: 'POST',
        body: {
          name: formName,
          creativeType: formType,
          contentUrl: formContentUrl,
          targetUrl: formTargetUrl,
        },
      });
      setShowForm(false);
      setFormName('');
      setFormContentUrl('');
      setFormTargetUrl('');
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar criativo');
    } finally {
      setFormSaving(false);
    }
  };

  const handleStatusChange = async (creativeId: string, newStatus: string) => {
    setChangingStatus(creativeId);
    try {
      await api(`/api/v1/ads/creatives/${creativeId}/status`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status');
    } finally {
      setChangingStatus(null);
    }
  };

  const handleFileUpload = async (creativeId: string, file: File) => {
    setUploadingFile(true);
    try {
      const res = await apiUpload<{ url: string }>(`/api/v1/ads/creatives/${creativeId}/upload`, file);
      await fetchData();
      alert(`Upload concluído: ${res.url}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro no upload');
    } finally {
      setUploadingFile(false);
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/ads')}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ← Campanhas
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">🎨 Criativos</h1>
          {campaign && (
            <p className="text-gray-400 text-sm mt-0.5">
              Campanha: <span className="text-purple-400">{campaign.name}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? '✕ Fechar' : '+ Novo Criativo'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreateCreative} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold">Novo Criativo</h3>

          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="field-creativeName" className="block text-sm font-medium text-gray-300 mb-1.5">Nome *</label>
              <input
                id="field-creativeName"
                name="creativeName"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="Banner Principal"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div>
              <label htmlFor="field-creativeType" className="block text-sm font-medium text-gray-300 mb-1.5">Tipo *</label>
              <select
                id="field-creativeType"
                name="creativeType"
                value={formType}
                onChange={(e) => setFormType(e.target.value as 'image' | 'video' | 'html')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="image">🖼️ Imagem</option>
                <option value="video">🎬 Vídeo</option>
                <option value="html">📄 HTML</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="field-contentUrl" className="block text-sm font-medium text-gray-300 mb-1.5">URL do Criativo *</label>
            <input
              id="field-contentUrl"
              name="contentUrl"
              type="url"
              value={formContentUrl}
              onChange={(e) => setFormContentUrl(e.target.value)}
              required
              placeholder="https://storage.framevideos.com/..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <p className="text-xs text-gray-500 mt-1">URL da imagem/vídeo do anúncio. Faça upload após criar o criativo.</p>
          </div>

          <div>
            <label htmlFor="field-targetUrl" className="block text-sm font-medium text-gray-300 mb-1.5">URL de Destino *</label>
            <input
              id="field-targetUrl"
              name="targetUrl"
              type="url"
              value={formTargetUrl}
              onChange={(e) => setFormTargetUrl(e.target.value)}
              required
              placeholder="https://exemplo.com/landing-page"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <p className="text-xs text-gray-500 mt-1">Para onde o usuário será redirecionado ao clicar no anúncio</p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formSaving}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {formSaving ? 'Criando...' : 'Criar Criativo'}
            </button>
          </div>
        </form>
      )}

      {/* Creatives List */}
      {creatives.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">🎨</p>
          <p className="text-lg font-medium">Nenhum criativo ainda</p>
          <p className="text-sm mt-1">Adicione criativos (imagens, vídeos) para esta campanha</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {creatives.map((cr) => {
            const badge = STATUS_BADGES[cr.status] ?? { label: cr.status, color: 'bg-gray-500/20 text-gray-400' };

            return (
              <div key={cr.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4">
                {/* Preview */}
                <div className="w-32 h-20 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {cr.creativeType === 'image' && cr.contentUrl ? (
                    <img src={cr.contentUrl} alt={cr.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{TYPE_LABELS[cr.creativeType]?.slice(0, 2) ?? '📄'}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{cr.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {TYPE_LABELS[cr.creativeType] ?? cr.creativeType} • Destino: {cr.targetUrl}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>👁 {cr.impressions.toLocaleString()} impressões</span>
                    <span>👆 {cr.clicks.toLocaleString()} cliques</span>
                    <span>📊 CTR: {cr.ctr}%</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5">
                  {/* Upload button */}
                  <label className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors cursor-pointer text-center">
                    📤 Upload
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(cr.id, f);
                      }}
                      disabled={uploadingFile}
                    />
                  </label>

                  {/* Status actions */}
                  {cr.status === 'pending_review' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(cr.id, 'approved')}
                        disabled={changingStatus === cr.id}
                        className="px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors"
                      >
                        ✓ Aprovar
                      </button>
                      <button
                        onClick={() => handleStatusChange(cr.id, 'rejected')}
                        disabled={changingStatus === cr.id}
                        className="px-2 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
                      >
                        ✕ Rejeitar
                      </button>
                    </>
                  )}
                  {cr.status === 'approved' && (
                    <button
                      onClick={() => handleStatusChange(cr.id, 'active')}
                      disabled={changingStatus === cr.id}
                      className="px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors"
                    >
                      ▶ Ativar
                    </button>
                  )}
                  {cr.status === 'active' && (
                    <button
                      onClick={() => handleStatusChange(cr.id, 'paused')}
                      disabled={changingStatus === cr.id}
                      className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 rounded transition-colors"
                    >
                      ⏸ Pausar
                    </button>
                  )}
                  {cr.status === 'paused' && (
                    <button
                      onClick={() => handleStatusChange(cr.id, 'active')}
                      disabled={changingStatus === cr.id}
                      className="px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded transition-colors"
                    >
                      ▶ Retomar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
