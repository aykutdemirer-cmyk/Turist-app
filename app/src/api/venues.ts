import type {
  LatLng,
  NearbyResponseDTO,
  ReportResultDTO,
  ReportType,
  SuggestVenueInput,
  VenueDetailDTO,
  VenueSummaryDTO,
  Locale,
} from '@localbite/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from '../i18n';
import type { Filters } from '../store/explore';
import { api } from './client';

export const NEARBY_RADIUS_M = 3_000;

// Sunucu metinleri dile göre döndürdüğü için dil de sorgu anahtarında: dil değişince yeniden çekilir
export const venueKeys = {
  all: ['venues'] as const,
  nearby: () => [...venueKeys.all, 'nearby'] as const,
  nearbyFor: (center: LatLng, filters: Filters, locale: Locale) =>
    [
      ...venueKeys.nearby(),
      // ~10 m hassasiyet: küçük GPS oynamaları yeni istek tetiklemesin
      { lat: center.latitude.toFixed(4), lng: center.longitude.toFixed(4), ...filters, locale },
    ] as const,
  detailAll: (id: string) => [...venueKeys.all, 'detail', id] as const,
  detail: (id: string, locale: Locale) => [...venueKeys.detailAll(id), locale] as const,
};

export function useNearbyVenues(center: LatLng | null, filters: Filters) {
  const locale = useLocale();
  return useQuery({
    queryKey: center ? venueKeys.nearbyFor(center, filters, locale) : venueKeys.nearby(),
    enabled: center !== null,
    queryFn: ({ signal }) =>
      api<NearbyResponseDTO>('/venues/nearby', {
        signal,
        query: {
          lat: center!.latitude,
          lng: center!.longitude,
          radius: NEARBY_RADIUS_M,
          category: filters.categories,
          openNowOnly: filters.openNow || undefined,
          maxPrice: filters.budget ? 'BUDGET' : undefined,
        },
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    // "Şu an açık" durumu zamanla değişir
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: venueKeys.nearby() }),
  });
}
