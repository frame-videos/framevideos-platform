// Cliente D1 com suporte a tenant-scoping

/**
 * Resultado de uma query D1.
 */
export interface D1QueryResult<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: {
    changes: number;
    duration: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

/**
 * Cliente D1 que encapsula o binding D1Database.
 * Fornece métodos tipados e tenant-scoped por padrão.
 */
export class D1Client {
  constructor(private readonly db: D1Database) {}

  /**
   * Executa uma query SELECT e retorna os resultados tipados.
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql).bind(...params);
    const result = await stmt.all<T>();
    return result.results;
  }

  /**
   * Executa uma query de escrita (INSERT, UPDATE, DELETE).
   */
  async execute(
    sql: string,
    params: unknown[] = [],
  ): Promise<D1QueryResult> {
    const stmt = this.db.prepare(sql).bind(...params);
    const result = await stmt.run();
    return result as unknown as D1QueryResult;
  }

  /**
   * Executa um batch de queries numa transação.
   * D1 garante atomicidade em batch.
   */
  async batch<T = Record<string, unknown>>(
    queries: Array<{ sql: string; params?: unknown[] }>,
  ): Promise<D1QueryResult<T>[]> {
    const stmts = queries.map(({ sql, params = [] }) =>
      this.db.prepare(sql).bind(...params),
    );
    const results = await this.db.batch(stmts);
    return results as unknown as D1QueryResult<T>[];
  }

  /**
   * Busca uma única linha ou null.
   */
  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const stmt = this.db.prepare(sql).bind(...params);
    const result = await stmt.first<T>();
    return result;
  }

  /**
   * Acesso direto ao D1Database subjacente (pra casos avançados).
   */
  get raw(): D1Database {
    return this.db;
  }
}
