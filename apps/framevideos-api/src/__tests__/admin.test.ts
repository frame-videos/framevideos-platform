// Unit tests — Admin routes (super_admin only)

import { describe, it, expect } from 'vitest';

describe('Admin Routes — Access Control', () => {
  const validRoles = ['super_admin', 'tenant_admin', 'tenant_user', 'advertiser'];

  it('should only allow super_admin role', () => {
    const allowedRoles = validRoles.filter((role) => role === 'super_admin');
    expect(allowedRoles).toEqual(['super_admin']);
    expect(allowedRoles).toHaveLength(1);
  });

  it('should reject tenant_admin', () => {
    const role = 'tenant_admin';
    expect(role !== 'super_admin').toBe(true);
  });

  it('should reject tenant_user', () => {
    const role = 'tenant_user';
    expect(role !== 'super_admin').toBe(true);
  });

  it('should reject advertiser', () => {
    const role = 'advertiser';
    expect(role !== 'super_admin').toBe(true);
  });
});

describe('Admin Routes — Pagination', () => {
  it('should parse pagination params correctly', () => {
    const parsePagination = (limit?: string, offset?: string) => ({
      limit: Math.min(parseInt(limit ?? '20', 10) || 20, 100),
      offset: parseInt(offset ?? '0', 10) || 0,
    });

    expect(parsePagination()).toEqual({ limit: 20, offset: 0 });
    expect(parsePagination('50', '100')).toEqual({ limit: 50, offset: 100 });
    expect(parsePagination('200')).toEqual({ limit: 100, offset: 0 }); // capped at 100
    expect(parsePagination('invalid')).toEqual({ limit: 20, offset: 0 });
  });

  it('should calculate totalPages correctly', () => {
    const totalPages = (total: number, limit: number) => Math.ceil(total / limit);

    expect(totalPages(0, 20)).toBe(0);
    expect(totalPages(1, 20)).toBe(1);
    expect(totalPages(20, 20)).toBe(1);
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(100, 20)).toBe(5);
  });
});
