#!/bin/bash
# ============================================================================
# Frame Videos — D1 Migration Runner
# ============================================================================
#
# Run pending D1 migrations via the Cloudflare API.
#
# Usage:
#   ./scripts/migrate.sh                    # Run from project root
#   ./scripts/migrate.sh --dry-run          # Show pending migrations without applying
#
# Required env vars (set in .env.framevideos or export manually):
#   CF_ACCOUNT_ID   — Cloudflare account ID
#   CF_API_TOKEN    — Cloudflare API token with D1 write access
#   D1_DATABASE_ID  — D1 database ID
#
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/packages/db/migrations"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Load env vars ───────────────────────────────────────────────────────────

if [ -f "$PROJECT_ROOT/.env.framevideos" ]; then
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env.framevideos"
fi

# Validate required env vars
if [ -z "${CF_ACCOUNT_ID:-}" ]; then
  echo -e "${RED}❌ CF_ACCOUNT_ID is not set${NC}"
  exit 1
fi

if [ -z "${CF_API_TOKEN:-}" ]; then
  echo -e "${RED}❌ CF_API_TOKEN is not set${NC}"
  exit 1
fi

if [ -z "${D1_DATABASE_ID:-}" ]; then
  echo -e "${RED}❌ D1_DATABASE_ID is not set${NC}"
  exit 1
fi

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

API_URL="https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query"

# ─── Helpers ──────────────────────────────────────────────────────────────────

run_sql() {
  local sql="$1"
  local result
  result=$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$(jq -n --arg sql "$sql" '{"sql": $sql}')")

  local success
  success=$(echo "$result" | jq -r '.success')

  if [ "$success" != "true" ]; then
    local error
    error=$(echo "$result" | jq -r '.errors[0].message // "unknown error"')
    echo -e "${RED}❌ SQL error: $error${NC}"
    return 1
  fi

  echo "$result"
}

# ─── Ensure _migrations table ────────────────────────────────────────────────

echo -e "${BLUE}📂 Migrations directory: $MIGRATIONS_DIR${NC}"
echo ""

run_sql "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')))" > /dev/null

# ─── Get applied migrations ──────────────────────────────────────────────────

APPLIED=$(run_sql "SELECT name FROM _migrations ORDER BY id" | jq -r '.result[0].results[]?.name // empty' 2>/dev/null || echo "")

# ─── Find and apply pending migrations ────────────────────────────────────────

PENDING=0
APPLIED_COUNT=0
SKIPPED=0

for sql_file in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$sql_file" ] || continue

  filename=$(basename "$sql_file")
  migration_name="${filename%.sql}"

  # Check if already applied
  if echo "$APPLIED" | grep -q "^${migration_name}$"; then
    echo -e "  ${YELLOW}⏭️  $migration_name${NC} (already applied)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  PENDING=$((PENDING + 1))

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${BLUE}📋 $migration_name${NC} (pending — dry run)"
    continue
  fi

  echo -ne "  ${BLUE}🔄 $migration_name${NC}..."

  SQL_CONTENT=$(cat "$sql_file")

  if run_sql "$SQL_CONTENT" > /dev/null 2>&1; then
    echo -e " ${GREEN}✅${NC}"
    APPLIED_COUNT=$((APPLIED_COUNT + 1))
  else
    echo -e " ${RED}❌ FAILED${NC}"
    echo -e "${RED}💥 Migration failed at: $migration_name${NC}"
    echo -e "${RED}   Stopping. Fix the issue and re-run.${NC}"
    exit 1
  fi
done

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
if [ "$DRY_RUN" = true ]; then
  echo -e "${BLUE}📋 Dry run complete. Pending: $PENDING, Already applied: $SKIPPED${NC}"
else
  if [ "$APPLIED_COUNT" -eq 0 ]; then
    echo -e "${GREEN}🎉 Database is up to date! (${SKIPPED} migrations already applied)${NC}"
  else
    echo -e "${GREEN}✅ Applied: $APPLIED_COUNT, Skipped: $SKIPPED${NC}"
  fi
fi
