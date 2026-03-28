import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { Spinner } from '@/components/ui/Spinner';
import { AdminLayout } from '@/components/layout/AdminLayout';

import { lazy, Suspense } from 'react';
const AdminHome = lazy(() => import('@/react-pages/admin/AdminHome'));
const Tenants = lazy(() => import('@/react-pages/admin/Tenants'));
const Plans = lazy(() => import('@/react-pages/admin/Plans'));
const Users = lazy(() => import('@/react-pages/admin/Users'));
const AdminCredits = lazy(() => import('@/react-pages/admin/AdminCredits'));
const Revenue = lazy(() => import('@/react-pages/admin/Revenue'));
const AdminConfig = lazy(() => import('@/react-pages/admin/AdminConfig'));

function LoadingFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner size="lg" className="text-primary-500" />
    </div>
  );
}

function AdminCheck({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

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

  if (user?.role !== 'super_admin') {
    window.location.href = '/dashboard';
    return null;
  }

  return <>{children}</>;
}

export default function AdminApp() {
  return (
    <BrowserRouter>
      <AdminCheck>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index path="/admin" element={<Suspense fallback={<LoadingFallback />}><AdminHome /></Suspense>} />
            <Route path="/admin/tenants" element={<Suspense fallback={<LoadingFallback />}><Tenants /></Suspense>} />
            <Route path="/admin/plans" element={<Suspense fallback={<LoadingFallback />}><Plans /></Suspense>} />
            <Route path="/admin/users" element={<Suspense fallback={<LoadingFallback />}><Users /></Suspense>} />
            <Route path="/admin/credits" element={<Suspense fallback={<LoadingFallback />}><AdminCredits /></Suspense>} />
            <Route path="/admin/revenue" element={<Suspense fallback={<LoadingFallback />}><Revenue /></Suspense>} />
            <Route path="/admin/config" element={<Suspense fallback={<LoadingFallback />}><AdminConfig /></Suspense>} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </AdminCheck>
    </BrowserRouter>
  );
}
