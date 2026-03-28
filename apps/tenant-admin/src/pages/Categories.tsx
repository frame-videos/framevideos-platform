import { useEffect, useState, useCallback, useRef } from 'react';
import { api, apiUpload } from '@/lib/api';
import { slugify } from '@/lib/utils';
import { TranslationBadges } from '@/components/TranslationBadges';
import { TranslationModal } from '@/components/TranslationModal';

const SUPPORTED_LOCALES = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'ru', label: 'Русский' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ar', label: 'العربية' },
];

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  videoCount?: number;
  createdAt: string;
}

interface TreeCategory extends Category {
  children: TreeCategory[];
  depth: number;
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
  locale: string;
}

const emptyForm: CategoryForm = { name: '', slug: '', description: '', imageUrl: '', locale: 'pt' };

/** Build a tree structure from flat categories */
function buildCategoryTree(categories: Category[]): TreeCategory[] {
  const map = new Map<string, TreeCategory>();
  const roots: TreeCategory[] = [];

  // Create tree nodes
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [], depth: 0 });
  }

  // Build hierarchy
  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      const parent = map.get(cat.parentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by sortOrder
  const sortChildren = (nodes: TreeCategory[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) sortChildren(node.children);
  };
  sortChildren(roots);

  return roots;
}

/** Flatten tree to a list with depth info for rendering */
function flattenTree(nodes: TreeCategory[]): TreeCategory[] {
  const result: TreeCategory[] = [];
  const walk = (items: TreeCategory[]) => {
    for (const item of items) {
      result.push(item);
      walk(item.children);
    }
  };
  walk(nodes);
  return result;
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Translation state
  const [translationsMap, setTranslationsMap] = useState<Record<string, Array<{ locale: string }>>>({});
  const [transModalOpen, setTransModalOpen] = useState(false);
  const [transTargetId, setTransTargetId] = useState('');
  const [transTargetName, setTransTargetName] = useState('');

  const loadCategories = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api<{ data: Category[]; pagination: Pagination }>(
        `/api/v1/content/categories?page=${page}&limit=50`,
      );
      setCategories(data.data);
      setPagination(data.pagination);

      // Load translations batch
      if (data.data.length > 0) {
        const ids = data.data.map((c) => c.id).join(',');
        const transData = await api<{ data: Record<string, Array<{ locale: string }>> }>(
          `/api/v1/content/categories/translations-batch?ids=${ids}`,
        );
        setTranslationsMap(transData.data);
      }
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
        locale: form.locale,
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

  const handleReorder = async (catId: string, direction: 'up' | 'down') => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    setReordering(true);
    try {
      const cat = categories[idx]!;
      const swap = categories[swapIdx]!;
      // Swap sort_order values via API
      await Promise.all([
        api(`/api/v1/content/categories/${cat.id}`, { method: 'PUT', body: { name: cat.name, slug: cat.slug, sortOrder: swap.sortOrder } }),
        api(`/api/v1/content/categories/${swap.id}`, { method: 'PUT', body: { name: swap.name, slug: swap.slug, sortOrder: cat.sortOrder } }),
      ]);
      loadCategories(pagination.page);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao reordenar');
    } finally {
      setReordering(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

  // Build tree for tree view
  const tree = buildCategoryTree(categories);
  const flatTree = flattenTree(tree);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Categorias</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${viewMode === 'tree' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Árvore
            </button>
          </div>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Nova Categoria
          </button>
        </div>
      </div>

      {/* Table / Tree View */}
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
        ) : viewMode === 'tree' ? (
          /* Tree View */
          <div className="p-4">
            {flatTree.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 py-2 px-3 hover:bg-gray-800/50 rounded-lg group"
                style={{ paddingLeft: `${cat.depth * 24 + 12}px` }}
              >
                {cat.depth > 0 && (
                  <span className="text-gray-700 text-xs">└─</span>
                )}
                <div className="w-8 h-8 bg-gray-800 rounded overflow-hidden shrink-0">
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">📁</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-200">{cat.name}</span>
                  <span className="text-xs text-gray-600 ml-2">/{cat.slug}</span>
                </div>
                {cat.children.length > 0 && (
                  <span className="text-xs text-gray-600">{cat.children.length} sub</span>
                )}
                <div className="flex items-center gap-1">
                  <TranslationBadges
                    translatedLocales={(translationsMap[cat.id] ?? []).map((t) => t.locale)}
                    defaultLocale="pt"
                    compact
                  />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleReorder(cat.id, 'up')}
                    disabled={reordering}
                    className="p-1 text-gray-500 hover:text-white text-xs disabled:opacity-30"
                    title="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleReorder(cat.id, 'down')}
                    disabled={reordering}
                    className="p-1 text-gray-500 hover:text-white text-xs disabled:opacity-30"
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                  <button onClick={() => openEdit(cat)} className="text-xs text-purple-400 hover:text-purple-300 px-1">
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setTransTargetId(cat.id);
                      setTransTargetName(cat.name);
                      setTransModalOpen(true);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 px-1"
                    title="Traduzir"
                  >
                    🌐
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    disabled={deleting === cat.id}
                    className="text-xs text-red-400 hover:text-red-300 px-1 disabled:opacity-50"
                  >
                    {deleting === cat.id ? '...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase w-10">Ordem</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Slug</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Descrição</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Idiomas</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {categories.map((cat, idx) => (
                  <tr key={cat.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleReorder(cat.id, 'up')}
                          disabled={idx === 0 || reordering}
                          className="text-gray-500 hover:text-white text-xs disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleReorder(cat.id, 'down')}
                          disabled={idx === categories.length - 1 || reordering}
                          className="text-gray-500 hover:text-white text-xs disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
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
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <TranslationBadges
                        translatedLocales={(translationsMap[cat.id] ?? []).map((t) => t.locale)}
                        defaultLocale="pt"
                      />
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
                          onClick={() => {
                            setTransTargetId(cat.id);
                            setTransTargetName(cat.name);
                            setTransModalOpen(true);
                          }}
                          className="text-sm text-blue-400 hover:text-blue-300"
                          title="Traduzir"
                        >
                          🌐
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
                <label htmlFor="field-locale" className={labelClass}>Idioma *</label>
                <select
                  id="field-locale"
                  name="locale"
                  value={form.locale}
                  onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
                  className={inputClass}
                >
                  {SUPPORTED_LOCALES.map((loc) => (
                    <option key={loc.code} value={loc.code}>{loc.label}</option>
                  ))}
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
                  placeholder="Nome da categoria"
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
                  placeholder="slug-da-categoria"
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
                  placeholder="Descrição da categoria..."
                />
              </div>

              <div>
                <label className={labelClass}>Imagem</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const res = await apiUpload<{ url: string }>('/api/v1/content/upload', file);
                        setForm((f) => ({ ...f, imageUrl: res.url }));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Erro no upload');
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
                  >
                    {uploading ? '⏳ Enviando...' : '📁 Upload Imagem'}
                  </button>
                  <span className="text-xs text-gray-500">ou</span>
                  <input
                    id="field-imageUrl"
                    name="imageUrl"
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    className={`${inputClass} flex-1`}
                    placeholder="https://..."
                  />
                </div>
                {form.imageUrl && (
                  <div className="mt-2 relative inline-block">
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="h-20 rounded object-cover"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-500"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
                <button
                  type="submit"
                  disabled={saving || uploading}
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
        onSaved={() => loadCategories(pagination.page)}
        contentType="categories"
        contentId={transTargetId}
        existingLocales={(translationsMap[transTargetId] ?? []).map((t) => t.locale)}
        defaultLocale="pt"
        itemName={transTargetName}
      />
    </div>
  );
}
