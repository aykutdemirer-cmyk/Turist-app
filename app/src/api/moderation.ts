import type { BlockedUserDTO, ReportContentInput } from '@localbite/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuthStore } from '../store/auth';
import { api } from './client';
import { communityKeys } from './community';
import { venueKeys } from './venues';

/**
 * Engellenen üyeler: sunucu listeleri zaten filtreler; bu küme, engelleme anında ekranı yeniden istek
 * beklemeden güncellemek için istemci tarafında da uygulanır.
 */
interface BlockState {
  blocked: Set<string>;
  set: (ids: string[]) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
}

export const useBlockStore = create<BlockState>((set) => ({
  blocked: new Set(),
  set: (ids) => set({ blocked: new Set(ids) }),
  add: (id) => set((s) => ({ blocked: new Set(s.blocked).add(id) })),
  remove: (id) =>
    set((s) => {
      const next = new Set(s.blocked);
      next.delete(id);
      return { blocked: next };
    }),
}));

/** Bileşenlerde: yazarı engellenmiş mi (null yazar = örnek içerik, engellenemez) */
export const useIsBlocked = () => {
  const blocked = useBlockStore((s) => s.blocked);
  return (authorId: string | null | undefined) => !!authorId && blocked.has(authorId);
};

const moderationKeys = { blocks: (token: string | null) => ['moderation', 'blocks', token] as const };

export function useBlockedUsers() {
  const token = useAuthStore((s) => s.session?.token ?? null);
  return useQuery({
    queryKey: moderationKeys.blocks(token),
    enabled: token !== null,
    queryFn: ({ signal }) => api<{ items: BlockedUserDTO[] }>('/moderation/blocks', { signal }),
  });
}

/** Oturum açılınca engel listesini yükler, kapanınca temizler (kök layout'ta bir kez) */
export function useBlockSync() {
  const token = useAuthStore((s) => s.session?.token ?? null);
  const { data } = useBlockedUsers();
  const setBlocked = useBlockStore((s) => s.set);
  useEffect(() => {
    if (!token) setBlocked([]);
    else if (data) setBlocked(data.items.map((b) => b.id));
  }, [token, data, setBlocked]);
}

function useInvalidateUgc() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: communityKeys.all });
    queryClient.invalidateQueries({ queryKey: venueKeys.all });
    queryClient.invalidateQueries({ queryKey: ['moderation', 'blocks'] });
  };
}

export function useReportContent() {
  return useMutation({
    mutationFn: (body: ReportContentInput) => api<{ id: string }>('/moderation/reports', { method: 'POST', body }),
  });
}

export function useBlockUser() {
  const add = useBlockStore((s) => s.add);
  const invalidate = useInvalidateUgc();
  return useMutation({
    mutationFn: (userId: string) => api<BlockedUserDTO>('/moderation/blocks', { method: 'POST', body: { userId } }),
    // Anında gizle; sunucu reddederse geri al
    onMutate: (userId) => add(userId),
    onError: (_err, userId) => useBlockStore.getState().remove(userId),
    onSettled: invalidate,
  });
}

export function useUnblockUser() {
  const remove = useBlockStore((s) => s.remove);
  const invalidate = useInvalidateUgc();
  return useMutation({
    mutationFn: (userId: string) => api<void>(`/moderation/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
    onSuccess: (_res, userId) => remove(userId),
    onSettled: invalidate,
  });
}
