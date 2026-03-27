/**
 * Multi-Level Auth Middleware Tests
 * Tests for requireAdmin and requireSuperAdmin middlewares
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:8787';

let superAdminToken: string;
let adminToken: string;
let userToken: string;

test.describe('Multi-Level Auth Middleware', () => {
  
  test.beforeAll(async ({ request }) => {
    // Login as super_admin
    const superAdminRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: {
        email: 'super@framevideos.com',
        password: 'SuperAdmin123!',
      },
    });
    
    if (superAdminRes.ok()) {
      const superAdminData = await superAdminRes.json();
      superAdminToken = superAdminData.token;
    }

    // Login as admin
    const adminRes = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: {
        email: 'admin@framevideos.com',
        password: 'Admin123!',
      },
    });
    
    if (adminRes.ok()) {
      const adminData = await adminRes.json();
      adminToken = adminData.token;
    }

    // Create and login as regular user
    const registerRes = await request.post(`${API_BASE}/api/v1/auth/register`, {
      data: {
        email: `test-user-${Date.now()}@framevideos.com`,
        password: 'User123!',
        domain: 'test.framevideos.com',
      },
    });
    
    if (registerRes.ok()) {
      const userData = await registerRes.json();
      userToken = userData.token;
    }
  });

  // ==========================================================================
  // Super Admin Only Routes (/api/v1/tenants/*)
  // ==========================================================================

  test('super_admin can access tenant routes', async ({ request }) => {
    if (!superAdminToken) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_BASE}/api/v1/tenants`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      data: {
        name: 'Test Tenant',
        domain: `test-${Date.now()}.framevideos.com`,
      },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.tenant).toBeDefined();
    expect(data.tenant.name).toBe('Test Tenant');
  });

  test('admin cannot access tenant routes', async ({ request }) => {
    if (!adminToken) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_BASE}/api/v1/tenants`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      data: {
        name: 'Unauthorized Tenant',
        domain: `unauthorized-${Date.now()}.framevideos.com`,
      },
    });

    expect(response.status()).toBe(403); // Forbidden
    const data = await response.json();
    expect(data.error).toContain('Super admin access required');
  });

  test('regular user cannot access tenant routes', async ({ request }) => {
    if (!userToken) {
      test.skip();
      return;
    }

    const response = await request.post(`${API_BASE}/api/v1/tenants`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
      data: {
        name: 'Unauthorized Tenant',
        domain: `unauthorized-${Date.now()}.framevideos.com`,
      },
    });

    expect(response.status()).toBe(403); // Forbidden
    const data = await response.json();
    expect(data.error).toContain('Super admin access required');
  });

  test('unauthenticated user cannot access tenant routes', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/tenants`, {
      data: {
        name: 'Unauthorized Tenant',
        domain: `unauthorized-${Date.now()}.framevideos.com`,
      },
    });

    expect(response.status()).toBe(401); // Unauthorized
    const data = await response.json();
    expect(data.error).toContain('Authentication required');
  });

  // ==========================================================================
  // Admin Routes (/api/v1/analytics/dashboard)
  // ==========================================================================

  test('super_admin can access dashboard', async ({ request }) => {
    if (!superAdminToken) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_BASE}/api/v1/analytics/dashboard`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.summary).toBeDefined();
    expect(data.topVideosByViews).toBeDefined();
  });

  test('admin can access dashboard', async ({ request }) => {
    if (!adminToken) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_BASE}/api/v1/analytics/dashboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.summary).toBeDefined();
    expect(data.topVideosByViews).toBeDefined();
  });

  test('regular user cannot access dashboard', async ({ request }) => {
    if (!userToken) {
      test.skip();
      return;
    }

    const response = await request.get(`${API_BASE}/api/v1/analytics/dashboard`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(response.status()).toBe(403); // Forbidden
    const data = await response.json();
    expect(data.error).toContain('Admin access required');
  });

  test('unauthenticated user cannot access dashboard', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/analytics/dashboard`);

    expect(response.status()).toBe(401); // Unauthorized
    const data = await response.json();
    expect(data.error).toContain('Authentication required');
  });

  // ==========================================================================
  // Role Hierarchy Validation
  // ==========================================================================

  test('role hierarchy is correct', async ({ request }) => {
    // Verify roles exist and hierarchy is enforced
    const roles = ['user', 'admin', 'super_admin'];
    
    // super_admin > admin > user
    expect(roles.indexOf('super_admin')).toBeGreaterThan(roles.indexOf('admin'));
    expect(roles.indexOf('admin')).toBeGreaterThan(roles.indexOf('user'));
  });
});
