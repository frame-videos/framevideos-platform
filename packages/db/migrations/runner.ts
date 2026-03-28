// Migration runner — reads SQL files, tracks applied migrations in _migrations table
// Usage: called from scripts/migrate.sh via D1 HTTP API
//
// This module provides the logic for:
// 1. Creating the _migrations table if it doesn't exist
// 2. Reading all .sql files from the migrations directory
// 3. Checking which migrations are pending
// 4. Applying pending migrations in order
// 5. Recording each applied migration in the _migrations table
//
// Designed to work with Cloudflare D1 via REST API.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Migration {
  version: string;
  name: string;
  sql: string;
  appliedAt?: string;
}

interface D1Response {
  success: boolean;
  result?: Array<{ results?: Array<Record<string, unknown>> }>;
  errors?: Array<{ message: string }>;
}

interface RunnerConfig {
  accountId: string;
  apiToken: string;
  databaseId: string;
  migrationsDir?: string;
}

// ─── D1 API Client ──────────────────────────────────────────────────────────

async function executeD1(
  config: RunnerConfig,
  sql: string,
  params: unknown[] = [],
): Promise<D1Response> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<D1Response>;
}

// ─── Migration Runner ───────────────────────────────────────────────────────

/**
 * Ensure the _migrations tracking table exists.
 */
async function ensureMigrationsTable(config: RunnerConfig): Promise<void> {
  await executeD1(
    config,
    `CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  );
}

/**
 * Get list of already-applied migration names.
 */
async function getAppliedMigrations(config: RunnerConfig): Promise<Set<string>> {
  const result = await executeD1(config, 'SELECT name FROM _migrations ORDER BY id');
  const names = new Set<string>();

  if (result.result?.[0]?.results) {
    for (const row of result.result[0].results) {
      if (typeof row['name'] === 'string') {
        names.add(row['name']);
      }
    }
  }

  return names;
}

/**
 * Read all .sql migration files from the migrations directory.
 * Files must be named: NNN_description.sql (e.g., 001_initial_schema.sql)
 */
async function readMigrationFiles(dir: string): Promise<Migration[]> {
  const files = await readdir(dir);
  const sqlFiles = files
    .filter((f) => f.endsWith('.sql'))
    .sort(); // Lexicographic sort ensures correct order with NNN_ prefix

  const migrations: Migration[] = [];

  for (const file of sqlFiles) {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      console.warn(`Skipping file with unexpected name format: ${file}`);
      continue;
    }

    const version = match[1]!;
    const name = file.replace('.sql', '');
    const sql = await readFile(join(dir, file), 'utf-8');

    migrations.push({ version, name, sql });
  }

  return migrations;
}

/**
 * Apply a single migration.
 * The SQL file may contain its own INSERT INTO _migrations,
 * so we skip auto-recording if the migration name already appears in the SQL.
 */
async function applyMigration(config: RunnerConfig, migration: Migration): Promise<void> {
  // Execute the migration SQL
  // D1 API supports multi-statement SQL in a single call
  const result = await executeD1(config, migration.sql);

  if (!result.success) {
    const errorMsg = result.errors?.map((e) => e.message).join('; ') ?? 'Unknown error';
    throw new Error(`Migration ${migration.name} failed: ${errorMsg}`);
  }

  // Check if the migration already self-registered
  const selfRegisters = migration.sql.includes(`'${migration.name}'`);
  if (!selfRegisters) {
    await executeD1(
      config,
      'INSERT OR IGNORE INTO _migrations (name) VALUES (?)',
      [migration.name],
    );
  }
}

/**
 * Run all pending migrations.
 */
export async function runMigrations(config: RunnerConfig): Promise<{
  applied: string[];
  skipped: string[];
  total: number;
}> {
  const migrationsDir = config.migrationsDir ?? join(import.meta.dirname ?? '.', '.');

  console.log(`📂 Reading migrations from: ${migrationsDir}`);

  // Ensure tracking table exists
  await ensureMigrationsTable(config);

  // Get state
  const applied = await getAppliedMigrations(config);
  const allMigrations = await readMigrationFiles(migrationsDir);

  console.log(`📋 Found ${allMigrations.length} migration(s), ${applied.size} already applied`);

  const newlyApplied: string[] = [];
  const skipped: string[] = [];

  for (const migration of allMigrations) {
    if (applied.has(migration.name)) {
      skipped.push(migration.name);
      console.log(`  ⏭️  ${migration.name} (already applied)`);
      continue;
    }

    console.log(`  🔄 Applying: ${migration.name}...`);
    try {
      await applyMigration(config, migration);
      newlyApplied.push(migration.name);
      console.log(`  ✅ ${migration.name}`);
    } catch (err) {
      console.error(`  ❌ ${migration.name}: ${err instanceof Error ? err.message : err}`);
      throw err; // Stop on first failure
    }
  }

  console.log(`\n✅ Done. Applied: ${newlyApplied.length}, Skipped: ${skipped.length}`);

  return {
    applied: newlyApplied,
    skipped,
    total: allMigrations.length,
  };
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const accountId = process.env['CF_ACCOUNT_ID'];
  const apiToken = process.env['CF_API_TOKEN'];
  const databaseId = process.env['D1_DATABASE_ID'];

  if (!accountId || !apiToken || !databaseId) {
    console.error('❌ Missing required env vars: CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID');
    process.exit(1);
  }

  const migrationsDir = process.env['MIGRATIONS_DIR'] ?? import.meta.dirname ?? '.';

  try {
    const result = await runMigrations({
      accountId,
      apiToken,
      databaseId,
      migrationsDir,
    });

    if (result.applied.length === 0) {
      console.log('\n🎉 Database is up to date!');
    }
  } catch (err) {
    console.error('\n💥 Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Run if executed directly
main();
