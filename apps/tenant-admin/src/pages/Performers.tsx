import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { slugify } from '@/lib/utils';

interface Performer {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
  videoCount?: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PerformerForm {
  name: string;
  slug: string;
  bio: string;
  avatarUrl: string;
}

const emptyForm: PerformerForm = { name: '', slug: '', bio: '', avatarUrl: '' };

export function PerformersPage() {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 24, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PerformerForm>(emptyForm);
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPerformers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '24' });
      if (search) params.set('search', search);
      const data = await api<{ data: Performer[]; pagination: Pagination }>(
        `/api/v1/content/performers?${params}`,
      );
      setPerformers(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load performers:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadPerformers();
  }, [loadPerformers]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSlugManual(false);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (perf: Performer) => {
    setEditingId(perf.id);
    setForm({
      name: perf.name,
      slug: perf.slug,
      bio: perf.bio ?? '',
      avatarUrl: perf.avatarUrl ?? '',
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
        bio: form.bio || undefined,
        avatarUrl: form.avatarUrl || undefined,
      };

      if (editingId) {
        await api(`/api/v1/content/performers/${editingId}`, { method: 'PUT', body });
      } else {
        await api('/api/v1/content/performers', { method: 'POST', body });
      }

      closeModal();
      loadPerformers(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este modelo?')) return;
    setDeleting(id);
    try {
      await api(`/api/v1/content/performers/${id}`, { method: 'DELETE' });
      setPerformers((prev) => prev.filter((p) => p.id !== id));
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
        <h1 className="text-2xl font-bold">Modelos</h1>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Novo Modelo
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          id="field-searchPerformers"
          name="searchPerformers"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadPerformers()}
          placeholder="Buscar por nome..."
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <button
          onClick={() => loadPerformers()}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          Buscar
        </button>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Carregando...</div>
      ) : performers.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center text-gray-500">
          <p className="text-lg mb-2">Nenhum modelo encontrado</p>
          <button onClick={openNew} className="text-purple-400 hover:text-purple-300 text-sm">
            Criar primeiro modelo →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {performers.map((perf) => (
            <div
              key={perf.id}
              className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-800 rounded-full overflow-hidden shrink-0">
                  {perf.avatarUrl ? (
                    <img src={perf.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-lg">👤</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{perf.name}</p>
                  <p className="text-xs text-gray-500 truncate">{perf.slug}</p>
                </div>
              </div>
              {perf.bio && (
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{perf.bio}</p>
              )}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
                <button
                  onClick={() => openEdit(perf)}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(perf.id)}
                  disabled={deleting === perf.id}
                  className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {deleting === perf.id ? '...' : 'Excluir'}
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
              onClick={() => loadPerformers(pagination.page - 1)}
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
              onClick={() => loadPerformers(pagination.page + 1)}
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
          <div className="relative bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">{editingId ? 'Editar Modelo' : 'Novo Modelo'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Nome do modelo"
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
                  placeholder="slug-do-modelo"
                />
              </div>

              <div>
                <label htmlFor="field-bio" className={labelClass}>Bio</label>
                <textarea
                  id="field-bio"
                  name="bio"
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={4}
                  className={inputClass}
                  placeholder="Biografia do modelo..."
                />
              </div>

              <div>
                <label htmlFor="field-avatarUrl" className={labelClass}>URL do Avatar</label>
                <input
                  id="field-avatarUrl"
                  name="avatarUrl"
                  type="url"
                  value={form.avatarUrl}
                  onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://..."
                />
                {form.avatarUrl && (
                  <img
                    src={form.avatarUrl}
                    alt="Preview"
                    className="mt-2 h-16 w-16 rounded-full object-cover"
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
    </div>
  );
}
