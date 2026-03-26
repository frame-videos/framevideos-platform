export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787/api/v1';
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-frame-videos.r2.dev';

export const config = {
  apiUrl: API_BASE_URL,
  r2PublicUrl: R2_PUBLIC_URL,
  environment: process.env.NEXT_PUBLIC_ENV || 'development',
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
};
