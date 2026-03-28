import { useEffect, useState, useRef, type DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '@/lib/api';
import { slugify } from '@/lib/utils';

interface CategoryOption { id: string; name: string; }
interface TagOption { id: string; name: string; }
interface PerformerOption { id: string; name: string; }
interface ChannelOption { id: string; name: string; }

export function VideoFormPage() {
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
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number | ''>('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPerformers, setSelectedPerformers] = useState<string[]>([]);
  const [channelId, setChannelId] = useState('');

  // Thumbnail upload
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Options
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [performers, setPerformers] = useState<PerformerOption[]>([]);
  const [channels, setChannels] = useState<ChannelOption[]>([]);

  // Load options
  useEffect(() => {
    async function loadOptions() {
      try {
        const [catData, tagData, perfData, chData] = await Promise.all([
          api<{ data: CategoryOption[] }>('/api/v1/content/categories?limit=100'),
          api<{ data: TagOption[] }>('/api/v1/content/tags?limit=200'),
          api<{ data: PerformerOption[] }>('/api/v1/content/performers?limit=200'),
          api<{ data: ChannelOption[] }>('/api/v1/content/channels?limit=100'),
        ]);
        setCategories(catData.data);
        setTags(tagData.data);
        setPerformers(perfData.data);
        setChannels(chData.data);
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    }
    loadOptions();
  }, []);

  // Load video for editing
  useEffect(() => {
    if (!id) return;
    async function loadVideo() {
      try {
        const data = await api<{
          title: string; slug: string; description: string;
          videoUrl: string | null; embedUrl: string | null; thumbnailUrl: string | null;
          durationSeconds: number | null; status: string;
          categories: { id: string }[];
          tags: { id: string }[];
          performers: { id: string }[];
          channel: { id: string } | null;
        }>(`/api/v1/content/videos/${id}`);

        setTitle(data.title);
        setSlug(data.slug);
        setSlugManual(true);
        setDescription(data.description);
        setVideoUrl(data.videoUrl ?? '');
        setEmbedUrl(data.embedUrl ?? '');
        setThumbnailUrl(data.thumbnailUrl ?? '');
        setDurationSeconds(data.durationSeconds ?? '');
        setStatus(data.status as 'draft' | 'published' | 'archived');
        setSelectedCategories(data.categories.map((c) => c.id));
        setSelectedTags(data.tags.map((t) => t.id));
        setSelectedPerformers(data.performers.map((p) => p.id));
        setChannelId(data.channel?.id ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar vídeo');
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, [id]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugManual) setSlug(slugify(val));
  };

  // Thumbnail upload handlers
  const handleFileUpload = async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('Tipo de arquivo não permitido. Aceitos: JPEG, PNG, WebP, GIF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo: 5MB');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const result = await apiUpload<{ url: string }>('/api/v1/content/upload', file);
      setThumbnailUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const body = {
        title,
        slug,
        description,
        videoUrl: videoUrl || undefined,
        embedUrl: embedUrl || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        durationSeconds: durationSeconds !== '' ? Number(durationSeconds) : undefined,
        status,
        categoryIds: selectedCategories,
        tagIds: selectedTags,
        performerIds: selectedPerformers,
        channelId: channelId || undefined,
      };

      if (isEditing) {
        await api(`/api/v1/content/videos/${id}`, { method: 'PUT', body });
      } else {
        await api('/api/v1/content/videos', { method: 'POST', body });
      }

      navigate('/admin/videos');
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

  const inputClass = "w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-sm";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

  const toggleMultiSelect = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/videos')} className="text-gray-500 hover:text-white">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold">{isEditing ? 'Editar Vídeo' : 'Adicionar Vídeo'}</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title & Slug */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Título *</label>
            <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} required className={inputClass} placeholder="Título do vídeo" />
          </div>
          <div>
            <label className={labelClass}>Slug</label>
            <input type="text" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }} className={inputClass} placeholder="slug-do-video" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Descrição</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} placeholder="Descrição do vídeo..." />
        </div>

        {/* URLs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>URL do Vídeo</label>
            <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={inputClass} placeholder="https://..." />
          </div>
          <div>
            <label className={labelClass}>URL de Embed</label>
            <input type="url" value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} className={inputClass} placeholder="https://embed..." />
          </div>
        </div>

        {/* Thumbnail Upload */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Thumbnail</label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-purple-500 bg-purple-900/20'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileInput}
                className="hidden"
              />
              {uploading ? (
                <div className="py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto" />
                  <p className="text-sm text-gray-400 mt-2">Enviando...</p>
                </div>
              ) : thumbnailUrl ? (
                <div className="relative">
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail"
                    className="max-h-32 mx-auto rounded object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                  <p className="text-xs text-gray-500 mt-2">Clique ou arraste para trocar</p>
                </div>
              ) : (
                <div className="py-4">
                  <svg className="w-10 h-10 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-400">Arraste uma imagem ou clique para selecionar</p>
                  <p className="text-xs text-gray-600 mt-1">JPEG, PNG, WebP, GIF — máx. 5MB</p>
                </div>
              )}
            </div>
            {/* Fallback: manual URL */}
            <div className="mt-2">
              <input
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                className={inputClass}
                placeholder="Ou cole uma URL diretamente..."
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Duração (segundos)</label>
            <input type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value ? Number(e.target.value) : '')} min={0} className={inputClass} placeholder="360" />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className={labelClass}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')} className={inputClass}>
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select>
        </div>

        {/* Categories */}
        <div>
          <label className={labelClass}>Categorias</label>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700 min-h-[44px]">
            {categories.length === 0 ? (
              <span className="text-gray-500 text-sm">Nenhuma categoria criada</span>
            ) : (
              categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleMultiSelect(selectedCategories, setSelectedCategories, cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategories.includes(cat.id)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className={labelClass}>Tags</label>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700 min-h-[44px] max-h-48 overflow-y-auto">
            {tags.length === 0 ? (
              <span className="text-gray-500 text-sm">Nenhuma tag criada</span>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleMultiSelect(selectedTags, setSelectedTags, tag.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    selectedTags.includes(tag.id)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  #{tag.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Performers */}
        <div>
          <label className={labelClass}>Modelos</label>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-800 rounded-lg border border-gray-700 min-h-[44px] max-h-48 overflow-y-auto">
            {performers.length === 0 ? (
              <span className="text-gray-500 text-sm">Nenhum modelo criado</span>
            ) : (
              performers.map((perf) => (
                <button
                  key={perf.id}
                  type="button"
                  onClick={() => toggleMultiSelect(selectedPerformers, setSelectedPerformers, perf.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedPerformers.includes(perf.id)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {perf.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Channel */}
        <div>
          <label className={labelClass}>Canal</label>
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={inputClass}>
            <option value="">Nenhum canal</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Salvando...' : isEditing ? 'Atualizar Vídeo' : 'Criar Vídeo'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/videos')}
            className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
