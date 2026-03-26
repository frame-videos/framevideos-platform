import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api-client';

export function useTrending(params?: any) {
  return useQuery({
    queryKey: ['analytics', 'trending', params],
    queryFn: async () => {
      const response = await api.analytics.getTrending(params);
      return response.data;
    },
  });
}

export function useDashboard(params?: any) {
  return useQuery({
    queryKey: ['analytics', 'dashboard', params],
    queryFn: async () => {
      const response = await api.analytics.getDashboard(params);
      return response.data;
    },
  });
}

export function useTrackEvent() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.analytics.trackEvent(data);
      return response.data;
    },
  });
}
