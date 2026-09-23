import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAuthStore, type AuthReason } from '../store/auth';

/**
 * Misafir serbestçe gezer; yazma eylemleri üyelik ister.
 * Üyeyse eylemi hemen çalıştırır, değilse giriş modalını açar ve eylemi girişten sonra çalıştırır.
 */
export function useRequireAuth() {
  const router = useRouter();
  return useCallback(
    (reason: AuthReason, action?: () => void) => {
      const { session, setPendingAction } = useAuthStore.getState();
      if (session) {
        action?.();
        return;
      }
      setPendingAction(action ?? null);
      router.push({ pathname: '/auth', params: { reason } });
    },
    [router],
  );
}
