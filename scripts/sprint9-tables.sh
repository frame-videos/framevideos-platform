#!/bin/bash
# Sprint 9 — Create D1 tables for analytics, email, monitoring

ACCOUNT="54150e744dccd84f0ae67d6dcd485bf3"
DB_ID="dae9bd51-c863-42b0-b5b6-21f4569aa6c9"
TOKEN="cfut_32g1GBYSYuHKlzjVSBLGdpBrrtd5VymRjvrbMO2Ad63961ce"
API="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query"

run_sql() {
  local desc="$1"
  local sql="$2"
  echo ">>> $desc"
  result=$(curl -s -X POST "$API" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "{\"sql\": \"$sql\"}")
  success=$(echo "$result" | jq -r '.success')
  if [ "$success" = "true" ]; then
    echo "    ✅ OK"
  else
    error=$(echo "$result" | jq -r '.errors[0].message // "unknown error"')
    echo "    ❌ FAIL: $error"
  fi
}

# 1. page_views
run_sql "page_views table" \
  "CREATE TABLE IF NOT EXISTS page_views (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, path TEXT NOT NULL, referrer TEXT, user_agent TEXT, country TEXT, device_type TEXT, created_at TEXT NOT NULL)"

run_sql "page_views index (tenant, created_at)" \
  "CREATE INDEX IF NOT EXISTS idx_page_views_tenant_created ON page_views(tenant_id, created_at)"

run_sql "page_views index (tenant, path)" \
  "CREATE INDEX IF NOT EXISTS idx_page_views_tenant_path ON page_views(tenant_id, path)"

# 2. daily_stats
run_sql "daily_stats table" \
  "CREATE TABLE IF NOT EXISTS daily_stats (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, date TEXT NOT NULL, pageviews INTEGER NOT NULL DEFAULT 0, unique_visitors INTEGER NOT NULL DEFAULT 0, top_pages_json TEXT, top_referrers_json TEXT, devices_json TEXT, countries_json TEXT)"

run_sql "daily_stats index (tenant, date)" \
  "CREATE INDEX IF NOT EXISTS idx_daily_stats_tenant_date ON daily_stats(tenant_id, date)"

# 3. email_templates
run_sql "email_templates table" \
  "CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, template_type TEXT NOT NULL, subject TEXT NOT NULL, body_html TEXT NOT NULL, body_text TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"

run_sql "email_templates index (tenant, type)" \
  "CREATE INDEX IF NOT EXISTS idx_email_templates_tenant_type ON email_templates(tenant_id, template_type)"

# 4. email_log
run_sql "email_log table" \
  "CREATE TABLE IF NOT EXISTS email_log (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, template_type TEXT NOT NULL, to_email TEXT NOT NULL, subject TEXT NOT NULL, status TEXT NOT NULL, sendgrid_id TEXT, error TEXT, created_at TEXT NOT NULL)"

run_sql "email_log index (tenant, created_at)" \
  "CREATE INDEX IF NOT EXISTS idx_email_log_tenant_created ON email_log(tenant_id, created_at)"

# 5. newsletter_subscribers
run_sql "newsletter_subscribers table" \
  "CREATE TABLE IF NOT EXISTS newsletter_subscribers (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', confirm_token TEXT, subscribed_at TEXT, unsubscribed_at TEXT, created_at TEXT NOT NULL)"

run_sql "newsletter_subscribers index (tenant, email)" \
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subs_tenant_email ON newsletter_subscribers(tenant_id, email)"

run_sql "newsletter_subscribers index (confirm_token)" \
  "CREATE INDEX IF NOT EXISTS idx_newsletter_subs_token ON newsletter_subscribers(confirm_token)"

# 6. health_checks
run_sql "health_checks table" \
  "CREATE TABLE IF NOT EXISTS health_checks (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, domain TEXT NOT NULL, status_code INTEGER, response_time_ms INTEGER, is_healthy INTEGER NOT NULL DEFAULT 1, checked_at TEXT NOT NULL)"

run_sql "health_checks index (tenant, checked_at)" \
  "CREATE INDEX IF NOT EXISTS idx_health_checks_tenant_checked ON health_checks(tenant_id, checked_at)"

run_sql "health_checks index (tenant, domain)" \
  "CREATE INDEX IF NOT EXISTS idx_health_checks_tenant_domain ON health_checks(tenant_id, domain)"

# 7. incidents
run_sql "incidents table" \
  "CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, domain TEXT NOT NULL, started_at TEXT NOT NULL, resolved_at TEXT, duration_seconds INTEGER, status TEXT NOT NULL DEFAULT 'open', alert_sent INTEGER NOT NULL DEFAULT 0)"

run_sql "incidents index (tenant, status)" \
  "CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status ON incidents(tenant_id, status)"

echo ""
echo "=== Sprint 9 tables creation complete ==="
