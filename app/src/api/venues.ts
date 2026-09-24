import type {
  LatLng,
  NearbyResponseDTO,
  RecentConfirmationDTO,
  ReportResultDTO,
  ReportType,
  ReviewDTO,
  ReviewInput,
  SuggestVenueInput,
  VenueDetailDTO,
  VenueSummaryDTO,
  Locale,
} from '@localbite/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from '../i18n';
import { api } from './client';

export const NEARBY_RADIUS_M = 3_000;
/** API'nin izin verdiği en geniş yarıçap (Keşfet'te "Tümü") */
export const MAX_RADIUS_M = 20_000;

// ~10 m hassasiyet: küçük GPS oynamaları yeni istek tetiklemesin
const roundCenter = (c: LatLng) => ({ lat: c.latitude.toFixed(4), lng: c.longitude.toFixed(4) });

// Sunucu metinleri dile göre döndürdüğü için dil de sorgu anahtarında: dil değişince yeniden çekilir
export const venueKeys = {
  all: ['venues'] as const,
  nearby: () => [...venueKeys.all, 'nearby'] as const,
  nearbyFor: (center: LatLng, locale: Locale, radius: number) =>
    [...venueKeys.nearby(), { ...roundCenter(center), locale, radius }] as const,
  detailAll: (id: string) => [...venueKeys.all, 'detail', id] as const,
  detail: (id: string, locale: Locale) => [...venueKeys.detailAll(id), locale] as const,
  confirmations: (center: LatLng) => [...venueKeys.all, 'confirmations', roundCenter(center)] as const,
};

/**
 * Yarıçap içindeki tüm onaylı mekanlar (mesafeye göre sıralı).
 * Kategori/katman/arama filtreleri istemcide uygulanır: ekranlar aynı önbelleği paylaşır.
 */
export function useNearbyVenues(center: LatLng | null, radius = NEARBY_RADIUS_M) {
  const locale = useLocale();
  return useQuery({
    queryKey: center ? venueKeys.nearbyFor(center, locale, radius) : venueKeys.nearby(),
    enabled: center !== null,
    queryFn: ({ signal }) =>
      api<NearbyResponseDTO>('/venues/nearby', {
        signal,
        query: { lat: center!.latitude, lng: center!.longitude, radius, limit: 100 },
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    // "Şu an açık" durumu zamanla değişir
    refetchInterval: 60_000,
  });
}

export function useRecentConfirmations(center: LatLng | null) {
  return useQuery({
    queryKey: center ? venueKeys.confirmations(center) : [...venueKeys.all, 'confirmations'],
    enabled: center !== null,
    queryFn: ({ signal }) =>
      api<{ items: RecentConfirmationDTO[] }>('/confirmations/recent', {
        signal,
        query: { lat: center!.latitude, lng: center!.longitude },
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useVenue(id: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: venueKeys.detail(id, locale),
    queryFn: ({ signal }) => api<VenueDetailDTO>(`/venues/${encodeURIComponent(id)}`, { signal }),
    staleTime: 30_000,
  });
}

export interface SuggestResult {
  id: string;
  slug: string;
  status: 'PENDING';
  createdAt: string;
}

/** Yeni mekan önerisi. PENDING olduğu için haritadaki önbelleğe dokunmaz. */
export function useSuggestVenue() {
  return useMutation({
    mutationFn: (body: SuggestVenueInput) => api<SuggestResult>('/venues/suggest', { method: 'POST', body }),
  });
}

interface ReportVariables {
  type: ReportType;
  latitude?: number;
  longitude?: number;
}

export function useReportVenue(venueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ReportVariables) =>
      api<ReportResultDTO>(`/venues/${encodeURIComponent(venueId)}/report`, { method: 'POST', body }),

    // Harita ve kartlar yeniden istek beklemeden güncellensin
    onSuccess: (result) => {
      const patch = <T extends VenueSummaryDTO | VenueDetailDTO>(v: T): T =>
        v.id !== venueId
          ? v
          : {
              ...v,
              ...result.venue,
              isActiveNow: result.type === 'SPOTTED_TODAY' ? true : v.isActiveNow,
            };

      queryClient.setQueriesData<VenueDetailDTO>({ queryKey: venueKeys.detailAll(venueId) }, (old) => old && patch(old));
      queryClient.setQueriesData<NearbyResponseDTO>({ queryKey: venueKeys.nearby() }, (old) =>
        old ? { ...old, items: old.items.map(patch) } : old,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: venueKeys.nearby() });
      queryClient.invalidateQueries({ queryKey: [...venueKeys.all, 'confirmations'] });
    },
  });
}

/** Üye yorumu (aynı mekana tekrar gönderilirse güncellenir). Puan ortalaması değiştiği için mekan verisi tazelenir. */
export function useSubmitReview(venueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ReviewInput) =>
      api<ReviewDTO>(`/venues/${encodeURIComponent(venueId)}/review`, { method: 'PUT', body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: venueKeys.detailAll(venueId) });
      queryClient.invalidateQueries({ queryKey: venueKeys.nearby() });
    },
  });
}
