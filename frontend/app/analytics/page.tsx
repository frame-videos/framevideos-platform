'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Video, Heart, Clock, Download } from 'lucide-react';
import { StatsCard } from '@/components/analytics/StatsCard';
import { ViewsChart } from '@/components/analytics/ViewsChart';
import { TrendingChart } from '@/components/analytics/TrendingChart';
import { TopVideosTable } from '@/components/analytics/TopVideosTable';

type Period = '7d' | '30d' | '90d' | 'all';

interface DashboardData {
  overview: {
    totalViews: number;
    totalVideos: number;
    totalLikes: number;
    avgWatchTime: number;
    trends: {
      views: number;
      videos: number;
      likes: number;
      watchTime: number;
    };
  };
  viewsOverTime: {
    date: string;
    views: number;
  }[];
}

interface TrendingData {
  videos: {
    id: string;
    title: string;
    views: number;
    thumbnail: string;
    likes: number;
    avgWatchTime: number;
    category?: string;
  }[];
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [category, setCategory] = useState<string>('all');

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ['analytics-dashboard', period, category],
    queryFn: async () => {
      const params = new URLSearchParams({ period, category });
      const response = await fetch(`/api/v1/analytics/dashboard?${params}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
  });

  // Fetch trending data
  const { data: trendingData, isLoading: trendingLoading } = useQuery<TrendingData>({
    queryKey: ['analytics-trending', period, category],
    queryFn: async () => {
      const params = new URLSearchParams({ period, category, limit: '10' });
      const response = await fetch(`/api/v1/analytics/trending?${params}`);
      if (!response.ok) throw new Error('Failed to fetch trending data');
      return response.json();
    },
  });

  const formatWatchTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const exportToCSV = () => {
    if (!trendingData?.videos) return;

    const headers = ['Rank', 'Title', 'Views', 'Likes', 'Avg Watch Time', 'Category'];
    const rows = trendingData.videos.map((video, index) => [
      index + 1,
      `"${video.title.replace(/"/g, '""')}"`,
      video.views,
      video.likes,
      formatWatchTime(video.avgWatchTime),
      video.category || 'General',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const isLoading = dashboardLoading || trendingLoading;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track your video performance and engagement metrics
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            {/* Period Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="education">Education</option>
                <option value="entertainment">Entertainment</option>
                <option value="tech">Technology</option>
                <option value="music">Music</option>
              </select>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            disabled={!trendingData?.videos}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatsCard
                title="Total Views"
                value={dashboardData?.overview.totalViews.toLocaleString() || '0'}
                icon={Eye}
                trend={{
                  value: dashboardData?.overview.trends.views || 0,
                  isPositive: (dashboardData?.overview.trends.views || 0) >= 0,
                }}
              />
              <StatsCard
                title="Total Videos"
                value={dashboardData?.overview.totalVideos.toLocaleString() || '0'}
                icon={Video}
                trend={{
                  value: dashboardData?.overview.trends.videos || 0,
                  isPositive: (dashboardData?.overview.trends.videos || 0) >= 0,
                }}
              />
              <StatsCard
                title="Total Likes"
                value={dashboardData?.overview.totalLikes.toLocaleString() || '0'}
                icon={Heart}
                trend={{
                  value: dashboardData?.overview.trends.likes || 0,
                  isPositive: (dashboardData?.overview.trends.likes || 0) >= 0,
                }}
              />
              <StatsCard
                title="Avg Watch Time"
                value={formatWatchTime(dashboardData?.overview.avgWatchTime || 0)}
                icon={Clock}
                trend={{
                  value: dashboardData?.overview.trends.watchTime || 0,
                  isPositive: (dashboardData?.overview.trends.watchTime || 0) >= 0,
                }}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <ViewsChart data={dashboardData?.viewsOverTime || []} />
              <TrendingChart 
                data={trendingData?.videos.map(v => ({ title: v.title, views: v.views })) || []} 
              />
            </div>

            {/* Top Videos Table */}
            <TopVideosTable videos={trendingData?.videos || []} />
          </>
        )}
      </div>
    </div>
  );
}
