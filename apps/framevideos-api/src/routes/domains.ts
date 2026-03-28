// Rotas de domínios — Sprint 4
// CRUD de domínios, DNS verification (CNAME + TXT), rate limiting

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../env.js';
import { D1Client } from '@frame-videos/db';
import { authMiddleware } from '@frame-videos/auth';
import {
  generateUlid,
} from '@frame-videos/shared/utils';
import {
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  RateLimitError,
} from '@frame-videos/shared/errors';
import { PLAN_LIMITS } from '@frame-videos/shared/constants';
import type { PlanSlug } from '@frame-videos/shared/types';

const domains = new Hono<AppContext>();

// ─── Constants ───────────────────────────────────────────────────────────────

const CNAME_TARGET = 'sites.framevideos.com';
const CLOUDFLARE_DOH_URL = 'https://cloudflare-dns.com/dns-query';
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const MAX_VERIFICATIONS_PER_HOUR = 10;

// ─── Schemas de validação ────────────────────────────────────────────────────

/**
 * Regex pra validar domínio:
 * - Não aceita IP (v4/v6)
 * - Não aceita protocolo (http://, https://)
 * - Não aceita path (/algo)
 * - Aceita domínio com subdomínio (sub.dominio.com)
 * - Mínimo 2 labels (dominio.tld)
 */
const DOMAIN_REGEX = /^(?!.*:\/\/)(?!.*\/)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

/** Regex pra detectar IPs v4 */
const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

const addDomainSchema = z.object({
  domain: z
    .string()
    .min(4, 'Domínio muito curto')
    .max(253, 'Domínio muito longo')
    .transform((d) => d.toLowerCase().trim())
    .refine((d) => !d.includes('://'), {
      message: 'Não inclua o protocolo (http:// ou https://)',
    })
    .refine((d) => !d.includes('/'), {
      message: 'Não inclua caminhos no domínio',
    })
    .refine((d) => !IPV4_REGEX.test(d), {
      message: 'Endereços IP não são aceitos, use um domínio',
    })
    .refine((d) => DOMAIN_REGEX.test(d), {
      message: 'Formato de domínio inválido',
    })
    .refine((d) => !d.endsWith('.framevideos.com') && d !== 'framevideos.com', {
      message: 'Não é possível adicionar domínios framevideos.com',
    }),
});

// ─── Auth middleware ─────────────────────────────────────────────────────────

domains.use('*', async (c, next) => {
  return authMiddleware(c.env.JWT_SECRET)(c, next);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Busca o plano atual do tenant e retorna os limites.
 */
async function getTenantPlanLimits(
  db: D1Client,
  tenantId: string,
): Promise<{ maxDomains: number; planSlug: PlanSlug }> {
  const result = await db.queryOne<{ slug: string }>(
    `SELECT p.slug
     FROM subscriptions s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.tenant_id = ? AND s.status IN ('active', 'trialing')
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [tenantId],
  );

  const planSlug = (result?.slug ?? 'free') as PlanSlug;
  const limits = PLAN_LIMITS[planSlug];

  return {
    maxDomains: limits?.max_domains ?? 1,
    planSlug,
  };
}

/**
 * Verifica rate limit de verificações DNS por tenant.
 * Máximo MAX_VERIFICATIONS_PER_HOUR verificações por hora.
 * Usa KV pra armazenar contador.
 */
async function checkVerificationRateLimit(
  kv: KVNamespace,
  tenantId: string,
): Promise<void> {
  const key = `dns-verify:${tenantId}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= MAX_VERIFICATIONS_PER_HOUR) {
    throw new RateLimitError(3600);
  }

  // Incrementar com TTL de 1 hora
  await kv.put(key, String(count + 1), { expirationTtl: 3600 });
}

/**
 * Verifica CNAME via Cloudflare DNS-over-HTTPS.
 * Retorna true se o CNAME aponta pra sites.framevideos.com.
 */
async function verifyCname(domain: string): Promise<{
  found: boolean;
  target: string | null;
}> {
  try {
    const url = `${CLOUDFLARE_DOH_URL}?name=${encodeURIComponent(domain)}&type=CNAME`;
    const response = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
    });

    if (!response.ok) {
      console.error(`[dns-verify] DoH request failed: ${response.status}`);
      return { found: false, target: null };
    }

    const data = (await response.json()) as {
      Status: number;
      Answer?: Array<{ type: number; data: string }>;
    };

    // CNAME type = 5
    const cnameRecords = data.Answer?.filter((r) => r.type === 5) ?? [];

    for (const record of cnameRecords) {
      // DoH retorna com trailing dot, normalizar
      const target = record.data.replace(/\.$/, '').toLowerCase();
      if (target === CNAME_TARGET || target.endsWith('.framevideos.com')) {
        return { found: true, target };
      }
    }

    return { found: false, target: cnameRecords[0]?.data?.replace(/\.$/, '') ?? null };
  } catch (err) {
    console.error(`[dns-verify] CNAME check error for ${domain}:`, err);
    return { found: false, target: null };
  }
}

/**
 * Verifica TXT record via Cloudflare DNS-over-HTTPS.
 * Busca _frame-verify.{domain} com valor fv-verify-{tenantId}.
 */
async function verifyTxtRecord(
  domain: string,
  tenantId: string,
): Promise<{ found: boolean }> {
  try {
    const txtDomain = `_frame-verify.${domain}`;
    const expectedValue = `fv-verify-${tenantId}`;

    const url = `${CLOUDFLARE_DOH_URL}?name=${encodeURIComponent(txtDomain)}&type=TXT`;
    const response = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
    });

    if (!response.ok) {
      console.error(`[dns-verify] DoH TXT request failed: ${response.status}`);
      return { found: false };
    }

    const data = (await response.json()) as {
      Status: number;
      Answer?: Array<{ type: number; data: string }>;
    };

    // TXT type = 16
    const txtRecords = data.Answer?.filter((r) => r.type === 16) ?? [];

    for (const record of txtRecords) {
      // TXT records vêm com aspas no DoH, remover
      const value = record.data.replace(/^"|"$/g, '').trim();
      if (value === expectedValue) {
        return { found: true };
      }
    }

    return { found: false };
  } catch (err) {
    console.error(`[dns-verify] TXT check error for ${domain}:`, err);
    return { found: false };
  }
}

/**
 * Busca o slug do tenant pra montar o subdomínio automático.
 */
async function getTenantSlug(db: D1Client, tenantId: string): Promise<string | null> {
  const result = await db.queryOne<{ slug: string }>(
    `SELECT slug FROM tenants WHERE id = ?`,
    [tenantId],
  );
  return result?.slug ?? null;
}

// ─── Cloudflare Custom Hostnames API ─────────────────────────────────────────

interface CfCustomHostnameResult {
  success: boolean;
  errors: Array<{ message: string }>;
  result?: {
    id: string;
    hostname: string;
    status: string;
    ssl: {
      status: string;
      method: string;
      type: string;
    };
    verification_errors?: string[];
    ownership_verification?: {
      type: string;
      name: string;
      value: string;
    };
  };
}

/**
 * Create a Custom Hostname in Cloudflare for SaaS.
 * Enables automatic SSL and routing for custom domains.
 */
async function createCustomHostname(
  domain: string,
  env: { CF_ZONE_ID: string; CF_AUTH_EMAIL: string; CF_AUTH_KEY: string },
): Promise<{ id: string; status: string } | null> {
  if (!env.CF_ZONE_ID || !env.CF_AUTH_EMAIL || !env.CF_AUTH_KEY) {
    console.warn('[domains] CF API credentials not configured, skipping custom hostname creation');
    return null;
  }

  try {
    const response = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${env.CF_ZONE_ID}/custom_hostnames`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Email': env.CF_AUTH_EMAIL,
          'X-Auth-Key': env.CF_AUTH_KEY,
        },
        body: JSON.stringify({
          hostname: domain,
          ssl: {
            method: 'http',
            type: 'dv',
            settings: {
              min_tls_version: '1.2',
              http2: 'on',
            },
          },
        }),
      },
    );

    const data = (await response.json()) as CfCustomHostnameResult;

    if (!data.success) {
      console.error('[domains] CF custom hostname creation failed:', data.errors);
      return null;
    }

    return {
      id: data.result!.id,
      status: data.result!.status,
    };
  } catch (err) {
    console.error('[domains] CF custom hostname creation error:', err);
    return null;
  }
}

/**
 * Delete a Custom Hostname from Cloudflare.
 */
async function deleteCustomHostname(
  customHostnameId: string,
  env: { CF_ZONE_ID: string; CF_AUTH_EMAIL: string; CF_AUTH_KEY: string },
): Promise<boolean> {
  if (!env.CF_ZONE_ID || !env.CF_AUTH_EMAIL || !env.CF_AUTH_KEY) {
    console.warn('[domains] CF API credentials not configured, skipping custom hostname deletion');
    return false;
  }

  try {
    const response = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${env.CF_ZONE_ID}/custom_hostnames/${customHostnameId}`,
      {
        method: 'DELETE',
        headers: {
          'X-Auth-Email': env.CF_AUTH_EMAIL,
          'X-Auth-Key': env.CF_AUTH_KEY,
        },
      },
    );

    const data = (await response.json()) as { success: boolean; errors: Array<{ message: string }> };

    if (!data.success) {
      console.error('[domains] CF custom hostname deletion failed:', data.errors);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[domains] CF custom hostname deletion error:', err);
    return false;
  }
}

/**
 * Get Custom Hostname status from Cloudflare.
 * Returns the hostname details including SSL status and verification info.
 */
async function getCustomHostnameStatus(
  customHostnameId: string,
  env: { CF_ZONE_ID: string; CF_AUTH_EMAIL: string; CF_AUTH_KEY: string },
): Promise<CfCustomHostnameResult['result'] | null> {
  if (!env.CF_ZONE_ID || !env.CF_AUTH_EMAIL || !env.CF_AUTH_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${env.CF_ZONE_ID}/custom_hostnames/${customHostnameId}`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Email': env.CF_AUTH_EMAIL,
          'X-Auth-Key': env.CF_AUTH_KEY,
        },
      },
    );

    const data = (await response.json()) as CfCustomHostnameResult;

    if (!data.success || !data.result) {
      return null;
    }

    return data.result;
  } catch (err) {
    console.error('[domains] CF custom hostname status error:', err);
    return null;
  }
}

/**
 * Find Custom Hostname by domain name in Cloudflare.
 */
async function findCustomHostnameByDomain(
  domain: string,
  env: { CF_ZONE_ID: string; CF_AUTH_EMAIL: string; CF_AUTH_KEY: string },
): Promise<string | null> {
  if (!env.CF_ZONE_ID || !env.CF_AUTH_EMAIL || !env.CF_AUTH_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `${CLOUDFLARE_API_URL}/zones/${env.CF_ZONE_ID}/custom_hostnames?hostname=${encodeURIComponent(domain)}`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Email': env.CF_AUTH_EMAIL,
          'X-Auth-Key': env.CF_AUTH_KEY,
        },
      },
    );

    const data = (await response.json()) as { success: boolean; result: Array<{ id: string; hostname: string }> };

    if (!data.success || !data.result?.length) {
      return null;
    }

    return data.result[0]!.id;
  } catch (err) {
    console.error('[domains] CF find custom hostname error:', err);
    return null;
  }
}

// ─── POST /api/v1/domains — Adicionar domínio ───────────────────────────────

domains.post('/', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const body = await c.req.json();
  const parsed = addDomainSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError('Dados inválidos', fieldErrors);
  }

  const { domain } = parsed.data;
  const db = new D1Client(c.env.DB);

  // 1. Verificar se domínio já existe (qualquer tenant)
  const existingDomain = await db.queryOne<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM domains WHERE domain = ? AND status != 'removed'`,
    [domain],
  );

  if (existingDomain) {
    throw new ConflictError(
      existingDomain.tenant_id === tenantId
        ? 'Este domínio já está cadastrado na sua conta'
        : 'Este domínio já está em uso por outra conta',
    );
  }

  // 2. Verificar limite do plano
  const { maxDomains, planSlug } = await getTenantPlanLimits(db, tenantId);

  const domainCount = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM domains WHERE tenant_id = ? AND status != 'removed'`,
    [tenantId],
  );

  const currentCount = domainCount?.count ?? 0;

  if (maxDomains !== -1 && currentCount >= maxDomains) {
    throw new ForbiddenError(
      `Limite de domínios atingido (${maxDomains} no plano ${planSlug}). Faça upgrade para adicionar mais domínios.`,
    );
  }

  // 3. Create Cloudflare Custom Hostname
  const cfResult = await createCustomHostname(domain, c.env);
  const cfHostnameId = cfResult?.id ?? null;

  // 4. Criar domínio
  const domainId = generateUlid();
  const isPrimary = currentCount === 0 ? 1 : 0; // Primeiro domínio é primário automaticamente

  await db.execute(
    `INSERT INTO domains (id, tenant_id, domain, status, is_primary, ssl_status, cf_hostname_id, created_at, updated_at)
     VALUES (?, ?, ?, 'pending_verification', ?, 'pending', ?, datetime('now'), datetime('now'))`,
    [domainId, tenantId, domain, isPrimary, cfHostnameId],
  );

  // 5. Audit log
  await db.execute(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address)
     VALUES (?, ?, ?, 'domain_add', 'domain', ?, ?)`,
    [
      generateUlid(),
      tenantId,
      c.get('userId'),
      domainId,
      c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
    ],
  );

  // 5. Retornar com instruções
  const txtVerifyRecord = `fv-verify-${tenantId}`;

  return c.json(
    {
      id: domainId,
      domain,
      status: 'pending_verification',
      isPrimary: isPrimary === 1,
      sslStatus: 'pending',
      cnameTarget: CNAME_TARGET,
      txtRecord: {
        host: `_frame-verify.${domain}`,
        value: txtVerifyRecord,
      },
      instructions: {
        step1: `Acesse o painel DNS do seu provedor de domínio`,
        step2: `Adicione um registro CNAME apontando para ${CNAME_TARGET}`,
        step3: `(Opcional) Adicione um registro TXT em _frame-verify.${domain} com valor ${txtVerifyRecord}`,
        step4: `Volte aqui e clique em "Verificar DNS"`,
        sslNote:
          'Importante: Para SSL automático no seu domínio, recomendamos usar o Cloudflare (plano gratuito) como DNS do seu domínio. Sem isso, o certificado SSL precisará ser configurado manualmente.',
      },
    },
    201,
  );
});

// ─── GET /api/v1/domains — Listar domínios do tenant ────────────────────────

domains.get('/', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const db = new D1Client(c.env.DB);

  const domainsList = await db.query<{
    id: string;
    domain: string;
    status: string;
    is_primary: number;
    ssl_status: string | null;
    cf_hostname_id: string | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, domain, status, is_primary, ssl_status, cf_hostname_id, verified_at, created_at, updated_at
     FROM domains
     WHERE tenant_id = ? AND status != 'removed'
     ORDER BY is_primary DESC, created_at ASC`,
    [tenantId],
  );

  // Buscar slug do tenant pra subdomínio automático
  const tenantSlug = await getTenantSlug(db, tenantId);

  // Buscar limites do plano
  const { maxDomains, planSlug } = await getTenantPlanLimits(db, tenantId);

  return c.json({
    domains: domainsList.map((d) => ({
      id: d.id,
      domain: d.domain,
      status: d.status,
      isPrimary: d.is_primary === 1,
      sslStatus: d.ssl_status,
      cfHostnameId: d.cf_hostname_id,
      verifiedAt: d.verified_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })),
    subdomain: tenantSlug ? `${tenantSlug}.framevideos.com` : null,
    limits: {
      current: domainsList.length,
      max: maxDomains,
      plan: planSlug,
    },
  });
});

// ─── POST /api/v1/domains/:id/verify — Verificar DNS ────────────────────────

domains.post('/:id/verify', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const domainId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  // Rate limit check
  await checkVerificationRateLimit(c.env.CACHE, tenantId);

  // Buscar domínio
  const domain = await db.queryOne<{
    id: string;
    tenant_id: string;
    domain: string;
    status: string;
    cf_hostname_id: string | null;
  }>(
    `SELECT id, tenant_id, domain, status, cf_hostname_id FROM domains WHERE id = ? AND status != 'removed'`,
    [domainId],
  );

  if (!domain) {
    throw new NotFoundError('Domain', domainId);
  }

  if (domain.tenant_id !== tenantId) {
    throw new ForbiddenError('Este domínio não pertence à sua conta');
  }

  // Se já está ativo, retornar sucesso direto
  if (domain.status === 'active') {
    return c.json({
      verified: true,
      status: 'active',
      message: 'Domínio já está verificado e ativo',
    });
  }

  // 0. Check Cloudflare Custom Hostname status first (if available)
  if (domain.cf_hostname_id) {
    const cfStatus = await getCustomHostnameStatus(domain.cf_hostname_id, c.env);

    if (cfStatus && cfStatus.status === 'active') {
      // CF says it's active — mark as verified
      const sslStatus = cfStatus.ssl?.status === 'active' ? 'active' : 'pending';
      await db.execute(
        `UPDATE domains
         SET status = 'active', ssl_status = ?, verified_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
        [sslStatus, domainId],
      );

      await db.execute(
        `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address, details_json)
         VALUES (?, ?, ?, 'domain_verified', 'domain', ?, ?, ?)`,
        [
          generateUlid(),
          tenantId,
          c.get('userId'),
          domainId,
          c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
          JSON.stringify({ method: 'cf_custom_hostname', cfStatus: cfStatus.status, sslStatus }),
        ],
      );

      return c.json({
        verified: true,
        status: 'active',
        method: 'cf_custom_hostname',
        sslStatus,
        message: 'Domínio verificado com sucesso via Cloudflare Custom Hostname!',
      });
    }

    // CF hostname exists but not active yet — check if pending
    if (cfStatus && (cfStatus.status === 'pending' || cfStatus.status === 'moved')) {
      // Update ssl_status from CF
      const sslStatus = cfStatus.ssl?.status ?? 'pending';
      await db.execute(
        `UPDATE domains SET ssl_status = ?, updated_at = datetime('now') WHERE id = ?`,
        [sslStatus, domainId],
      );

      // Still fall through to DNS checks below as fallback
    }
  }

  // 1. Tentar CNAME check
  const cnameResult = await verifyCname(domain.domain);

  if (cnameResult.found) {
    // Verificado via CNAME!
    await db.execute(
      `UPDATE domains
       SET status = 'active', ssl_status = 'pending', verified_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
      [domainId],
    );

    // Audit log
    await db.execute(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address, details_json)
       VALUES (?, ?, ?, 'domain_verified', 'domain', ?, ?, ?)`,
      [
        generateUlid(),
        tenantId,
        c.get('userId'),
        domainId,
        c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
        JSON.stringify({ method: 'cname', target: cnameResult.target }),
      ],
    );

    return c.json({
      verified: true,
      status: 'active',
      method: 'cname',
      message: 'Domínio verificado com sucesso via CNAME!',
      sslNote:
        'Para SSL automático, certifique-se de que seu domínio usa o Cloudflare como DNS (plano gratuito). Caso contrário, o certificado SSL precisará ser configurado manualmente.',
    });
  }

  // 2. Fallback: TXT check
  const txtResult = await verifyTxtRecord(domain.domain, tenantId);

  if (txtResult.found) {
    // Verificado via TXT!
    await db.execute(
      `UPDATE domains
       SET status = 'active', ssl_status = 'pending', verified_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
      [domainId],
    );

    // Audit log
    await db.execute(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address, details_json)
       VALUES (?, ?, ?, 'domain_verified', 'domain', ?, ?, ?)`,
      [
        generateUlid(),
        tenantId,
        c.get('userId'),
        domainId,
        c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
        JSON.stringify({ method: 'txt' }),
      ],
    );

    return c.json({
      verified: true,
      status: 'active',
      method: 'txt',
      message: 'Domínio verificado com sucesso via registro TXT!',
      sslNote:
        'Lembre-se de também configurar o CNAME apontando para sites.framevideos.com para que seu site funcione corretamente.',
    });
  }

  // 3. Não verificado — retornar instruções
  // Atualizar status pra failed se estava pending por muito tempo
  if (domain.status === 'pending_verification') {
    await db.execute(
      `UPDATE domains SET updated_at = datetime('now') WHERE id = ?`,
      [domainId],
    );
  }

  const txtVerifyRecord = `fv-verify-${tenantId}`;

  return c.json({
    verified: false,
    status: domain.status,
    cnameCheck: {
      expected: CNAME_TARGET,
      found: cnameResult.target,
    },
    txtCheck: {
      host: `_frame-verify.${domain.domain}`,
      expectedValue: txtVerifyRecord,
      found: false,
    },
    instructions: {
      option1: `Configure um registro CNAME no seu DNS apontando ${domain.domain} para ${CNAME_TARGET}`,
      option2: `Ou adicione um registro TXT em _frame-verify.${domain.domain} com valor ${txtVerifyRecord}`,
      note: 'Alterações de DNS podem levar de alguns minutos até 48 horas para propagar. Tente novamente mais tarde.',
    },
  });
});

// ─── DELETE /api/v1/domains/:id — Remover domínio ───────────────────────────

domains.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const domainId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  // Buscar domínio
  const domain = await db.queryOne<{
    id: string;
    tenant_id: string;
    domain: string;
    is_primary: number;
    cf_hostname_id: string | null;
  }>(
    `SELECT id, tenant_id, domain, is_primary, cf_hostname_id FROM domains WHERE id = ? AND status != 'removed'`,
    [domainId],
  );

  if (!domain) {
    throw new NotFoundError('Domain', domainId);
  }

  if (domain.tenant_id !== tenantId) {
    throw new ForbiddenError('Este domínio não pertence à sua conta');
  }

  // Delete Cloudflare Custom Hostname (if exists)
  if (domain.cf_hostname_id) {
    await deleteCustomHostname(domain.cf_hostname_id, c.env);
  }

  // Soft delete
  await db.execute(
    `UPDATE domains SET status = 'removed', is_primary = 0, cf_hostname_id = NULL, updated_at = datetime('now') WHERE id = ?`,
    [domainId],
  );

  // Se era primário, promover o próximo domínio ativo
  if (domain.is_primary === 1) {
    const nextDomain = await db.queryOne<{ id: string }>(
      `SELECT id FROM domains WHERE tenant_id = ? AND status != 'removed' ORDER BY created_at ASC LIMIT 1`,
      [tenantId],
    );

    if (nextDomain) {
      await db.execute(
        `UPDATE domains SET is_primary = 1, updated_at = datetime('now') WHERE id = ?`,
        [nextDomain.id],
      );
    }
  }

  // Audit log
  await db.execute(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address, details_json)
     VALUES (?, ?, ?, 'domain_remove', 'domain', ?, ?, ?)`,
    [
      generateUlid(),
      tenantId,
      c.get('userId'),
      domainId,
      c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
      JSON.stringify({ domain: domain.domain }),
    ],
  );

  return c.json({ success: true });
});

// ─── PUT /api/v1/domains/:id/primary — Definir como primário ────────────────

domains.put('/:id/primary', async (c) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    throw new ValidationError('Tenant ID not found in session');
  }

  const domainId = c.req.param('id');
  const db = new D1Client(c.env.DB);

  // Buscar domínio
  const domain = await db.queryOne<{
    id: string;
    tenant_id: string;
    domain: string;
    status: string;
  }>(
    `SELECT id, tenant_id, domain, status FROM domains WHERE id = ? AND status != 'removed'`,
    [domainId],
  );

  if (!domain) {
    throw new NotFoundError('Domain', domainId);
  }

  if (domain.tenant_id !== tenantId) {
    throw new ForbiddenError('Este domínio não pertence à sua conta');
  }

  if (domain.status !== 'active') {
    throw new ValidationError(
      'Apenas domínios verificados (ativos) podem ser definidos como primário',
    );
  }

  // Batch: remover primário de todos + setar neste
  await db.batch([
    {
      sql: `UPDATE domains SET is_primary = 0, updated_at = datetime('now') WHERE tenant_id = ?`,
      params: [tenantId],
    },
    {
      sql: `UPDATE domains SET is_primary = 1, updated_at = datetime('now') WHERE id = ?`,
      params: [domainId],
    },
  ]);

  // Audit log
  await db.execute(
    `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, ip_address, details_json)
     VALUES (?, ?, ?, 'domain_set_primary', 'domain', ?, ?, ?)`,
    [
      generateUlid(),
      tenantId,
      c.get('userId'),
      domainId,
      c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null,
      JSON.stringify({ domain: domain.domain }),
    ],
  );

  return c.json({ success: true });
});

export { domains };
