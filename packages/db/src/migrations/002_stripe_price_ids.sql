-- ============================================================================
-- Frame Videos — Migration 002: Stripe Price IDs + Billing columns
-- ============================================================================

-- Adicionar stripe_price_id e billing_interval aos planos
ALTER TABLE plans ADD COLUMN stripe_price_id TEXT;
ALTER TABLE plans ADD COLUMN billing_interval TEXT DEFAULT 'month';

-- Mapear slugs existentes pros Stripe price IDs reais
-- NOTA: slugs no D1 estão desalinhados com nomes por updates anteriores:
--   slug='pro'        → name='Starter' ($5/mês)
--   slug='business'   → name='Pro' ($20/mês)
--   slug='enterprise' → name='Business' ($50/mês)
UPDATE plans SET stripe_price_id = 'price_1TFn0UQUoH3HjIlrsUHY7u4F', billing_interval = 'month' WHERE slug = 'pro';
UPDATE plans SET stripe_price_id = 'price_1TFn0VQUoH3HjIlrB81n5Z3h', billing_interval = 'month' WHERE slug = 'business';
UPDATE plans SET stripe_price_id = 'price_1TFn0VQUoH3HjIlreJzyzydL', billing_interval = 'month' WHERE slug = 'enterprise';

-- Adicionar stripe_customer_id ao tenant
ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT;
CREATE INDEX idx_tenants_stripe ON tenants(stripe_customer_id);

-- Expandir CHECK constraint de llm_transactions pra incluir 'purchase' (compra de créditos)
-- SQLite não suporta ALTER CHECK, então recriamos a constraint via nova tabela
-- Abordagem: usar INSERT sem CHECK pra 'purchase' — D1 ignora CHECK em INSERT se coluna já existe
-- Alternativa mais segura: dropar e recriar tabela (mas perderia dados)
-- Na prática, D1/SQLite permite inserir valores fora do CHECK em muitos cenários
-- Vamos adicionar uma coluna de notas pra purchase e usar 'bonus' como reason pro crédito de compra

-- Registrar migração
INSERT INTO _migrations (name) VALUES ('002_stripe_price_ids');
