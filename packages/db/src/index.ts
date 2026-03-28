// @frame-videos/db — cliente D1 e middleware de tenant-scoping

export { D1Client } from './client.js';
export type { D1QueryResult } from './client.js';
export { validateTenantScope, withTenantScope } from './middleware.js';
