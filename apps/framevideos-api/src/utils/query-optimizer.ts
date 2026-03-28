// Database query optimization helpers — Sprint 10
// Prepared statements, batch queries, dynamic query builder, pagination helpers

import { D1Client } from '@frame-videos/db';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface CursorPaginationParams {
  cursor: string | null;
  limit: number;
  direction: 'forward' | 'backward';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: OffsetPagination | CursorPagination;
}

export interface OffsetPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CursorPagination {
  cursor: string | null;
  hasMore: boolean;
  total: number;
  limit: number;
}

// ─── Filter builder ─────────────────────────────────────────────────────────

export interface FilterCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'IS NULL' | 'IS NOT NULL';
  value?: unknown;
  values?: unknown[];
}

/**
 * Dynamic query builder for WHERE clauses.
 * Builds parameterized SQL to prevent injection.
 */
export class QueryBuilder {
  private conditions: string[] = [];
  private params: unknown[] = [];

  /**
   * Add a simple equality filter.
   */
  where(column: string, value: unknown): this {
    this.conditions.push(`${column} = ?`);
    this.params.push(value);
    return this;
  }

  /**
   * Add a conditional filter (only applied if value is defined and not null).
   */
  whereIf(column: string, value: unknown | undefined | null): this {
    if (value !== undefined && value !== null && value !== '') {
      this.conditions.push(`${column} = ?`);
      this.params.push(value);
    }
    return this;
  }

  /**
   * Add a LIKE filter (only if value is truthy).
   */
  whereLike(column: string, value: string | undefined | null): this {
    if (value) {
      this.conditions.push(`${column} LIKE ?`);
      this.params.push(`%${value}%`);
    }
    return this;
  }

  /**
   * Add a raw SQL condition with parameters.
   */
  whereRaw(sql: string, params: unknown[] = []): this {
    this.conditions.push(sql);
    this.params.push(...params);
    return this;
  }

  /**
   * Add an EXISTS subquery filter (only if value is truthy).
   */
  whereExists(subquery: string, value: unknown | undefined | null, extraParams: unknown[] = []): this {
    if (value !== undefined && value !== null && value !== '') {
      this.conditions.push(`EXISTS (${subquery})`);
      this.params.push(value, ...extraParams);
    }
    return this;
  }

  /**
   * Add date range filter.
   */
  whereDateRange(column: string, from?: string, to?: string): this {
    if (from) {
      this.conditions.push(`${column} >= ?`);
      this.params.push(from);
    }
    if (to) {
      this.conditions.push(`${column} <= ?`);
      this.params.push(to);
    }
    return this;
  }

  /**
   * Add cursor-based pagination filter.
   */
  whereCursor(column: string, cursor: string | null, direction: 'asc' | 'desc' = 'desc'): this {
    if (cursor) {
      const op = direction === 'asc' ? '>' : '<';
      this.conditions.push(`${column} ${op} ?`);
      this.params.push(cursor);
    }
    return this;
  }

  /**
   * Build the WHERE clause string and params array.
   */
  build(): { where: string; params: unknown[] } {
    if (this.conditions.length === 0) {
      return { where: '1=1', params: [] };
    }
    return {
      where: this.conditions.join(' AND '),
      params: [...this.params],
    };
  }

  /**
   * Get the number of conditions added.
   */
  get count(): number {
    return this.conditions.length;
  }
}

// ─── Pagination helpers ─────────────────────────────────────────────────────

/**
 * Parse offset-based pagination params from query string.
 */
export function parseOffsetPagination(
  query: { page?: string; limit?: string },
  defaultLimit = 24,
  maxLimit = 100,
): PaginationParams {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit ?? String(defaultLimit), 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Decode a cursor (base64 of last ULID).
 */
export function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  try {
    return atob(cursor);
  } catch {
    return null;
  }
}

/**
 * Encode a cursor from a ULID.
 */
export function encodeCursor(id: string): string {
  return btoa(id);
}

/**
 * Build offset pagination response metadata.
 */
export function buildOffsetPagination(page: number, limit: number, total: number): OffsetPagination {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Build cursor pagination response metadata.
 */
export function buildCursorPagination<T extends { id: string }>(
  items: T[],
  limit: number,
  total: number,
): CursorPagination {
  const lastItem = items[items.length - 1];
  return {
    cursor: lastItem ? encodeCursor(lastItem.id) : null,
    hasMore: items.length === limit,
    total,
    limit,
  };
}

// ─── Count query helper ─────────────────────────────────────────────────────

/**
 * Execute an optimized count query.
 */
export async function countQuery(
  db: D1Client,
  table: string,
  where: string,
  params: unknown[],
  joins = '',
): Promise<number> {
  const result = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM ${table} ${joins} WHERE ${where}`,
    params,
  );
  return result?.total ?? 0;
}

// ─── Batch query helper ─────────────────────────────────────────────────────

/**
 * Execute multiple queries in a D1 batch for atomicity and performance.
 */
export async function batchQueries(
  db: D1Client,
  queries: Array<{ sql: string; params?: unknown[] }>,
): Promise<void> {
  if (queries.length === 0) return;
  await db.batch(queries);
}

// ─── Sort builder ────────────────────────────────────────────────────────────

export interface SortOption {
  key: string;
  sql: string;
}

/**
 * Resolve sort parameter to SQL ORDER BY clause.
 */
export function resolveSort(
  sortParam: string | undefined,
  options: SortOption[],
  defaultSort: string,
): string {
  if (!sortParam) return defaultSort;
  const found = options.find((o) => o.key === sortParam);
  return found?.sql ?? defaultSort;
}
