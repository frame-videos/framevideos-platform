import Link from 'next/link';

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    description?: string;
    thumbnail_url?: string;
    duration?: number;
    views?: number;
    created_at?: string;
  };
}

export default function VideoCard({ video }: VideoCardProps) {
  return (
    <Link
      href={`/videos/${video.id}`}
      className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-500 transition"
    >
      <div className="aspect-video bg-gray-900 flex items-center justify-center">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-6xl">🎬</span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-white truncate">{video.title}</h3>
        {video.description && (
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
            {video.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{video.views || 0} visualizações</span>
          {video.duration && (
            <span>{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
