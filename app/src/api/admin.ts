import type { AdminReportDTO, DeletionRequestDTO, ModerationStatus } from '@localbite/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { communityKeys } from './community';
import { venueKeys } from './venues';

/** Yönetici uç noktaları; rol sunucuda doğrulanır (ADMIN olmayana 403) */
const adminKeys = {
  reports: (status: ModerationStatus) => ['admin', 'reports', status] as const,
  deletions: ['admin', 'deletions'] as const,
};

export function useAdminReports(status: ModerationStatus = 'PENDING') {
  return useQuery({
    queryKey: adminKeys.reports(status),
    queryFn: ({ signal }) => api<{ items: AdminReportDTO[] }>('/admin/reports', { signal, query: { status, limit: 100 } }),
  });
}

/** İçeriği kaldır ya da şikayeti yoksay: kayıt listeden hemen çıkar, hata olursa geri gelir */
export function useModerateReport() {
  const queryClient = useQueryClient();
  const key = adminKeys.reports('PENDING');
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'remove' | 'dismiss' }) =>
      api<void>(`/admin/reports/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<{ items: AdminReportDTO[] }>(key);
      queryClient.setQueryData<{ items: AdminReportDTO[] }>(key, (old) => old && { items: old.items.filter((r) => r.id !== id) });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: (_res, _err, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      // Kaldırılan içerik akışta/detayda da kaybolsun
      if (action === 'remove') {
        queryClient.invalidateQueries({ queryKey: communityKeys.all });
        queryClient.invalidateQueries({ queryKey: venueKeys.all });
      }
    },
  });
}

export function useDeletionRequests() {
  return useQuery({
    queryKey: adminKeys.deletions,
    queryFn: ({ signal }) => api<{ items: DeletionRequestDTO[] }>('/admin/deletion-requests', { signal }),
  });
}

export function useProcessDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'complete' | 'reject' }) =>
      api<{ status: string; accountDeleted: boolean }>(`/admin/deletion-requests/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.deletions }),
  });
}
