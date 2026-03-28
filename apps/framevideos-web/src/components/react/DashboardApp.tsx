import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Spinner } from '@/components/ui/Spinner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

// Lazy imports
import { lazy, Suspense } from 'react';
const DashboardHome = lazy(() => import('@/react-pages/dashboard/DashboardHome'));
const Sites = lazy(() => import('@/react-pages/dashboard/Sites'));
const Plan = lazy(() => import('@/react-pages/dashboard/Plan'));
const Credits = lazy(() => import('@/react-pages/dashboard/Credits'));
const Settings = lazy(() => import('@/react-pages/dashboard/Settings'));

function LoadingFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner size="lg" className="text-primary-500" />
    </div>
  );
}

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-950">
        <div className="text-center">
          <Spinner size="lg" className="text-primary-500 mx-auto mb-4" />
          <p className="text-sm text-dark-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return <>{children}</>;
}

export default function DashboardApp() {
  return (
    <BrowserRouter>
      <AuthCheck>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route index path="/dashboard" element={<Suspense fallback={<LoadingFallback />}><DashboardHome /></Suspense>} />
            <Route path="/dashboard/sites" element={<Suspense fallback={<LoadingFallback />}><Sites /></Suspense>} />
            <Route path="/dashboard/plan" element={<Suspense fallback={<LoadingFallback />}><Plan /></Suspense>} />
            <Route path="/dashboard/credits" element={<Suspense fallback={<LoadingFallback />}><Credits /></Suspense>} />
            <Route path="/dashboard/settings" element={<Suspense fallback={<LoadingFallback />}><Settings /></Suspense>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthCheck>
    </BrowserRouter>
  );
}
