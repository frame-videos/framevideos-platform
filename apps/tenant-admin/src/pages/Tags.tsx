import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Tag {
  id: string;
  name: string;
  slug: string;
  videoCount?: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 100, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Bulk input
  const [bulkInput, setBulkInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadTags = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '100' });
      if (search) params.set('search', search);
      const data = await api<{ data: Tag[]; pagination: Pagination }>(
        `/api/v1/content/tags?${params}`,
      );
      setTags(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleBulkAdd = async () => {
    const names = bulkInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    setAdding(true);
    setError('');

    try {
      if (names.length === 1) {
        await api('/api/v1/content/tags', { method: 'POST', body: { name: names[0] } });
      } else {
        await api('/api/v1/content/tags/bulk', { method: 'POST', body: { names } });
      }
      setBulkInput('');
      loadTags(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar tags');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tag?')) return;
    setDeleting(id);
    try {
      await api(`/api/v1/content/tags/${id}`, { method: 'DELETE' });
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Tags</h1>
        <span className="text-sm text-gray-500">{pagination.total} tags no total</span>
      </div>

      {/* Add tags */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
        <label htmlFor="field-bulkTags" className="block text-sm font-medium text-gray-300 mb-2">
          Adicionar Tags
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="field-bulkTags"
            name="bulkTags"
            type="text"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBulkAdd()}
            placeholder="tag1, tag2, tag3 (separadas por vírgula)"
            className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm"
          />
          <button
            onClick={handleBulkAdd}
            disabled={adding || !bulkInput.trim()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            {adding ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Separe múltiplas tags por vírgula para criar em lote.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          id="field-searchTags"
          name="searchTags"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadTags()}
          placeholder="Buscar tags..."
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <button
          onClick={() => loadTags()}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          Buscar
        </button>
      </div>

      {/* Tags grid */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : tags.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg mb-2">Nenhuma tag encontrada</p>
            <p className="text-sm">Use o campo acima para criar suas primeiras tags.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-600 transition-colors"
              >
                <span className="text-gray-500">#</span>
                <span>{tag.name}</span>
                <button
                  onClick={() => handleDelete(tag.id)}
                  disabled={deleting === tag.id}
                  className="ml-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  title="Excluir tag"
                >
                  {deleting === tag.id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {pagination.page > 1 && (
            <button
              onClick={() => loadTags(pagination.page - 1)}
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
              onClick={() => loadTags(pagination.page + 1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            >
              →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
