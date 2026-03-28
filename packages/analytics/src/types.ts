// Tipos do módulo analytics — será implementado nos próximos sprints

export interface PageView {
  tenantId: string;
  path: string;
  referrer?: string;
  userAgent?: string;
  ip?: string;
  country?: string;
  timestamp: string;
}

export interface AnalyticsSummary {
  totalViews: number;
  uniqueVisitors: number;
  avgSessionDuration: number;
  bounceRate: number;
  topPages: Array<{ path: string; views: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
}

export interface DateRange {
  start: string;
  end: string;
}
