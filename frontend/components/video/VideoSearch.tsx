'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface VideoSearchProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
}

export default function VideoSearch({ onSearch, initialQuery = '' }: VideoSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    if (urlQuery !== query) {
      setQuery(urlQuery);
    }
  }, [searchParams, query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar vídeos por título ou descrição..."
          className="w-full px-4 py-3 pl-12 pr-24 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1 text-gray-400 hover:text-white transition"
              title="Limpar busca"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          
          <button
            type="submit"
            className="px-4 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded transition"
          >
            Buscar
          </button>
        </div>
      </div>

      {query && (
        <div className="mt-2 text-sm text-gray-400">
          Buscando por: <span className="text-white font-semibold">&quot;{query}&quot;</span>
        </div>
      )}
    </form>
  );
}
