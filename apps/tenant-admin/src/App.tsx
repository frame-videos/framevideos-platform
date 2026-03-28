import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { AdminLayout } from '@/components/AdminLayout';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { VideosPage } from '@/pages/Videos';
import { VideoFormPage } from '@/pages/VideoForm';
import { CategoriesPage } from '@/pages/Categories';
import { TagsPage } from '@/pages/Tags';
import { PerformersPage } from '@/pages/Performers';
import { ChannelsPage } from '@/pages/Channels';
import { PagesPage } from '@/pages/Pages';
import { PageFormPage } from '@/pages/PageForm';
import { SettingsPage } from '@/pages/Settings';
import { AnalyticsPage } from '@/pages/Analytics';
import { MonitoringPage } from '@/pages/Monitoring';
import { CrawlerPage } from '@/pages/Crawler';
import { AdsPage } from '@/pages/Ads';
import { AdCampaignFormPage } from '@/pages/AdCampaignForm';
import { AdCreativesPage } from '@/pages/AdCreatives';
import { AdPlacementsPage } from '@/pages/AdPlacements';
import { AdReportsPage } from '@/pages/AdReports';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route
          path="/admin/*"
          element={
            <AuthGuard>
              <AdminLayout>
                <Routes>
                  <Route index element={<DashboardPage />} />
                  <Route path="videos" element={<VideosPage />} />
                  <Route path="videos/new" element={<VideoFormPage />} />
                  <Route path="videos/:id/edit" element={<VideoFormPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="tags" element={<TagsPage />} />
                  <Route path="performers" element={<PerformersPage />} />
                  <Route path="channels" element={<ChannelsPage />} />
                  <Route path="pages" element={<PagesPage />} />
                  <Route path="pages/new" element={<PageFormPage />} />
                  <Route path="pages/:id/edit" element={<PageFormPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="monitoring" element={<MonitoringPage />} />
                  <Route path="crawler" element={<CrawlerPage />} />
                  <Route path="ads" element={<AdsPage />} />
                  <Route path="ads/campaigns/new" element={<AdCampaignFormPage />} />
                  <Route path="ads/campaigns/:id/edit" element={<AdCampaignFormPage />} />
                  <Route path="ads/campaigns/:id/creatives" element={<AdCreativesPage />} />
                  <Route path="ads/placements" element={<AdPlacementsPage />} />
                  <Route path="ads/reports" element={<AdReportsPage />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </AdminLayout>
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
