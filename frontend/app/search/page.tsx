'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchBar from '@/app/components/SearchBar';
import VideoCard from '@/app/components/VideoCard';
import { API_BASE_URL } from '@/lib/config';

interface Video {
  id: string;
  title: string;
  thumbnail?: string;
  views: number;
  likes: number;
  duration: number;
  createdAt: string;
}

interface SearchResponse {
  videos: Video[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const query = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'date';
  const limit = 20;
  const offset = 0;

  useEffect(() => {
    const fetchVideos = async () => {
      if (!query) {
        setVideos([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({
          q: query,
          sort,
          limit: limit.toString(),
          offset: offset.toString(),
        });

        const response = await fetch(
          `${API_BASE_URL}/videos/search?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data: SearchResponse = await response.json();
        setVideos(data.videos);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [query, sort]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Search Videos</h1>

        <SearchBar showFilters={true} />

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && videos.length === 0 && query && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              No videos found for "{query}"
            </p>
          </div>
        )}

        {!loading && videos.length === 0 && !query && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              Enter a search term to find videos
            </p>
          </div>
        )}

        {videos.length > 0 && (
          <div className="mt-8">
            <p className="text-gray-600 mb-6">
              Found {total} video{total !== 1 ? 's' : ''} for "{query}"
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
