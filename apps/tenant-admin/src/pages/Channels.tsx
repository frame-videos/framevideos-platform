import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { slugify } from '@/lib/utils';
import { TranslationBadges } from '@/components/TranslationBadges';
import { TranslationModal } from '@/components/TranslationModal';

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  videoCount?: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ChannelForm {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  locale: string;
}

const emptyForm: ChannelForm = { name: '', slug: '', description: '', logoUrl: '', locale: 'pt' };

const SUPPORTED_LOCALES = [
  { code: 'pt', label: 'Português' }, { code: 'en', label: 'English' }, { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' }, { code: 'de', label: 'Deutsch' }, { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' }, { code: 'zh', label: '中文' }, { code: 'ko', label: '한국어' },
  { code: 'ru', label: 'Русский' }, { code: 'nl', label: 'Nederlands' }, { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'Türkçe' }, { code: 'ar', label: 'العربية' },
];

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 24, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChannelForm>(emptyForm);
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Translation state
  const [translationsMap, setTranslationsMap] = useState<Record<string, Array<{ locale: string }>>>({});
  const [transModalOpen, setTransModalOpen] = useState(false);
  const [transTargetId, setTransTargetId] = useState('');
  const [transTargetName, setTransTargetName] = useState('');

  const loadChannels = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api<{ data: Channel[]; pagination: Pagination }>(
        `/api/v1/content/channels?page=${page}&limit=24`,
      );
      setChannels(data.data);
      setPagination(data.pagination);

      // Load translations batch
      if (data.data.length > 0) {
        const ids = data.data.map((c) => c.id).join(',');
        const transData = await api<{ data: Record<string, Array<{ locale: string }>> }>(
          `/api/v1/content/channels/translations-batch?ids=${ids}`,
        );
        setTranslationsMap(transData.data);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSlugManual(false);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (ch: Channel) => {
    setEditingId(ch.id);
    setForm({
      name: ch.name,
      slug: ch.slug,
      description: ch.description ?? '',
      logoUrl: ch.logoUrl ?? '',
    });
    setSlugManual(true);
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const handleNameChange = (val: string) => {
    setForm((f) => ({ ...f, name: val }));
    if (!slugManual) setForm((f) => ({ ...f, slug: slugify(val) }));
  };

  const handleSlugChange = (val: string) => {
    setForm((f) => ({ ...f, slug: val }));
    setSlugManual(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body = {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        logoUrl: form.logoUrl || undefined,
      };

      if (editingId) {
        await api(`/api/v1/content/channels/${editingId}`, { method: 'PUT', body });
      } else {
        await api('/api/v1/content/channels', { method: 'POST', body });
      }

      closeModal();
      loadChannels(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este canal?')) return;
    setDeleting(id);
    try {
      await api(`/api/v1/content/channels/${id}`, { method: 'DELETE' });
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(null);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Canais</h1>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Novo Canal
        </button>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Carregando...</div>
      ) : channels.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
          <p className="text-lg mb-2">Nenhum canal encontrado</p>
          <button onClick={openNew} className="text-purple-400 hover:text-purple-300 text-sm">
            Criar primeiro canal →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-800 rounded-lg overflow-hidden shrink-0">
                  {ch.logoUrl ? (
                    <img src={ch.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-lg">📺</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{ch.name}</p>
                  <p className="text-xs text-gray-500 truncate">{ch.slug}</p>
                </div>
              </div>
              {ch.description && (
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{ch.description}</p>
              )}
              <div className="mb-2">
                <TranslationBadges
                  translatedLocales={(translationsMap[ch.id] ?? []).map((t) => t.locale)}
                  defaultLocale="pt"
                />
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
                <button
                  onClick={() => openEdit(ch)}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    setTransTargetId(ch.id);
                    setTransTargetName(ch.name);
                    setTransModalOpen(true);
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300"
                  title="Traduzir"
                >
                  🌐
                </button>
                <button
                  onClick={() => handleDelete(ch.id)}
                  disabled={deleting === ch.id}
                  className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {deleting === ch.id ? '...' : 'Excluir'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {pagination.page > 1 && (
            <button
              onClick={() => loadChannels(pagination.page - 1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            >
              ←
            </button>
          )}
          <span className="text-sm text-gray-400">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages && (
            <button
              onClick={() => loadChannels(pagination.page + 1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            >
              →
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{editingId ? 'Editar Canal' : 'Novo Canal'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="field-locale" className={labelClass}>Idioma *</label>
                <select id="field-locale" name="locale" value={form.locale} onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))} className={inputClass}>
                  {SUPPORTED_LOCALES.map((loc) => (<option key={loc.code} value={loc.code}>{loc.label}</option>))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Idioma do nome e descrição abaixo</p>
              </div>

              <div>
                <label htmlFor="field-name" className={labelClass}>Nome *</label>
                <input
                  id="field-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Nome do canal"
                />
              </div>

              <div>
                <label htmlFor="field-slug" className={labelClass}>Slug</label>
                <input
                  id="field-slug"
                  name="slug"
                  type="text"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={inputClass}
                  placeholder="slug-do-canal"
                />
              </div>

              <div>
                <label htmlFor="field-description" className={labelClass}>Descrição</label>
                <textarea
                  id="field-description"
                  name="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className={inputClass}
                  placeholder="Descrição do canal..."
                />
              </div>

              <div>
                <label htmlFor="field-logoUrl" className={labelClass}>URL do Logo</label>
                <input
                  id="field-logoUrl"
                  name="logoUrl"
                  type="url"
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://..."
                />
                {form.logoUrl && (
                  <img
                    src={form.logoUrl}
                    alt="Preview"
                    className="mt-2 h-16 rounded object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                >
                  {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Translation Modal */}
      <TranslationModal
        open={transModalOpen}
        onClose={() => setTransModalOpen(false)}
        onSaved={() => loadChannels(pagination.page)}
        contentType="channels"
        contentId={transTargetId}
        existingLocales={(translationsMap[transTargetId] ?? []).map((t) => t.locale)}
        defaultLocale="pt"
        itemName={transTargetName}
      />
    </div>
  );
}
