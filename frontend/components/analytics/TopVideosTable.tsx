import { Eye, Heart, Clock } from 'lucide-react';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  avgWatchTime: number;
  category?: string;
}

interface TopVideosTableProps {
  videos: Video[];
}

export function TopVideosTable({ videos }: TopVideosTableProps) {
  const formatWatchTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Most Watched Videos
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Video
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Views
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Likes
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Avg Watch Time
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {videos.map((video, index) => (
              <tr key={video.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-20 relative mr-3">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-12 w-20 rounded object-cover"
                      />
                      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                        #{index + 1}
                      </div>
                    </div>
                    <div className="max-w-xs">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {video.title}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                    {video.category || 'General'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center text-sm text-gray-900 dark:text-white">
                    <Eye className="w-4 h-4 mr-1 text-gray-400" />
                    {video.views.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center text-sm text-gray-900 dark:text-white">
                    <Heart className="w-4 h-4 mr-1 text-red-400" />
                    {video.likes.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center text-sm text-gray-900 dark:text-white">
                    <Clock className="w-4 h-4 mr-1 text-gray-400" />
                    {formatWatchTime(video.avgWatchTime)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
