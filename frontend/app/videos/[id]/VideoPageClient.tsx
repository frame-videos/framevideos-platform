'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/video/VideoPlayer';
import { apiUrl } from '@/lib/api-url';
import { 
  Heart, 
  Eye, 
  Calendar, 
  User, 
  Share2,
  ChevronRight 
} from 'lucide-react';

interface Video {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  views: number;
  likes: number;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export default function VideoPageClient({ videoId }: { videoId: string }) {
  const router = useRouter();

  const [video, setVideo] = useState<Video | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVideo();
    loadRelatedVideos();
  }, [videoId]);

  const loadVideo = async () => {
    try {
      const res = await fetch(apiUrl(`/videos/${videoId}`));
      if (!res.ok) throw new Error('Failed to load video');
      
      const data = await res.json();
      setVideo(data);
      setLikeCount(data.likes || 0);
      
      // Check if user liked this video
      const likeRes = await fetch(apiUrl(`/videos/${videoId}/like`));
      if (likeRes.ok) {
        const likeData = await likeRes.json();
        setIsLiked(likeData.isLiked || false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedVideos = async () => {
    try {
      const res = await fetch(apiUrl(`/videos?limit=5&exclude=${videoId}`));
      if (res.ok) {
        const data = await res.json();
        setRelatedVideos(data.videos || []);
      }
    } catch (err) {
      console.error('Failed to load related videos:', err);
    }
  };

  const handleLike = async () => {
    try {
      const method = isLiked ? 'DELETE' : 'POST';
      const res = await fetch(apiUrl(`/videos/${videoId}/like`), { method });
      
      if (res.ok) {
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: video?.title,
          text: video?.description,
          url,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copiado para a área de transferência!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Vídeo não encontrado</h1>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Voltar para Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <VideoPlayer
              videoId={videoId}
              videoUrl={video.videoUrl}
              onViewTracked={() => {
                setVideo(prev => prev ? { ...prev, views: prev.views + 1 } : null);
              }}
            />

            {/* Video Info */}
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-white">{video.title}</h1>

              {/* Stats & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-800">
                <div className="flex items-center gap-6 text-gray-400">
                  <span className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    {video.views.toLocaleString()} views
                  </span>
                  <span className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {new Date(video.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                      isLiked
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                    {likeCount}
                  </button>

                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition"
                  >
                    <Share2 className="w-5 h-5" />
                    Compartilhar
                  </button>
                </div>
              </div>

              {/* Author */}
              <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg">
                {video.user.avatar ? (
                  <img
                    src={video.user.avatar}
                    alt={video.user.name}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-white font-semibold">{video.user.name}</h3>
                  <p className="text-gray-400 text-sm">Criador</p>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 bg-gray-900 rounded-lg">
                <h3 className="text-white font-semibold mb-2">Descrição</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{video.description}</p>
              </div>
            </div>
          </div>

          {/* Sidebar - Related Videos */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <h2 className="text-xl font-bold text-white mb-4">Vídeos Relacionados</h2>
              <div className="space-y-4">
                {relatedVideos.map((relatedVideo) => (
                  <div
                    key={relatedVideo.id}
                    onClick={() => router.push(`/videos/${relatedVideo.id}`)}
                    className="group cursor-pointer bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition"
                  >
                    <div className="relative aspect-video">
                      <img
                        src={relatedVideo.thumbnailUrl}
                        alt={relatedVideo.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition flex items-center justify-center">
                        <ChevronRight className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition" />
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-white font-medium line-clamp-2 mb-2">
                        {relatedVideo.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{relatedVideo.user.name}</span>
                        <span>•</span>
                        <span>{relatedVideo.views.toLocaleString()} views</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
