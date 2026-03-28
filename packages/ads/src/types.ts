// Tipos do módulo ads — será implementado nos próximos sprints

export interface AdPlacement {
  id: string;
  name: string;
  position: 'header' | 'sidebar' | 'in_content' | 'footer' | 'overlay';
  width: number;
  height: number;
}

export interface AdServeRequest {
  tenantId: string;
  placementId: string;
  pageUrl: string;
  userAgent?: string;
  ip?: string;
}

export interface AdServeResponse {
  creativeId: string;
  html: string;
  trackingUrl: string;
}
