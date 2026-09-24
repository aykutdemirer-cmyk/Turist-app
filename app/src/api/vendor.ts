import type {
  VendorAnnouncementDTO,
  VendorAnnouncementInput,
  VendorDishInput,
  VendorLocationInput,
  VendorVenueDTO,
} from '@localbite/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from '../i18n';
import { api } from './client';
import { venueKeys } from './venues';

/** Esnaf paneli: rol ve sahiplik sunucuda doğrulanır (VENDOR değilse 403, başkasının mekanıysa 404) */
const vendorKeys = {
  all: ['vendor'] as const,
  venues: (locale: string) => [...vendorKeys.all, 'venues', locale] as const,
};

export function useVendorVenues() {
  const locale = useLocale();
  return useQuery({
    queryKey: vendorKeys.venues(locale),
    queryFn: ({ signal }) => api<{ items: VendorVenueDTO[] }>('/vendor/venues', { signal }),
  });
}

/** Mekan değişince hem panel hem ziyaretçi görünümü (harita, detay) tazelensin */
function useVendorMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      // Mekanı döndüren uç noktalarda önbelleği doğrudan güncelle (anında yansısın)
      if (result && typeof result === 'object' && 'baseLocation' in result) {
        const venue = result as unknown as VendorVenueDTO;
        queryClient.setQueriesData<{ items: VendorVenueDTO[] }>({ queryKey: vendorKeys.all }, (old) =>
          old && { items: old.items.map((v) => (v.id === venue.id ? venue : v)) },
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
      queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}

export const useUpdateVendorLocation = () =>
  useVendorMutation(({ venueId, ...body }: VendorLocationInput & { venueId: string }) =>
    api<VendorVenueDTO>(`/vendor/venues/${encodeURIComponent(venueId)}/location`, { method: 'PUT', body }),
  );

export const useSetVendorOpen = () =>
  useVendorMutation(({ venueId, isOpen }: { venueId: string; isOpen: boolean | null }) =>
    api<VendorVenueDTO>(`/vendor/venues/${encodeURIComponent(venueId)}/open`, { method: 'PUT', body: { isOpen } }),
  );

export const useCreateAnnouncement = () =>
  useVendorMutation(({ venueId, ...body }: VendorAnnouncementInput & { venueId: string }) =>
    api<VendorAnnouncementDTO>(`/vendor/venues/${encodeURIComponent(venueId)}/announcements`, { method: 'POST', body }),
  );

export const useUpdateDish = () =>
  useVendorMutation(({ dishId, ...body }: VendorDishInput & { dishId: string }) =>
    api<{ id: string; priceTry: number | null; portion: string | null }>(`/vendor/dishes/${encodeURIComponent(dishId)}`, {
      method: 'PUT',
      body,
    }),
  );
