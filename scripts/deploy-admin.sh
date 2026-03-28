#!/bin/bash
# Deploy admin SPA assets to R2
# Builds tenant-admin, generates manifest.json, uploads to R2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ADMIN_DIR="$ROOT_DIR/apps/tenant-admin"
DIST_DIR="$ADMIN_DIR/dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[deploy-admin]${NC} $1"; }
warn() { echo -e "${YELLOW}[deploy-admin]${NC} $1"; }
error() { echo -e "${RED}[deploy-admin]${NC} $1" >&2; }

# Check required env vars
if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] || [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  # Try loading from .env.framevideos
  ENV_FILE="$ROOT_DIR/.env.framevideos"
  if [ -f "$ENV_FILE" ]; then
    log "Loading credentials from .env.framevideos..."
    export $(grep -E '^(CLOUDFLARE_ACCOUNT_ID|CLOUDFLARE_API_TOKEN|R2_BUCKET_NAME)=' "$ENV_FILE" | xargs)
  else
    error "Missing CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN"
    error "Set them as env vars or create .env.framevideos"
    exit 1
  fi
fi

R2_BUCKET="${R2_BUCKET_NAME:-framevideos-storage}"
CF_API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}"

# Step 1: Build
log "Building tenant-admin..."
cd "$ADMIN_DIR"
npx vite build

if [ ! -d "$DIST_DIR/assets" ]; then
  error "Build failed — no dist/assets directory"
  exit 1
fi

# Step 2: Generate manifest.json
log "Generating manifest.json..."
JS_FILE=$(ls "$DIST_DIR/assets/"*.js 2>/dev/null | head -1 | xargs basename)
CSS_FILE=$(ls "$DIST_DIR/assets/"*.css 2>/dev/null | head -1 | xargs basename)

if [ -z "$JS_FILE" ] || [ -z "$CSS_FILE" ]; then
  error "Could not find JS or CSS files in dist/assets/"
  exit 1
fi

MANIFEST="{\"js\":\"${JS_FILE}\",\"css\":\"${CSS_FILE}\",\"buildTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
echo "$MANIFEST" > "$DIST_DIR/assets/manifest.json"
log "Manifest: $MANIFEST"

# Step 3: Upload to R2
log "Uploading assets to R2 bucket: $R2_BUCKET..."

upload_to_r2() {
  local file_path="$1"
  local r2_key="$2"
  local content_type="$3"

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X PUT "${CF_API}/r2/buckets/${R2_BUCKET}/objects/${r2_key}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: ${content_type}" \
    --data-binary "@${file_path}")

  local http_code
  http_code=$(echo "$response" | tail -1)

  if [ "$http_code" = "200" ]; then
    log "  ✅ ${r2_key}"
  else
    error "  ❌ ${r2_key} (HTTP ${http_code})"
    echo "$response" | head -1
  fi
}

# Upload JS
upload_to_r2 "$DIST_DIR/assets/$JS_FILE" "admin-assets/$JS_FILE" "application/javascript"

# Upload CSS
upload_to_r2 "$DIST_DIR/assets/$CSS_FILE" "admin-assets/$CSS_FILE" "text/css"

# Upload manifest
upload_to_r2 "$DIST_DIR/assets/manifest.json" "admin-assets/manifest.json" "application/json"

# Upload any other assets (fonts, images, etc.)
for file in "$DIST_DIR/assets/"*; do
  fname=$(basename "$file")
  if [ "$fname" != "$JS_FILE" ] && [ "$fname" != "$CSS_FILE" ] && [ "$fname" != "manifest.json" ]; then
    # Detect content type
    case "$fname" in
      *.woff2) ct="font/woff2" ;;
      *.woff) ct="font/woff" ;;
      *.svg) ct="image/svg+xml" ;;
      *.png) ct="image/png" ;;
      *.jpg|*.jpeg) ct="image/jpeg" ;;
      *.webp) ct="image/webp" ;;
      *) ct="application/octet-stream" ;;
    esac
    upload_to_r2 "$file" "admin-assets/$fname" "$ct"
  fi
done

log "Done! Admin SPA deployed to R2."
log "Assets will be served from /admin/assets/ via tenant-site worker."
