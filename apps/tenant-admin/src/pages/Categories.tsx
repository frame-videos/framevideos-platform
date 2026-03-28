import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { slugify } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  videoCount?: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
}

const emptyForm: CategoryForm = { name: '', slug: '', description: '', imageUrl: '' };

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCategories = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api<{ data: Category[]; pagination: Pagination }>(
        `/api/v1/content/categories?page=${page}&limit=50`,
      );
      setCategories(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSlugManual(false);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? '',
      imageUrl: cat.imageUrl ?? '',
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
        imageUrl: form.imageUrl || undefined,
      };

      if (editingId) {
        await api(`/api/v1/content/categories/${editingId}`, { method: 'PUT', body });
      } else {
        await api('/api/v1/content/categories', { method: 'POST', body });
      }

      closeModal();
      loadCategories(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    setDeleting(id);
    try {
      await api(`/api/v1/content/categories/${id}`, { method: 'DELETE' });
      setCategories((prev) => prev.filter((c) => c.id !== id));
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
        <h1 className="text-2xl font-bold">Categorias</h1>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nova Categoria
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg mb-2">Nenhuma categoria encontrada</p>
            <button onClick={openNew} className="text-purple-400 hover:text-purple-300 text-sm">
              Criar primeira categoria →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Slug</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Descrição</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-800 rounded-lg overflow-hidden shrink-0">
                          {cat.imageUrl ? (
                            <img src={cat.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">📁</div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-200">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">{cat.slug}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                      <span className="truncate block max-w-xs">{cat.description || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(cat)}
                          className="text-sm text-purple-400 hover:text-purple-300"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id)}
                          disabled={deleting === cat.id}
                          className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          {deleting === cat.id ? '...' : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {pagination.page > 1 && (
            <button
              onClick={() => loadCategories(pagination.page - 1)}
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
              onClick={() => loadCategories(pagination.page + 1)}
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
              <h2 className="text-lg font-bold">{editingId ? 'Editar Categoria' : 'Nova Categoria'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Nome da categoria"
                />
              </div>

              <div>
                <label className={labelClass}>Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className={inputClass}
                  placeholder="slug-da-categoria"
                />
              </div>

              <div>
                <label className={labelClass}>Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className={inputClass}
                  placeholder="Descrição da categoria..."
                />
              </div>

              <div>
                <label className={labelClass}>URL da Imagem</label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://..."
                />
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="mt-2 h-20 rounded object-cover"
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
