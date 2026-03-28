// API client para domínios — Sprint 4
// CRUD de domínios, verificação DNS, subdomínio automático

import { apiClient } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DomainStatus = 'pending_verification' | 'active' | 'failed' | 'removed';

export interface DomainItem {
  id: string;
  domain: string;
  status: DomainStatus;
  isPrimary: boolean;
  sslStatus: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DomainLimits {
  current: number;
  max: number;
  plan: string;
}

export interface ListDomainsResponse {
  domains: DomainItem[];
  subdomain: string | null;
  limits: DomainLimits;
}

export interface TxtRecordInfo {
  host: string;
  value: string;
}

export interface DomainInstructions {
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  sslNote: string;
}

export interface AddDomainResponse {
  id: string;
  domain: string;
  status: DomainStatus;
  isPrimary: boolean;
  sslStatus: string;
  cnameTarget: string;
  txtRecord: TxtRecordInfo;
  instructions: DomainInstructions;
}

export interface VerifyDomainResponse {
  verified: boolean;
  status: string;
  method?: 'cname' | 'txt';
  message: string;
  sslNote?: string;
  cnameCheck?: {
    expected: string;
    found: string | null;
  };
  txtCheck?: {
    host: string;
    expectedValue: string;
    found: boolean;
  };
  instructions?: {
    option1: string;
    option2: string;
    note: string;
  };
}

// ─── API Calls ───────────────────────────────────────────────────────────────

/**
 * Lista todos os domínios do tenant.
 */
export async function listDomains(): Promise<ListDomainsResponse> {
  return apiClient<ListDomainsResponse>('/api/v1/domains');
}

/**
 * Adiciona um novo domínio.
 */
export async function addDomain(domain: string): Promise<AddDomainResponse> {
  return apiClient<AddDomainResponse>('/api/v1/domains', {
    method: 'POST',
    body: { domain },
  });
}

/**
 * Verifica DNS de um domínio (CNAME + TXT).
 */
export async function verifyDomain(id: string): Promise<VerifyDomainResponse> {
  return apiClient<VerifyDomainResponse>(`/api/v1/domains/${id}/verify`, {
    method: 'POST',
  });
}

/**
 * Remove um domínio.
 */
export async function removeDomain(id: string): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/api/v1/domains/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Define um domínio como primário.
 */
export async function setPrimaryDomain(id: string): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/api/v1/domains/${id}/primary`, {
    method: 'PUT',
  });
}
