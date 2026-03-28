import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

// Pages
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import { ForgotPassword } from '@/pages/ForgotPassword';

// Dashboard pages
import { DashboardHome } from '@/pages/dashboard/DashboardHome';
import { Sites } from '@/pages/dashboard/Sites';
import { Plan } from '@/pages/dashboard/Plan';
import { Credits } from '@/pages/dashboard/Credits';
import { Settings } from '@/pages/dashboard/Settings';

// Admin pages
import { AdminHome } from '@/pages/admin/AdminHome';
import { Tenants } from '@/pages/admin/Tenants';
import { Plans } from '@/pages/admin/Plans';
import { Users } from '@/pages/admin/Users';
import { AdminCredits } from '@/pages/admin/AdminCredits';

// Layouts
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';

// Guards
import { AuthGuard } from '@/guards/AuthGuard';
import { AdminGuard } from '@/guards/AdminGuard';

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Dashboard — protected by auth */}
      <Route element={<AuthGuard />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/sites" element={<Sites />} />
          <Route path="/dashboard/plan" element={<Plan />} />
          <Route path="/dashboard/credits" element={<Credits />} />
          <Route path="/dashboard/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Admin — protected by auth + super_admin role */}
      <Route element={<AdminGuard />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/tenants" element={<Tenants />} />
          <Route path="/admin/plans" element={<Plans />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/credits" element={<AdminCredits />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="flex min-h-screen items-center justify-center bg-dark-950">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-primary-600 mb-4">404</h1>
              <p className="text-lg text-dark-300 mb-6">Página não encontrada</p>
              <a
                href="/"
                className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
              >
                ← Voltar para o início
              </a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
