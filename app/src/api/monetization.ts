import type { AuthUserDTO, ExperienceDTO, TrailDetailDTO, TrailSummaryDTO } from '@localbite/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { useLocale } from '../i18n';
import { useAuthStore } from '../store/auth';
import { api } from './client';

/**
 * Explorer Pass fiyatı. Mağaza ödemesi bağlandığında fiyat mağazadan (yerel para birimiyle) okunmalı;
 * App Store ve Google Play fiyatı uygulamanın içinde sabit yazmaya izin vermez.
 */
export const EXPLORER_PASS_PRICE = '$4.99';

const monetizationKeys = {
  experiences: (venueId: string | null, locale: string) => ['experiences', venueId, locale] as const,
  // Kilit durumu izleyiciye bağlı: oturum anahtarın parçası
  trailsAll: ['trails'] as const,
  trails: (locale: string, token: string | null) => ['trails', 'list', locale, token] as const,
  trail: (slug: string, locale: string, token: string | null) => ['trails', 'detail', slug, locale, token] as const,
};

export function useExperiences(venueId: string | null = null) {
  const locale = useLocale();
  return useQuery({
    queryKey: monetizationKeys.experiences(venueId, locale),
    queryFn: ({ signal }) =>
      api<{ items: ExperienceDTO[] }>('/experiences', { signal, query: { venueId: venueId ?? undefined } }),
    staleTime: 10 * 60_000,
  });
}

export function useTrails() {
  const locale = useLocale();
  const token = useAuthStore((s) => s.session?.token ?? null);
  return useQuery({
    queryKey: monetizationKeys.trails(locale, token),
    queryFn: ({ signal }) => api<{ items: TrailSummaryDTO[] }>('/trails', { signal }),
    staleTime: 60_000,
  });
}

export function useTrail(slug: string) {
  const locale = useLocale();
  const token = useAuthStore((s) => s.session?.token ?? null);
  return useQuery({
    queryKey: monetizationKeys.trail(slug, locale, token),
    queryFn: ({ signal }) => api<TrailDetailDTO>(`/trails/${encodeURIComponent(slug)}`, { signal }),
    // 402 (Pass gerekli) tekrar denenmez
    retry: false,
  });
}

/** Satın alma sonrası: kullanıcıyı güncelle, kilitli rotaları yeniden çek */
function useOnEntitlementChanged() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  return (res: { user: AuthUserDTO }) => {
    updateUser(res.user);
    queryClient.invalidateQueries({ queryKey: monetizationKeys.trailsAll });
  };
}

/** Geçici: mağaza ödemesi bağlanana kadar test satın alması (sunucu yalnızca geliştirmede izin verir) */
export function useMockPurchase() {
  const onChanged = useOnEntitlementChanged();
  return useMutation({
    mutationFn: () => api<{ user: AuthUserDTO }>('/billing/mock-purchase', { method: 'POST' }),
    onSuccess: onChanged,
  });
}

export function useRestorePurchases() {
  const onChanged = useOnEntitlementChanged();
  return useMutation({
    mutationFn: () => api<{ user: AuthUserDTO }>('/billing/restore', { method: 'POST' }),
    onSuccess: onChanged,
  });
}

// ─────────────────────────────────────────────
// Paywall: herhangi bir ekrandan açılır, kök layout'ta bir kez çizilir
// ─────────────────────────────────────────────

interface PaywallState {
  visible: boolean;
  /** Satın alma başarılı olunca (ör. kilitli rotayı açmak için) */
  onUnlocked: (() => void) | null;
  open: (onUnlocked?: () => void) => void;
  close: () => void;
}

export const usePaywall = create<PaywallState>((set) => ({
  visible: false,
  onUnlocked: null,
  open: (onUnlocked) => set({ visible: true, onUnlocked: onUnlocked ?? null }),
  close: () => set({ visible: false, onUnlocked: null }),
}));
