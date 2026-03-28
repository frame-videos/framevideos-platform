import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { slugify } from '@/lib/utils';

export function PageFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  // Load page for editing
  useEffect(() => {
    if (!id) return;
    async function loadPage() {
      try {
        const data = await api<{
          title: string;
          slug: string;
          content: string;
          status: string;
        }>(`/api/v1/content/pages/${id}`);

        setTitle(data.title);
        setSlug(data.slug);
        setSlugManual(true);
        setContent(data.content ?? '');
        setStatus(data.status as 'draft' | 'published');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar página');
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [id]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugManual) setSlug(slugify(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body = {
        title,
        slug,
        content,
        status,
      };

      if (isEditing) {
        await api(`/api/v1/content/pages/${id}`, { method: 'PUT', body });
      } else {
        await api('/api/v1/content/pages', { method: 'POST', body });
      }

      navigate('/admin/pages');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  const inputClass =
    'w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-300 mb-1.5';

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/pages')} className="text-gray-500 hover:text-white">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold">{isEditing ? 'Editar Página' : 'Nova Página'}</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Suggested templates for new pages */}
      {!isEditing && !title && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-400 mb-3">💡 Criar a partir de um modelo:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { title: 'Sobre', slug: 'about' },
              { title: 'Contato', slug: 'contact' },
              { title: 'Termos de Uso', slug: 'terms' },
              { title: 'Política de Privacidade', slug: 'privacy' },
              { title: 'DMCA', slug: 'dmca' },
            ].map((tpl) => (
              <button
                key={tpl.slug}
                type="button"
                onClick={() => {
                  setTitle(tpl.title);
                  setSlug(tpl.slug);
                  setSlugManual(true);
                }}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:border-purple-600 hover:text-purple-400 transition-colors"
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title & Slug */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              className={inputClass}
              placeholder="Título da página"
            />
          </div>
          <div>
            <label className={labelClass}>Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManual(true);
              }}
              className={inputClass}
              placeholder="slug-da-pagina"
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
            className={inputClass}
          >
            <option value="draft">Rascunho</option>
            <option value="published">Publicada</option>
          </select>
        </div>

        {/* Content */}
        <div>
          <label className={labelClass}>Conteúdo (Markdown)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className={`${inputClass} font-mono text-sm leading-relaxed`}
            placeholder="Escreva o conteúdo da página em Markdown..."
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Suporta Markdown: **negrito**, *itálico*, # títulos, [links](url), listas, etc.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : isEditing ? 'Atualizar Página' : 'Criar Página'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/pages')}
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
