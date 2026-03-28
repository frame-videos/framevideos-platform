// Test helpers — mock D1, KV, R2 for unit testing Hono routes

/**
 * Creates a minimal mock D1Database for testing.
 * Override query results per test via the `results` map.
 */
export function createMockD1(resultsMap: Record<string, unknown[]> = {}): D1Database {
  const prepare = (sql: string) => {
    const stmt = {
      _sql: sql,
      _params: [] as unknown[],
      bind(...params: unknown[]) {
        stmt._params = params;
        return stmt;
      },
      async first<T>(): Promise<T | null> {
        const key = sql.trim().slice(0, 60);
        for (const [pattern, rows] of Object.entries(resultsMap)) {
          if (key.includes(pattern) && rows.length > 0) {
            return rows[0] as T;
          }
        }
        return null;
      },
      async all<T>(): Promise<D1Result<T>> {
        const key = sql.trim().slice(0, 60);
        for (const [pattern, rows] of Object.entries(resultsMap)) {
          if (key.includes(pattern)) {
            return { results: rows as T[], success: true, meta: {} as D1Meta };
          }
        }
        return { results: [] as T[], success: true, meta: {} as D1Meta };
      },
      async run(): Promise<D1Result<unknown>> {
        return { results: [], success: true, meta: {} as D1Meta };
      },
    };
    return stmt;
  };

  return {
    prepare,
    dump: async () => new ArrayBuffer(0),
    exec: async () => ({ count: 0, duration: 0 }),
    batch: async () => [],
  } as unknown as D1Database;
}

/**
 * Creates a minimal mock KVNamespace.
 */
export function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

/**
 * Creates a minimal mock R2Bucket.
 */
export function createMockR2(): R2Bucket {
  const store = new Map<string, ArrayBuffer>();
  return {
    put: async (key: string, value: ArrayBuffer | ReadableStream | string) => {
      if (typeof value === 'string') {
        store.set(key, new TextEncoder().encode(value).buffer);
      } else if (value instanceof ArrayBuffer) {
        store.set(key, value);
      }
      return {} as R2Object;
    },
    get: async (key: string) => {
      const data = store.get(key);
      if (!data) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(data));
            controller.close();
          },
        }),
        text: async () => new TextDecoder().decode(data),
        arrayBuffer: async () => data,
        size: data.byteLength,
        httpMetadata: {},
      } as unknown as R2ObjectBody;
    },
    head: async (key: string) => {
      const data = store.get(key);
      if (!data) return null;
      return { size: data.byteLength, httpMetadata: {} } as unknown as R2Object;
    },
    delete: async (key: string) => { store.delete(key); },
    list: async () => ({ objects: [], truncated: false }),
  } as unknown as R2Bucket;
}
