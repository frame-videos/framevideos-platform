import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { TranslationBadges } from '@/components/TranslationBadges';
import { TranslationModal } from '@/components/TranslationModal';

interface Video {
  id: string;
  slug: string;
  title: string;
  status: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  viewCount: number;
  createdAt: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 24, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Translation state
  const [translationsMap, setTranslationsMap] = useState<Record<string, Array<{ locale: string }>>>({});
  const [transModalOpen, setTransModalOpen] = useState(false);
  const [transTargetId, setTransTargetId] = useState('');
  const [transTargetName, setTransTargetName] = useState('');

  // Category options for filter
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  useEffect(() => {
    api<{ data: CategoryOption[] }>('/api/v1/content/categories?limit=100')
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const loadVideos = useCallback(async (page = 1) => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({ page: String(page), limit: '24' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category_id', categoryFilter);
      if (sortBy) params.set('sort', sortBy);

      const data = await api<{ data: Video[]; pagination: Pagination }>(`/api/v1/content/videos?${params}`);
      setVideos(data.data);
      setPagination(data.pagination);

      // Load translations batch
      if (data.data.length > 0) {
        const ids = data.data.map((v) => v.id).join(',');
        const transData = await api<{ data: Record<string, Array<{ locale: string }>> }>(
          `/api/v1/content/videos/translations-batch?ids=${ids}`,
        );
        setTranslationsMap(transData.data);
      }
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, sortBy]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este vídeo?')) return;
    setDeleting(id);
    try {
      await api(`/api/v1/content/videos/${id}`, { method: 'DELETE' });
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(null);
    }
  };

  // Bulk operations
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === videos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(videos.map((v) => v.id)));
    }
  };

  const handleBulkAction = async (action: 'publish' | 'draft' | 'archive' | 'delete') => {
    if (selectedIds.size === 0) return;
    const actionLabels: Record<string, string> = {
      publish: 'publicar',
      draft: 'mover para rascunho',
      archive: 'arquivar',
      delete: 'excluir',
    };
    if (!confirm(`Tem certeza que deseja ${actionLabels[action]} ${selectedIds.size} vídeo(s)?`)) return;

    setBulkLoading(true);
    try {
      const result = await api<{ success: number; failed: number }>('/api/v1/content/videos/bulk', {
        method: 'POST',
        body: { ids: [...selectedIds], action },
      });
      alert(`${result.success} vídeo(s) processado(s) com sucesso${result.failed > 0 ? `, ${result.failed} falha(s)` : ''}`);
      setSelectedIds(new Set());
      loadVideos(pagination.page);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro na operação em lote');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Vídeos</h1>
        <Link
          to="/admin/videos/new"
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Adicionar Vídeo
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadVideos()}
          placeholder="Buscar por título..."
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="">Todos os status</option>
          <option value="published">Publicado</option>
          <option value="draft">Rascunho</option>
          <option value="archived">Arquivado</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="">Todas as categorias</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="newest">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
          <option value="views">Mais vistos</option>
          <option value="title">Título A-Z</option>
        </select>
        <button
          onClick={() => loadVideos()}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          Buscar
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-purple-900/20 border border-purple-800/30 rounded-lg">
          <span className="text-sm text-purple-300 font-medium">
            {selectedIds.size} selecionado(s)
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => handleBulkAction('publish')}
              disabled={bulkLoading}
              className="px-3 py-1.5 bg-green-900/40 hover:bg-green-900/60 text-green-400 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Publicar
            </button>
            <button
              onClick={() => handleBulkAction('draft')}
              disabled={bulkLoading}
              className="px-3 py-1.5 bg-yellow-900/40 hover:bg-yellow-900/60 text-yellow-400 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Rascunho
            </button>
            <button
              onClick={() => handleBulkAction('archive')}
              disabled={bulkLoading}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Arquivar
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={bulkLoading}
              className="px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Excluir
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : videos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg mb-2">Nenhum vídeo encontrado</p>
            <Link to="/admin/videos/new" className="text-purple-400 hover:text-purple-300 text-sm">
              Criar primeiro vídeo →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === videos.length && videos.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500/50"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Vídeo</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Duração</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Views</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Idiomas</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {videos.map((video) => (
                  <tr key={video.id} className={`hover:bg-gray-800/50 ${selectedIds.has(video.id) ? 'bg-purple-900/10' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(video.id)}
                        onChange={() => toggleSelect(video.id)}
                        className="rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500/50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-10 bg-gray-800 rounded overflow-hidden shrink-0">
                          {video.thumbnailUrl ? (
                            <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">🎬</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate">{video.title}</p>
                          <p className="text-xs text-gray-500 truncate">{video.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs rounded-full border ${
                          video.status === 'published'
                            ? 'bg-green-900/30 text-green-400 border-green-800/50'
                            : video.status === 'draft'
                            ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50'
                            : 'bg-gray-800 text-gray-400 border-gray-700'
                        }`}
                      >
                        {video.status === 'published' ? 'Publicado' : video.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                      {formatDuration(video.durationSeconds) || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                      {video.viewCount.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <TranslationBadges
                        translatedLocales={(translationsMap[video.id] ?? []).map((t) => t.locale)}
                        defaultLocale="pt"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/videos/${video.id}/edit`}
                          className="text-sm text-purple-400 hover:text-purple-300"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => {
                            setTransTargetId(video.id);
                            setTransTargetName(video.title);
                            setTransModalOpen(true);
                          }}
                          className="text-sm text-blue-400 hover:text-blue-300"
                          title="Traduzir"
                        >
                          🌐
                        </button>
                        <button
                          onClick={() => handleDelete(video.id)}
                          disabled={deleting === video.id}
                          className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          {deleting === video.id ? '...' : 'Excluir'}
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
              onClick={() => loadVideos(pagination.page - 1)}
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
              onClick={() => loadVideos(pagination.page + 1)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            >
              →
            </button>
          )}
        </div>
      )}

      {/* Translation Modal */}
      <TranslationModal
        open={transModalOpen}
        onClose={() => setTransModalOpen(false)}
        onSaved={() => loadVideos(pagination.page)}
        contentType="videos"
        contentId={transTargetId}
        existingLocales={(translationsMap[transTargetId] ?? []).map((t) => t.locale)}
        defaultLocale="pt"
        itemName={transTargetName}
      />
    </div>
  );
}
