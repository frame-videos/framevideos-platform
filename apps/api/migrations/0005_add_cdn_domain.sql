-- Add CDN domain field to tenants
-- Convention: cdn.{domain} but can be overridden per tenant
ALTER TABLE tenants ADD COLUMN cdn_domain TEXT;
