/**
 * Tenant Lifecycle Tests
 * Task: 3.5 - Tenant Lifecycle
 * 
 * Tests for tenant lifecycle management:
 * - Activate tenant
 * - Suspend tenant
 * - Cancel tenant
 * - Reactivate tenant
 * - State transitions
 * - Access control based on status
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = 'http://localhost:8787';

// Test data
let superAdminToken: string;
let tenantId: string;
let tenantDomain: string;

describe('Tenant Lifecycle', () => {
  beforeAll(async () => {
    // Login as super_admin to get token
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@framevideos.com',
        password: 'SuperSecure123!@#',
      }),
    });
    const loginData = await loginRes.json();
    superAdminToken = loginData.token;

    // Create a test tenant
    const createRes = await fetch(`${API_URL}/api/super-admin/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Test Lifecycle Tenant',
        domain: `lifecycle-test-${Date.now()}.example.com`,
      }),
    });
    const createData = await createRes.json();
    tenantId = createData.tenant.id;
    tenantDomain = createData.tenant.domain;
  });

  describe('Tenant Suspension', () => {
    it('should suspend an active tenant', async () => {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          reason: 'Payment overdue',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tenant.status).toBe('suspended');
      expect(data.tenant.suspendedAt).toBeDefined();
      expect(data.tenant.suspendedReason).toBe('Payment overdue');
    });

    it('should block access to suspended tenant', async () => {
      // Try to access tenant via domain routing
      const res = await fetch(`${API_URL}/api/videos`, {
        headers: {
          'Host': tenantDomain,
        },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('suspended');
    });

    it('should not allow suspending already suspended tenant', async () => {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          reason: 'Already suspended',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already suspended');
    });
  });

  describe('Tenant Reactivation', () => {
    it('should reactivate a suspended tenant', async () => {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tenant.status).toBe('active');
      expect(data.tenant.reactivatedAt).toBeDefined();
      expect(data.tenant.suspendedAt).toBeNull();
      expect(data.tenant.suspendedReason).toBeNull();
    });

    it('should allow access to reactivated tenant', async () => {
      const res = await fetch(`${API_URL}/api/videos`, {
        headers: {
          'Host': tenantDomain,
        },
      });

      // Should not be 403 anymore (might be 401 if not authenticated, but not 403)
      expect(res.status).not.toBe(403);
    });

    it('should not allow reactivating already active tenant', async () => {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already active');
    });
  });

  describe('Tenant Cancellation', () => {
    it('should cancel a tenant', async () => {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          reason: 'Customer requested cancellation',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tenant.status).toBe('cancelled');
      expect(data.tenant.cancelledAt).toBeDefined();
      expect(data.tenant.cancelledReason).toBe('Customer requested cancellation');
    });

    it('should block access to cancelled tenant', async () => {
      const res = await fetch(`${API_URL}/api/videos`, {
        headers: {
          'Host': tenantDomain,
        },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('cancelled');
    });

    it('should not allow cancelling already cancelled tenant', async () => {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          reason: 'Already cancelled',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already cancelled');
    });
  });

  describe('Tenant Lifecycle Audit Log', () => {
    it('should log all lifecycle events', async () => {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/lifecycle-log`, {
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.logs).toBeDefined();
      expect(data.logs.length).toBeGreaterThan(0);

      // Check that we have the expected events
      const actions = data.logs.map((log: any) => log.action);
      expect(actions).toContain('suspended');
      expect(actions).toContain('reactivated');
      expect(actions).toContain('cancelled');
    });
  });

  describe('State Transitions', () => {
    let newTenantId: string;

    beforeAll(async () => {
      // Create a fresh tenant for state transition tests
      const createRes = await fetch(`${API_URL}/api/super-admin/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: 'State Transition Test',
          domain: `state-test-${Date.now()}.example.com`,
        }),
      });
      const createData = await createRes.json();
      newTenantId = createData.tenant.id;
    });

    it('should not allow reactivating a cancelled tenant', async () => {
      // Cancel the tenant first
      await fetch(`${API_URL}/api/super-admin/tenants/${newTenantId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          reason: 'Test cancellation',
        }),
      });

      // Try to reactivate
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${newTenantId}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Cannot reactivate cancelled tenant');
    });

    it('should allow suspending a cancelled tenant (edge case)', async () => {
      const res = await fetch(`${API_URL}/api/super-admin/tenants/${newTenantId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          reason: 'Additional suspension',
        }),
      });

      // Should fail - can't suspend cancelled tenant
      expect(res.status).toBe(400);
    });
  });

  describe('Authorization', () => {
    it('should not allow non-super-admin to suspend tenant', async () => {
      // Create a regular admin user
      const signupRes = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `regular-admin-${Date.now()}@test.com`,
          password: 'Test123!@#',
          name: 'Regular Admin',
        }),
      });
      const signupData = await signupRes.json();
      const regularToken = signupData.token;

      const res = await fetch(`${API_URL}/api/super-admin/tenants/${tenantId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${regularToken}`,
        },
        body: JSON.stringify({
          reason: 'Unauthorized attempt',
        }),
      });

      expect(res.status).toBe(403);
    });
  });
});
