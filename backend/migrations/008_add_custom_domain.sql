-- Migration 008: Add Custom Domain Support for Cloudflare for SaaS
-- Adds custom_domain fields to tenants table

-- Add custom domain fields to tenants table
ALTER TABLE tenants ADD COLUMN custom_domain TEXT;
ALTER TABLE tenants ADD COLUMN custom_domain_status TEXT DEFAULT 'none' CHECK(custom_domain_status IN ('none', 'pending', 'active', 'failed'));
ALTER TABLE tenants ADD COLUMN custom_domain_cloudflare_id TEXT;
ALTER TABLE tenants ADD COLUMN custom_domain_ssl_status TEXT;
ALTER TABLE tenants ADD COLUMN custom_domain_verified_at TEXT;
ALTER TABLE tenants ADD COLUMN custom_domain_created_at TEXT;

-- Create index for custom domain lookups
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON tenants(custom_domain);

-- Add comment for documentation
-- custom_domain: The custom domain configured by the tenant (e.g., videos.cliente.com)
-- custom_domain_status: Status of the custom domain (none, pending, active, failed)
-- custom_domain_cloudflare_id: Cloudflare custom hostname ID for API operations
-- custom_domain_ssl_status: SSL certificate status from Cloudflare
-- custom_domain_verified_at: Timestamp when domain was verified
-- custom_domain_created_at: Timestamp when custom domain was added
