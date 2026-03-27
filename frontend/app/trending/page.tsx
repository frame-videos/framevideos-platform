'use client';

import { useEffect, useState } from 'react';
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
  score?: number;
}

export default function TrendingPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/videos/search/trending?limit=20`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch trending videos');
        }

        const data = await response.json();
        setVideos(data.videos);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch trending videos');
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">🔥 Trending Now</h1>
        <p className="text-gray-600 mb-8">
          Most viewed and liked videos right now
        </p>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && videos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No trending videos yet</p>
          </div>
        )}

        {videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video, index) => (
              <div key={video.id} className="relative">
                {index < 3 && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm z-10">
                    #{index + 1}
                  </div>
                )}
                <VideoCard video={video} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
