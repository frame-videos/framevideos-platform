'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../lib/api';

interface Tag {
  id: string;
  name: string;
  slug: string;
  videoCount?: number;
  weight?: number;
  createdAt: string;
}

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  createdAt: string;
}

export default function TagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagCloud, setTagCloud] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<Tag[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [tagVideos, setTagVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [viewMode, setViewMode] = useState<'cloud' | 'list'>('cloud');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    loadTags();
    loadTagCloud();
  }, [router]);

  const loadTags = async () => {
    try {
      const response = await apiFetch('tags');
      if (!response.ok) throw new Error('Falha ao carregar tags');
      const data = await response.json();
      setTags(data.tags || []);
    } catch (err) {
      console.error('Erro ao carregar tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTagCloud = async () => {
    try {
      const response = await apiFetch('tags/cloud?limit=50');
      if (response.ok) {
        const data = await response.json();
        setTagCloud(data.tags || []);
      }
    } catch (err) {
      console.error('Erro ao carregar tag cloud:', err);
    }
  };

  const handleSearchChange = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 1) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }
    try {
      const response = await apiFetch(`tags/autocomplete?q=${encodeURIComponent(query)}&limit=8`);
      if (response.ok) {
        const data = await response.json();
        setAutocompleteResults(data.tags || []);
        setShowAutocomplete(true);
      }
    } catch (err) {
      console.error('Autocomplete error:', err);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `tags/${editingId}` : 'tags';
      const method = editingId ? 'PUT' : 'POST';
      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Falha ao salvar tag');
      }
      setFormData({ name: '' });
      setShowForm(false);
      setEditingId(null);
      loadTags();
      loadTagCloud();
    } catch (err: any) {
      console.error('Erro ao salvar tag:', err);
      alert(err.message || 'Erro ao salvar tag');
    }
  };

  const handleEdit = (tag: Tag) => {
    setFormData({ name: tag.name });
    setEditingId(tag.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tag?')) return;
    try {
      const response = await apiFetch(`tags/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao excluir tag');
      loadTags();
      loadTagCloud();
      if (selectedTag?.id === id) {
        setSelectedTag(null);
        setTagVideos([]);
      }
    } catch (err) {
      console.error('Erro ao excluir tag:', err);
      alert('Erro ao excluir tag');
    }
  };

  const handleTagClick = async (tag: Tag) => {
    setSelectedTag(tag);
    setLoadingVideos(true);
    try {
      const response = await apiFetch(`tags/${tag.id}/videos`);
      if (response.ok) {
        const data = await response.json();
        setTagVideos(data.videos || []);
      } else {
        setTagVideos([]);
      }
    } catch (err) {
      console.error('Erro ao carregar vídeos da tag:', err);
      setTagVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  const selectAutocompleteResult = (tag: Tag) => {
    setSearchQuery(tag.name);
    setShowAutocomplete(false);
    handleTagClick(tag);
  };

  const cancelEdit = () => {
    setFormData({ name: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const getTagCloudSize = (weight: number): string => {
    if (weight >= 5) return 'text-3xl font-bold';
    if (weight >= 4) return 'text-2xl font-semibold';
    if (weight >= 3) return 'text-xl font-medium';
    if (weight >= 2) return 'text-lg';
    return 'text-sm';
  };

  const getTagCloudColor = (weight: number): string => {
    if (weight >= 5) return 'text-yellow-400 hover:text-yellow-300';
    if (weight >= 4) return 'text-purple-400 hover:text-purple-300';
    if (weight >= 3) return 'text-green-400 hover:text-green-300';
    if (weight >= 2) return 'text-blue-400 hover:text-blue-300';
    return 'text-gray-400 hover:text-gray-200';
  };

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-xl text-gray-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-bold text-white hover:text-blue-400 transition">
            🎬 Frame Videos
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-gray-300 hover:text-white">Dashboard</Link>
            <Link href="/categories" className="text-gray-300 hover:text-white">Categorias</Link>
            <Link href="/tags" className="text-blue-400 font-semibold">Tags</Link>
            <Link href="/upload" className="text-gray-300 hover:text-white">Upload</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white">🏷️ Tags</h2>
          <div className="flex items-center space-x-3">
            <div className="flex bg-gray-800 rounded-lg border border-gray-700">
              <button
                onClick={() => setViewMode('cloud')}
                className={`px-4 py-2 rounded-l-lg text-sm font-semibold transition ${
                  viewMode === 'cloud' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                ☁️ Cloud
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-r-lg text-sm font-semibold transition ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                📋 Lista
              </button>
            </div>
            <button
              onClick={() => { setShowForm(!showForm); if (showForm) cancelEdit(); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              {showForm ? 'Cancelar' : '+ Nova Tag'}
            </button>
          </div>
        </div>

        {/* Search with Autocomplete */}
        <div className="mb-6 relative">
          <input
            type="text"
            placeholder="🔍 Buscar tags..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
            onFocus={() => { if (autocompleteResults.length > 0) setShowAutocomplete(true); }}
            className="w-full md:w-96 bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          />
          {showAutocomplete && autocompleteResults.length > 0 && (
            <div className="absolute z-10 w-full md:w-96 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {autocompleteResults.map((tag) => (
                <button
                  key={tag.id}
                  className="w-full text-left px-4 py-3 hover:bg-gray-700 transition flex items-center justify-between"
                  onMouseDown={() => selectAutocompleteResult(tag)}
                >
                  <span className="text-white">{tag.name}</span>
                  <span className="text-xs text-gray-500">{tag.slug}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingId ? '✏️ Editar Tag' : '➕ Nova Tag'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="Ex: tutorial, gameplay, review"
                  required
                />
              </div>
              <div className="flex space-x-4">
                <button type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition">
                  {editingId ? '💾 Salvar' : '✅ Criar'}
                </button>
                {editingId && (
                  <button type="button" onClick={cancelEdit}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Tag Detail View */}
        {selectedTag && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-blue-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">🏷️ {selectedTag.name}</h3>
              <button
                onClick={() => { setSelectedTag(null); setTagVideos([]); }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            {loadingVideos ? (
              <p className="text-gray-400">Carregando vídeos...</p>
            ) : tagVideos.length === 0 ? (
              <p className="text-gray-500">Nenhum vídeo com esta tag</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tagVideos.map((video) => (
                  <div key={video.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <h4 className="text-white font-semibold mb-2">{video.title}</h4>
                    <p className="text-gray-400 text-sm">{video.description?.slice(0, 100)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tag Cloud View */}
        {viewMode === 'cloud' && (
          <div className="bg-gray-800 rounded-lg p-8 mb-8 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-6">☁️ Tag Cloud</h3>
            {tagCloud.length === 0 ? (
              <p className="text-gray-500 text-center">Nenhuma tag com vídeos ainda</p>
            ) : (
              <div className="flex flex-wrap gap-4 items-center justify-center">
                {tagCloud.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag)}
                    className={`${getTagCloudSize(tag.weight || 1)} ${getTagCloudColor(tag.weight || 1)} transition-all duration-200 hover:scale-110 px-2 py-1`}
                    title={`${tag.name} (${tag.videoCount || 0} vídeos)`}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* List View / All Tags */}
        {(viewMode === 'list' || !searchQuery) && (
          <div>
            <h3 className="text-xl font-bold text-white mb-4">
              {viewMode === 'list' ? '📋 Todas as Tags' : '🏷️ Tags'}
            </h3>
            {filteredTags.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
                <p className="text-gray-400 text-lg mb-4">
                  {searchQuery ? 'Nenhuma tag encontrada' : 'Nenhuma tag criada ainda'}
                </p>
                {!searchQuery && (
                  <button onClick={() => setShowForm(true)}
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition">
                    Criar Primeira Tag
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {filteredTags.map((tag) => (
                  <div
                    key={tag.id}
                    className={`bg-gray-800 rounded-lg px-4 py-3 border transition flex items-center space-x-3 cursor-pointer ${
                      selectedTag?.id === tag.id
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-gray-700 hover:border-gray-500'
                    }`}
                    onClick={() => handleTagClick(tag)}
                  >
                    <span className="text-white font-semibold">#{tag.name}</span>
                    {tag.videoCount !== undefined && (
                      <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full">
                        {tag.videoCount}
                      </span>
                    )}
                    <div className="flex space-x-1 ml-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEdit(tag)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold transition"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(tag.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-semibold transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          Total: {tags.length} tag{tags.length !== 1 ? 's' : ''}
          {searchQuery && ` | Filtradas: ${filteredTags.length}`}
        </div>
      </div>
    </div>
  );
}