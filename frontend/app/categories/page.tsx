'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  videoCount?: number;
  createdAt: string;
}

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  createdAt: string;
}

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryVideos, setCategoryVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    loadCategories();
  }, [router]);

  const loadCategories = async () => {
    try {
      const response = await apiFetch('categories');
      if (!response.ok) throw new Error('Falha ao carregar categorias');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `categories/${editingId}` : 'categories';
      const method = editingId ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Falha ao salvar categoria');
      }

      setFormData({ name: '', description: '' });
      setShowForm(false);
      setEditingId(null);
      loadCategories();
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err);
      alert(err.message || 'Erro ao salvar categoria');
    }
  };

  const handleEdit = (category: Category) => {
    setFormData({ name: category.name, description: category.description || '' });
    setEditingId(category.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    try {
      const response = await apiFetch(`categories/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Falha ao excluir categoria');
      loadCategories();
      if (selectedCategory?.id === id) {
        setSelectedCategory(null);
        setCategoryVideos([]);
      }
    } catch (err) {
      console.error('Erro ao excluir categoria:', err);
      alert('Erro ao excluir categoria');
    }
  };

  const handleCategoryClick = async (category: Category) => {
    setSelectedCategory(category);
    setLoadingVideos(true);
    try {
      const response = await apiFetch(`categories/${category.id}/videos`);
      if (!response.ok) throw new Error('Falha ao carregar vídeos');
      const data = await response.json();
      setCategoryVideos(data.videos || []);
    } catch (err) {
      console.error('Erro ao carregar vídeos da categoria:', err);
      setCategoryVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  const cancelEdit = () => {
    setFormData({ name: '', description: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.slug.toLowerCase().includes(searchQuery.toLowerCase())
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
            <Link href="/categories" className="text-blue-400 font-semibold">Categorias</Link>
            <Link href="/tags" className="text-gray-300 hover:text-white">Tags</Link>
            <Link href="/upload" className="text-gray-300 hover:text-white">Upload</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white">📁 Categorias</h2>
          <button
            onClick={() => { setShowForm(!showForm); if (showForm) cancelEdit(); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            {showForm ? 'Cancelar' : '+ Nova Categoria'}
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="🔍 Buscar categorias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-96 bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingId ? '✏️ Editar Categoria' : '➕ Nova Categoria'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="Ex: Ação e Aventura"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  rows={3}
                  placeholder="Descrição da categoria..."
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition"
                >
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

        {/* Category Detail View */}
        {selectedCategory && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-blue-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">
                📂 {selectedCategory.name}
              </h3>
              <button
                onClick={() => { setSelectedCategory(null); setCategoryVideos([]); }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            {selectedCategory.description && (
              <p className="text-gray-400 mb-4">{selectedCategory.description}</p>
            )}
            {loadingVideos ? (
              <p className="text-gray-400">Carregando vídeos...</p>
            ) : categoryVideos.length === 0 ? (
              <p className="text-gray-500">Nenhum vídeo nesta categoria</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryVideos.map((video) => (
                  <div key={video.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                    <h4 className="text-white font-semibold mb-2">{video.title}</h4>
                    <p className="text-gray-400 text-sm">{video.description?.slice(0, 100)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Categories Grid */}
        {filteredCategories.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <p className="text-gray-400 text-lg mb-4">
              {searchQuery ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria criada ainda'}
            </p>
            {!searchQuery && (
              <button onClick={() => setShowForm(true)}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition">
                Criar Primeira Categoria
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className={`bg-gray-800 rounded-lg p-6 border transition cursor-pointer ${
                  selectedCategory?.id === category.id
                    ? 'border-blue-500 ring-2 ring-blue-500/30'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
                onClick={() => handleCategoryClick(category)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-semibold text-white">{category.name}</h3>
                  <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                    {category.slug}
                  </span>
                </div>
                {category.description && (
                  <p className="text-gray-400 text-sm mb-4">{category.description}</p>
                )}
                {category.videoCount !== undefined && (
                  <p className="text-sm text-blue-400 mb-3">
                    🎬 {category.videoCount} vídeo{category.videoCount !== 1 ? 's' : ''}
                  </p>
                )}
                <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEdit(category)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          Total: {categories.length} categoria{categories.length !== 1 ? 's' : ''}
          {searchQuery && ` | Filtradas: ${filteredCategories.length}`}
        </div>
      </div>
    </div>
  );
}
