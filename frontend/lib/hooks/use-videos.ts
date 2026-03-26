import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api-client';

export function useVideos(params?: any) {
  return useQuery({
    queryKey: ['videos', params],
    queryFn: async () => {
      const response = await api.videos.list(params);
      return response.data;
    },
  });
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: ['video', id],
    queryFn: async () => {
      const response = await api.videos.get(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.videos.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

export function useUpdateVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.videos.update(id, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['video', variables.id] });
    },
  });
}

export function useDeleteVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.videos.delete(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

export function useSearchVideos(query: string, params?: any) {
  return useQuery({
    queryKey: ['videos', 'search', query, params],
    queryFn: async () => {
      const response = await api.videos.search(query, params);
      return response.data;
    },
    enabled: !!query,
  });
}
