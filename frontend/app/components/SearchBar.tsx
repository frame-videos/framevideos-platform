'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  showFilters?: boolean;
}

export default function SearchBar({
  placeholder = 'Search videos...',
  onSearch,
  showFilters = true,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'date');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (sort) params.append('sort', sort);

      // Update URL
      router.push(`/search?${params.toString()}`);

      // Call callback if provided
      if (onSearch) {
        onSearch(query);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    router.push('/search');
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {showFilters && (
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm font-medium text-gray-700">
              Sort by:
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Newest</option>
              <option value="views">Most Views</option>
              <option value="likes">Most Liked</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
