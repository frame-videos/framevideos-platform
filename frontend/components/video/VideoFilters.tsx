'use client';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface VideoFiltersProps {
  categories: Category[];
  tags: Tag[];
  selectedCategory: string;
  selectedTag: string;
  sortBy: 'date' | 'views' | 'title';
  sortOrder: 'asc' | 'desc';
  onCategoryChange: (categoryId: string) => void;
  onTagChange: (tagId: string) => void;
  onSortChange: (sortBy: 'date' | 'views' | 'title', sortOrder: 'asc' | 'desc') => void;
}

export default function VideoFilters({
  categories,
  tags,
  selectedCategory,
  selectedTag,
  sortBy,
  sortOrder,
  onCategoryChange,
  onTagChange,
  onSortChange,
}: VideoFiltersProps) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Categoria
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tag Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tag
          </label>
          <select
            value={selectedTag}
            onChange={(e) => onTagChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Todas</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ordenar por
          </label>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as any, sortOrder)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="date">Data</option>
              <option value="views">Visualizações</option>
              <option value="title">Título</option>
            </select>
            
            <button
              type="button"
              onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white hover:bg-gray-600 transition"
              title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
            >
              {sortOrder === 'asc' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {(selectedCategory || selectedTag || sortBy !== 'date' || sortOrder !== 'desc') && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-400">Filtros ativos:</span>
            
            {selectedCategory && (
              <span className="px-3 py-1 bg-primary-900 text-primary-200 rounded-full text-sm flex items-center gap-2">
                Categoria: {categories.find(c => c.id === selectedCategory)?.name}
                <button
                  onClick={() => onCategoryChange('')}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            
            {selectedTag && (
              <span className="px-3 py-1 bg-purple-900 text-purple-200 rounded-full text-sm flex items-center gap-2">
                Tag: {tags.find(t => t.id === selectedTag)?.name}
                <button
                  onClick={() => onTagChange('')}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
            
            {(sortBy !== 'date' || sortOrder !== 'desc') && (
              <span className="px-3 py-1 bg-green-900 text-green-200 rounded-full text-sm flex items-center gap-2">
                {sortBy === 'date' ? 'Data' : sortBy === 'views' ? 'Visualizações' : 'Título'}
                {' '}({sortOrder === 'asc' ? '↑' : '↓'})
                <button
                  onClick={() => onSortChange('date', 'desc')}
                  className="hover:text-white"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
