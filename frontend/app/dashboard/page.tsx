'use client';

import { useAuth } from '@/lib/hooks/use-auth';
import { useVideos } from '@/lib/hooks/use-videos';
import { useTrending } from '@/lib/hooks/use-analytics';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const { data: videos, isLoading: videosLoading } = useVideos();
  const { data: trending, isLoading: trendingLoading } = useTrending();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl mb-4">Você precisa estar logado</h1>
        <Link href="/auth/login" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
          Fazer Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">Bem-vindo, {user.email}</p>
        </div>
        <div className="space-x-4">
          <Link
            href="/upload"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-block"
          >
            + Upload Vídeo
          </Link>
          <button
            onClick={logout}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium">Total de Vídeos</h3>
          <p className="text-3xl font-bold mt-2">
            {videosLoading ? '...' : videos?.videos?.length || 0}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium">Vídeos em Alta</h3>
          <p className="text-3xl font-bold mt-2">
            {trendingLoading ? '...' : trending?.trending?.length || 0}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-gray-400 text-sm font-medium">Visualizações</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>
      </div>

      {/* Recent Videos */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Vídeos Recentes</h2>
        {videosLoading ? (
          <p className="text-gray-400">Carregando vídeos...</p>
        ) : videos?.videos?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {videos.videos.slice(0, 6).map((video: any) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition"
              >
                <div className="aspect-video bg-gray-900 rounded mb-2 flex items-center justify-center">
                  <span className="text-4xl">🎬</span>
                </div>
                <h3 className="font-medium truncate">{video.title}</h3>
                <p className="text-sm text-gray-400 truncate">{video.description}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">Nenhum vídeo ainda</p>
            <Link
              href="/upload"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-block"
            >
              Fazer Upload do Primeiro Vídeo
            </Link>
          </div>
        )}
      </div>

      {/* Trending */}
      {trending?.trending && trending.trending.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">🔥 Em Alta</h2>
          <div className="space-y-3">
            {trending.trending.slice(0, 5).map((video: any, index: number) => (
              <Link
                key={video.id}
                href={`/videos/${video.id}`}
                className="flex items-center space-x-4 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
              >
                <span className="text-2xl font-bold text-gray-500">#{index + 1}</span>
                <div className="flex-1">
                  <h3 className="font-medium">{video.title}</h3>
                  <p className="text-sm text-gray-400">
                    {video.views || 0} visualizações • {video.likes || 0} likes
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
