import type {
  AdminAnnouncementDTO,
  AdminClaimDTO,
  AdminDishSuggestionDTO,
  AdminReportDTO,
  AdminVenueDTO,
  AdminVenuesQuery,
  AnnouncementStatus,
  DeletionRequestDTO,
  ModerationStatus,
} from '@localbite/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { communityKeys } from './community';
import { venueKeys } from './venues';

/** Yönetim merkezi uç noktaları; rol sunucuda doğrulanır (SUPER_ADMIN olmayana 403) */
const adminKeys = {
  reports: (status: ModerationStatus) => ['admin', 'reports', status] as const,
  deletions: ['admin', 'deletions'] as const,
  venuesAll: ['admin', 'venues'] as const,
  venues: (query: Partial<AdminVenuesQuery>) => ['admin', 'venues', query] as const,
  announcements: (status: AnnouncementStatus) => ['admin', 'announcements', status] as const,
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

// ─────────────────────────────────────────────
// Mekanlar: başvuru onayı, sponsorluk, canlı konum denetimi
// ─────────────────────────────────────────────

type VenuesFilter = Partial<Pick<AdminVenuesQuery, 'status' | 'promoted' | 'live' | 'q'>>;

export function useAdminVenues(filter: VenuesFilter, enabled = true) {
  return useQuery({
    queryKey: adminKeys.venues(filter),
    enabled,
    queryFn: ({ signal }) => api<{ items: AdminVenueDTO[] }>('/admin/venues', { signal, query: { ...filter, limit: 200 } }),
  });
}

/** Mekan değişince yönetim listeleri ve ziyaretçi görünümü (harita, detay) tazelenir */
function useVenueMutation<TVars>(mutationFn: (vars: TVars) => Promise<AdminVenueDTO>, optimistic?: (vars: TVars, v: AdminVenueDTO) => AdminVenueDTO | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      if (!optimistic) return {};
      await queryClient.cancelQueries({ queryKey: adminKeys.venuesAll });
      const prev = queryClient.getQueriesData<{ items: AdminVenueDTO[] }>({ queryKey: adminKeys.venuesAll });
      queryClient.setQueriesData<{ items: AdminVenueDTO[] }>({ queryKey: adminKeys.venuesAll }, (old) =>
        old && { items: old.items.flatMap((v) => { const next = optimistic(vars, v); return next ? [next] : []; }) },
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => ctx?.prev?.forEach(([key, data]) => queryClient.setQueryData(key, data)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.venuesAll });
      queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}

/** Onay/ret: kayıt bekleyenler listesinden hemen çıkar */
export const useReviewVenue = () =>
  useVenueMutation(
    ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api<AdminVenueDTO>(`/admin/venues/${encodeURIComponent(id)}/${decision}`, { method: 'POST' }),
    ({ id }, v) => (v.id === id && v.status === 'PENDING_APPROVAL' ? null : v),
  );

/** Anahtar dokunulduğu anda döner; hata olursa geri alınır */
export const useSetPromoted = () =>
  useVenueMutation(
    ({ id, isPromoted }: { id: string; isPromoted: boolean }) =>
      api<AdminVenueDTO>(`/admin/venues/${encodeURIComponent(id)}/promoted`, { method: 'PUT', body: { isPromoted } }),
    ({ id, isPromoted }, v) => (v.id === id ? { ...v, isPromoted } : v),
  );

export const useModerateLiveLocation = () =>
  useVenueMutation(({ id, action }: { id: string; action: 'pin' | 'reset' }) =>
    api<AdminVenueDTO>(`/admin/venues/${encodeURIComponent(id)}/live-location/${action}`, { method: 'POST' }),
  );

// ─────────────────────────────────────────────
// Satıcı duyuruları
// ─────────────────────────────────────────────

export function useAdminAnnouncements(status: AnnouncementStatus = 'PENDING') {
  return useQuery({
    queryKey: adminKeys.announcements(status),
    queryFn: ({ signal }) => api<{ items: AdminAnnouncementDTO[] }>('/admin/announcements', { signal, query: { status } }),
  });
}

export function useReviewAnnouncement() {
  const queryClient = useQueryClient();
  const key = adminKeys.announcements('PENDING');
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api<AdminAnnouncementDTO>(`/admin/announcements/${encodeURIComponent(id)}/${decision}`, { method: 'POST' }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<{ items: AdminAnnouncementDTO[] }>(key);
      queryClient.setQueryData<{ items: AdminAnnouncementDTO[] }>(key, (old) => old && { items: old.items.filter((a) => a.id !== id) });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}

// ─────────────────────────────────────────────
// Gerçek mekanlar: sahiplenme başvuruları ve menü önerileri
// ─────────────────────────────────────────────

const claimsKey = ['admin', 'claims'] as const;
const dishSuggestionsKey = ['admin', 'dish-suggestions'] as const;

export function useAdminClaims() {
  return useQuery({
    queryKey: claimsKey,
    queryFn: ({ signal }) => api<{ items: AdminClaimDTO[] }>('/admin/claims', { signal }),
  });
}

/** Onay: üye mekanın sahibi (esnaf) olur */
export function useDecideClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api<{ id: string; status: string }>(`/admin/claims/${encodeURIComponent(id)}/${decision}`, { method: 'POST' }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: claimsKey });
      queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}

export function useAdminDishSuggestions() {
  return useQuery({
    queryKey: dishSuggestionsKey,
    queryFn: ({ signal }) => api<{ items: AdminDishSuggestionDTO[] }>('/admin/dish-suggestions', { signal }),
  });
}

/** Onay: lezzet görseliyle birlikte mekanın menüsüne eklenir */
export function useDecideDishSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api<{ id: string; status: string }>(`/admin/dish-suggestions/${encodeURIComponent(id)}/${decision}`, { method: 'POST' }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dishSuggestionsKey });
      queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}
