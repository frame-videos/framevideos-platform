import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://frame-videos-prod.frame-videos.workers.dev/api/v1';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        // Só redireciona se NÃO estiver já numa página de auth
        const isAuthPage = window.location.pathname.startsWith('/auth/');
        if (!isAuthPage) {
          window.location.href = '/auth/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// API Methods
export const api = {
  // Auth
  auth: {
    register: (email: string, password: string, name?: string) =>
      apiClient.post('/auth/register', { email, password, name }),
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }),
    me: () => apiClient.get('/auth/me'),
  },

  // Tenants
  tenants: {
    create: (data: { name: string; domain: string }) =>
      apiClient.post('/tenants', data),
    get: (id: string) => apiClient.get(`/tenants/${id}`),
    list: () => apiClient.get('/tenants'),
  },

  // Videos
  videos: {
    create: (data: any) => apiClient.post('/videos', data),
    get: (id: string) => apiClient.get(`/videos/${id}`),
    list: (params?: any) => apiClient.get('/videos', { params }),
    update: (id: string, data: any) => apiClient.put(`/videos/${id}`, data),
    delete: (id: string) => apiClient.delete(`/videos/${id}`),
    search: (query: string, params?: any) =>
      apiClient.get('/videos/search', { params: { q: query, ...params } }),
  },

  // Categories
  categories: {
    create: (data: { name: string }) => apiClient.post('/categories', data),
    get: (id: string) => apiClient.get(`/categories/${id}`),
    list: () => apiClient.get('/categories'),
    update: (id: string, data: any) => apiClient.put(`/categories/${id}`, data),
    delete: (id: string) => apiClient.delete(`/categories/${id}`),
  },

  // Tags
  tags: {
    create: (data: { name: string }) => apiClient.post('/tags', data),
    get: (id: string) => apiClient.get(`/tags/${id}`),
    list: () => apiClient.get('/tags'),
    update: (id: string, data: any) => apiClient.put(`/tags/${id}`, data),
    delete: (id: string) => apiClient.delete(`/tags/${id}`),
  },

  // Analytics
  analytics: {
    trackEvent: (data: any) => apiClient.post('/analytics/event', data),
    getTrending: (params?: any) => apiClient.get('/analytics/trending', { params }),
    getDashboard: (params?: any) => apiClient.get('/analytics/dashboard', { params }),
  },
};

export default apiClient;
