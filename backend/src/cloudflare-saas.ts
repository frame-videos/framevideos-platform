/**
 * Cloudflare for SaaS - Custom Hostnames Integration
 * 
 * Manages custom domains for tenants using Cloudflare for SaaS.
 * 
 * @see https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 */

export interface CloudflareConfig {
  zoneId: string;
  apiToken: string;
}

export interface CustomHostnameRequest {
  hostname: string;
  ssl?: {
    method?: 'http' | 'txt' | 'email';
    type?: 'dv';
    settings?: {
      http2?: 'on' | 'off';
      min_tls_version?: '1.0' | '1.1' | '1.2' | '1.3';
      tls_1_3?: 'on' | 'off';
      ciphers?: string[];
    };
  };
}

export interface CustomHostnameResponse {
  id: string;
  hostname: string;
  ssl: {
    status: 'pending_validation' | 'pending_issuance' | 'pending_deployment' | 'active' | 'active_redeploying' | 'deactivating' | 'deleted';
    method: 'http' | 'txt' | 'email';
    type: 'dv';
    certificate_authority?: string;
    validation_errors?: Array<{
      message: string;
    }>;
    validation_records?: Array<{
      txt_name?: string;
      txt_value?: string;
      http_url?: string;
      http_body?: string;
    }>;
  };
  status: 'pending' | 'active' | 'moved' | 'deleted';
  verification_errors?: string[];
  ownership_verification?: {
    type: 'txt';
    name: string;
    value: string;
  };
  ownership_verification_http?: {
    http_url: string;
    http_body: string;
  };
  created_at: string;
}

export interface CloudflareAPIError {
  success: false;
  errors: Array<{
    code: number;
    message: string;
  }>;
}

export class CloudflareSaaSClient {
  private config: CloudflareConfig;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(config: CloudflareConfig) {
    this.config = config;
  }

  /**
   * Add a custom hostname to Cloudflare for SaaS
   */
  async addCustomHostname(hostname: string): Promise<CustomHostnameResponse> {
    const request: CustomHostnameRequest = {
      hostname,
      ssl: {
        method: 'http',
        type: 'dv',
        settings: {
          http2: 'on',
          min_tls_version: '1.2',
          tls_1_3: 'on',
        },
      },
    };

    const response = await fetch(
      `${this.baseUrl}/zones/${this.config.zoneId}/custom_hostnames`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    const data = await response.json() as { result: CustomHostnameResponse; success: boolean } | CloudflareAPIError;

    if (!data.success) {
      const error = data as CloudflareAPIError;
      throw new Error(`Cloudflare API error: ${error.errors.map(e => e.message).join(', ')}`);
    }

    return (data as { result: CustomHostnameResponse }).result;
  }

  /**
   * Get custom hostname status
   */
  async getCustomHostname(hostnameId: string): Promise<CustomHostnameResponse> {
    const response = await fetch(
      `${this.baseUrl}/zones/${this.config.zoneId}/custom_hostnames/${hostnameId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json() as { result: CustomHostnameResponse; success: boolean } | CloudflareAPIError;

    if (!data.success) {
      const error = data as CloudflareAPIError;
      throw new Error(`Cloudflare API error: ${error.errors.map(e => e.message).join(', ')}`);
    }

    return (data as { result: CustomHostnameResponse }).result;
  }

  /**
   * Delete a custom hostname
   */
  async deleteCustomHostname(hostnameId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/zones/${this.config.zoneId}/custom_hostnames/${hostnameId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json() as { success: boolean } | CloudflareAPIError;

    if (!data.success) {
      const error = data as CloudflareAPIError;
      throw new Error(`Cloudflare API error: ${error.errors.map(e => e.message).join(', ')}`);
    }
  }

  /**
   * Validate domain format
   */
  static validateDomain(domain: string): boolean {
    // Basic domain validation
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    
    // Prevent localhost, IPs, etc
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (blocked.includes(domain.toLowerCase())) {
      return false;
    }

    // Check if it's an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(domain)) {
      return false;
    }

    return domainRegex.test(domain);
  }

  /**
   * Format validation instructions for the tenant
   */
  static formatValidationInstructions(
    hostname: CustomHostnameResponse,
    fallbackOrigin: string
  ): {
    type: string;
    name: string;
    value: string;
    instructions: string;
  } {
    return {
      type: 'CNAME',
      name: hostname.hostname,
      value: fallbackOrigin,
      instructions: [
        `1. Go to your DNS provider (e.g., GoDaddy, Namecheap, Cloudflare)`,
        `2. Add a CNAME record:`,
        `   - Type: CNAME`,
        `   - Name: ${hostname.hostname.split('.')[0]} (or @ for root domain)`,
        `   - Value: ${fallbackOrigin}`,
        `   - TTL: Auto or 3600`,
        `3. Wait for DNS propagation (usually 5-30 minutes)`,
        `4. SSL certificate will be issued automatically by Cloudflare`,
      ].join('\n'),
    };
  }
}

/**
 * Helper to map Cloudflare status to our internal status
 */
export function mapCloudflareStatus(
  hostnameStatus: string,
  sslStatus: string
): 'pending' | 'active' | 'failed' {
  // If hostname is active and SSL is active, we're good
  if (hostnameStatus === 'active' && sslStatus === 'active') {
    return 'active';
  }

  // If hostname is deleted or SSL failed, mark as failed
  if (hostnameStatus === 'deleted' || sslStatus === 'deleted') {
    return 'failed';
  }

  // Everything else is pending
  return 'pending';
}
