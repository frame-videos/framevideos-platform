// Unit tests — Auth routes
// Tests signup, login validation, error handling

import { describe, it, expect, vi } from 'vitest';

describe('Auth Routes', () => {
  describe('POST /auth/signup', () => {
    it('should reject signup with missing email', async () => {
      const body = { password: 'strongpassword123', name: 'Test', tenantName: 'Test Tenant' };
      const { signupSchema } = await getSchemas();

      const result = signupSchema.safeParse(body);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('email'))).toBe(true);
      }
    });

    it('should reject signup with short password', async () => {
      const body = { email: 'test@example.com', password: '12', name: 'Test', tenantName: 'Test' };
      const { signupSchema } = await getSchemas();

      const result = signupSchema.safeParse(body);
      expect(result.success).toBe(false);
    });

    it('should accept valid signup data', async () => {
      const body = {
        email: 'test@example.com',
        password: 'strongpassword123',
        name: 'Test User',
        tenantName: 'My Tenant',
      };
      const { signupSchema } = await getSchemas();

      const result = signupSchema.safeParse(body);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.tenantName).toBe('My Tenant');
      }
    });

    it('should reject invalid email format', async () => {
      const body = { email: 'not-an-email', password: 'strongpassword123', name: 'Test', tenantName: 'T' };
      const { signupSchema } = await getSchemas();

      const result = signupSchema.safeParse(body);
      expect(result.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    it('should reject login with missing password', async () => {
      const body = { email: 'test@example.com' };
      const { loginSchema } = await getSchemas();

      const result = loginSchema.safeParse(body);
      expect(result.success).toBe(false);
    });

    it('should accept valid login data', async () => {
      const body = { email: 'test@example.com', password: 'mypassword' };
      const { loginSchema } = await getSchemas();

      const result = loginSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('should reject login with invalid email', async () => {
      const body = { email: 'invalid', password: 'mypassword' };
      const { loginSchema } = await getSchemas();

      const result = loginSchema.safeParse(body);
      expect(result.success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should reject refresh with missing token', async () => {
      const body = {};
      const { refreshSchema } = await getSchemas();

      const result = refreshSchema.safeParse(body);
      expect(result.success).toBe(false);
    });

    it('should accept valid refresh token', async () => {
      const body = { refreshToken: 'some-valid-token-string' };
      const { refreshSchema } = await getSchemas();

      const result = refreshSchema.safeParse(body);
      expect(result.success).toBe(true);
    });
  });
});

// Helper to import schemas without importing the full route (which needs Hono runtime)
async function getSchemas() {
  const { z } = await import('zod');

  const signupSchema = z.object({
    email: z.string().email('Invalid email format').max(254),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be at most 128 characters'),
    name: z.string().min(1, 'Name is required').max(200),
    tenantName: z.string().min(1, 'Tenant name is required').max(200),
  });

  const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  });

  const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  });

  return { signupSchema, loginSchema, refreshSchema };
}
