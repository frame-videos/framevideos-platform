import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
  updatedAt: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function PagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 24, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadPages = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await api<{ data: Page[]; pagination: Pagination }>(
        `/api/v1/content/pages?page=${page}&limit=24`,
      );
      setPages(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load pages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta página?')) return;
    setDeleting(id);
    try {
      await api(`/api/v1/content/pages/${id}`, { method: 'DELETE' });
      setPages((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Páginas</h1>
        <Link
          to="/admin/pages/new"
          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Nova Página
        </Link>
      </div>

      {/* Suggested pages hint */}
      {!loading && pages.length === 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-400 mb-2">💡 Páginas sugeridas para criar:</p>
          <div className="flex flex-wrap gap-2">
            {['Sobre', 'Contato', 'Termos de Uso', 'Política de Privacidade', 'DMCA'].map((name) => (
              <span key={name} className="px-2.5 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : pages.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg mb-2">Nenhuma página encontrada</p>
            <Link to="/admin/pages/new" className="text-purple-400 hover:text-purple-300 text-sm">
              Criar primeira página →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Página</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Atualizado</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {pages.map((page) => (
                  <tr key={page.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">{page.title}</p>
                        <p className="text-xs text-gray-500 truncate">/{page.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs rounded-full border ${
                          page.status === 'published'
                            ? 'bg-green-900/30 text-green-400 border-green-800/50'
                            : 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50'
                        }`}
                      >
                        {page.status === 'published' ? 'Publicada' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">
                      {formatDate(page.updatedAt || page.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/pages/${page.id}/edit`}
                          className="text-sm text-purple-400 hover:text-purple-300"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(page.id)}
                          disabled={deleting === page.id}
                          className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          {deleting === page.id ? '...' : 'Excluir'}
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
              onClick={() => loadPages(pagination.page - 1)}
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
              onClick={() => loadPages(pagination.page + 1)}
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
