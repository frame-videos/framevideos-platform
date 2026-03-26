/**
 * Analytics Widgets for Frame Videos
 * Reusable components for displaying analytics data
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';

// ============================================
// Video Stats Widget
// ============================================

interface VideoStatsProps {
  videoId: string;
  onLikeChange?: (liked: boolean) => void;
}

export function VideoStats({ videoId, onLikeChange }: VideoStatsProps) {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [interaction, setInteraction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [videoId, isAuthenticated]);

  async function fetchStats() {
    try {
      setLoading(true);
      
      // Fetch analytics
      const analyticsRes = await fetch(`/api/v1/analytics/videos/${videoId}`, {
        headers: {
          
        },
      });
      const analyticsData = await analyticsRes.json();
      setStats(analyticsData.analytics);

      // Fetch user interaction if authenticated
      if (isAuthenticated) {
        const interactionRes = await fetch(
          `/api/v1/analytics/videos/${videoId}/interaction`,
          {
            headers: {
              
            },
          }
        );
        const interactionData = await interactionRes.json();
        setInteraction(interactionData.interaction);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLike() {
    if (!isAuthenticated) {
      // Redirect to login
      window.location.href = '/login';
      return;
    }

    try {
      setLiking(true);
      const res = await fetch(`/api/v1/analytics/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
          
        },
      });
      
      const data = await res.json();
      
      // Update local state
      setInteraction({ ...interaction, liked: data.liked });
      setStats({
        ...stats,
        likes: stats.likes + (data.liked ? 1 : -1),
      });
      
      onLikeChange?.(data.liked);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setLiking(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading stats...</div>;
  }

  if (!stats) {
    return <div>No stats available</div>;
  }

  return (
    <div className="flex items-center gap-4 text-sm text-gray-600">
      {/* Views */}
      <div className="flex items-center gap-1">
        <span>👁️</span>
        <span>{stats.views?.toLocaleString() || 0}</span>
      </div>

      {/* Likes */}
      <button
        onClick={handleLike}
        disabled={liking}
        className={`flex items-center gap-1 px-2 py-1 rounded transition ${
          interaction?.liked
            ? 'bg-red-100 text-red-600'
            : 'hover:bg-gray-100 text-gray-600'
        }`}
      >
        <span>{interaction?.liked ? '❤️' : '🤍'}</span>
        <span>{stats.likes?.toLocaleString() || 0}</span>
      </button>

      {/* Comments */}
      <div className="flex items-center gap-1">
        <span>💬</span>
        <span>{stats.comments?.toLocaleString() || 0}</span>
      </div>

      {/* Share */}
      <div className="flex items-center gap-1">
        <span>📤</span>
        <span>{stats.shares?.toLocaleString() || 0}</span>
      </div>
    </div>
  );
}

// ============================================
// Trending Videos Widget
// ============================================

interface TrendingWidgetProps {
  limit?: number;
  className?: string;
}

export function TrendingVideos({ limit = 5, className = '' }: TrendingWidgetProps) {
  const { isAuthenticated } = useAuth();
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrending();
  }, [isAuthenticated, limit]);

  async function fetchTrending() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/analytics/trending?limit=${limit}`, {
        headers: {
          
        },
      });
      const data = await res.json();
      setTrending(data.trending || []);
    } catch (error) {
      console.error('Failed to fetch trending:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading trending...</div>;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="font-semibold text-lg">🔥 Trending Now</h3>
      {trending.map((item: any, index: number) => (
        <a
          key={item.videoId}
          href={`/videos/${item.videoId}`}
          className="block p-3 rounded-lg hover:bg-gray-100 transition"
        >
          <div className="flex gap-3">
            {/* Rank Badge */}
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {index + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">
                {item.video?.title || 'Untitled'}
              </h4>
              <div className="flex gap-2 text-xs text-gray-500 mt-1">
                <span>👁️ {item.views?.toLocaleString()}</span>
                <span>❤️ {item.likes?.toLocaleString()}</span>
              </div>
            </div>

            {/* Score */}
            <div className="flex-shrink-0 text-right">
              <div className="text-sm font-semibold text-orange-600">
                {Math.round(item.score)}
              </div>
              <div className="text-xs text-gray-400">pts</div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ============================================
// Top Videos Widget
// ============================================

interface TopVideosWidgetProps {
  sortBy?: 'views' | 'likes';
  limit?: number;
  className?: string;
}

export function TopVideos({
  sortBy = 'views',
  limit = 10,
  className = '',
}: TopVideosWidgetProps) {
  const { isAuthenticated } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopVideos();
  }, [isAuthenticated, sortBy, limit]);

  async function fetchTopVideos() {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/v1/analytics/top?limit=${limit}&sortBy=${sortBy}`,
        {
          headers: {
            
          },
        }
      );
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to fetch top videos:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading top videos...</div>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="font-semibold text-lg">
        {sortBy === 'likes' ? '❤️ Most Liked' : '👁️ Most Viewed'}
      </h3>
      <div className="space-y-2">
        {videos.map((video: any) => (
          <a
            key={video.id}
            href={`/videos/${video.id}`}
            className="block p-2 rounded hover:bg-gray-100 transition"
          >
            <div className="font-medium text-sm truncate">{video.title}</div>
            <div className="text-xs text-gray-500 mt-1">
              {sortBy === 'likes' ? (
                <>❤️ {video.analytics?.likes?.toLocaleString() || 0} likes</>
              ) : (
                <>👁️ {video.analytics?.views?.toLocaleString() || 0} views</>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Dashboard Widget
// ============================================

export function AnalyticsDashboard() {
  const { isAuthenticated } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, [isAuthenticated]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/analytics/dashboard', {
        headers: {
          
        },
      });
      const data = await res.json();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading dashboard...</div>;
  }

  if (!dashboard) {
    return <div>No data available</div>;
  }

  const { stats, trending, recentVideos } = dashboard;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Views"
          value={stats.totalViews?.toLocaleString() || 0}
          icon="👁️"
        />
        <StatCard
          label="Total Likes"
          value={stats.totalLikes?.toLocaleString() || 0}
          icon="❤️"
        />
        <StatCard
          label="Videos"
          value={stats.totalVideos?.toLocaleString() || 0}
          icon="🎬"
        />
        <StatCard
          label="Avg Views"
          value={Math.round(stats.avgViewsPerVideo || 0).toLocaleString()}
          icon="📊"
        />
        <StatCard
          label="Avg Likes"
          value={Math.round(stats.avgLikesPerVideo || 0).toLocaleString()}
          icon="📈"
        />
      </div>

      {/* Trending & Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-4 border">
          <h3 className="font-semibold text-lg mb-4">🔥 Trending Videos</h3>
          <div className="space-y-3">
            {trending?.map((item: any, index: number) => (
              <a
                key={item.videoId}
                href={`/videos/${item.videoId}`}
                className="block p-2 rounded hover:bg-gray-100 transition"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {item.video?.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.views} views • {item.likes} likes
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border">
          <h3 className="font-semibold text-lg mb-4">📺 Recent Videos</h3>
          <div className="space-y-3">
            {recentVideos?.map((video: any) => (
              <a
                key={video.id}
                href={`/videos/${video.id}`}
                className="block p-2 rounded hover:bg-gray-100 transition"
              >
                <div className="font-medium text-sm truncate">
                  {video.title}
                </div>
                <div className="text-xs text-gray-500">
                  {video.analytics?.views || 0} views • {video.analytics?.likes || 0} likes
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg p-4 border">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

// ============================================
// Video Player Integration
// ============================================

export interface VideoPlayerWithAnalyticsProps {
  videoId: string;
  onPlaybackUpdate?: (watchTime: number) => void;
}

// export function useVideoAnalytics(videoId: string) {
//   const { isAuthenticated } = useAuth();
//   const [watchTime, setWatchTime] = useState(0);
//   const trackingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
// 
//   const trackWatchTime = React.useCallback(
//     async (currentTime: number, completed: boolean) => {
//       if (!isAuthenticated) return;
// 
//       try {
//         await fetch(`/api/v1/analytics/videos/${videoId}/view`, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             
//           },
//           body: JSON.stringify({
//             watchTime: Math.round(currentTime),
//             completed,
