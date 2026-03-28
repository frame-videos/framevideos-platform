-- Sprint 6: Add Cloudflare Custom Hostname ID to domains table
ALTER TABLE domains ADD COLUMN cf_hostname_id TEXT;
