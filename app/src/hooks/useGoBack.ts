import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/**
 * Geri dön; ekran bağlantıyla doğrudan açıldıysa (geçmiş yok) yedek sayfaya geç.
 * Yalın router.back() bu durumda "GO_BACK was not handled" hatası verir.
 */
export function useGoBack(fallback: Href = '/') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
