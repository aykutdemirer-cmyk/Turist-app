import type { AuthResponseDTO, AuthUserDTO, LoginInput, OAuthProvidersDTO, RegisterInput } from '@localbite/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect } from 'react';
import { getDeviceId } from '../lib/deviceId';
import { useAuthStore } from '../store/auth';
import { api } from './client';
import { API_BASE } from './config';
import { communityKeys } from './community';

/** Oturum değişince kişiye özel önbellek (ör. "katılıyorum" durumu) yenilenir */
function useOnSignedIn() {
  const queryClient = useQueryClient();
  const signIn = useAuthStore((s) => s.signIn);
  return (res: AuthResponseDTO) => {
    signIn(res);
    queryClient.invalidateQueries({ queryKey: communityKeys.all });
  };
}

export function useLogin() {
  const onSignedIn = useOnSignedIn();
  return useMutation({
    mutationFn: (body: LoginInput) => api<AuthResponseDTO>('/auth/login', { method: 'POST', body }),
    onSuccess: onSignedIn,
  });
}

export function useRegister() {
  const onSignedIn = useOnSignedIn();
  return useMutation({
    mutationFn: (body: RegisterInput) => api<AuthResponseDTO>('/auth/register', { method: 'POST', body }),
    onSuccess: onSignedIn,
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const signOut = useAuthStore((s) => s.signOut);
  return () => {
    signOut();
    queryClient.invalidateQueries({ queryKey: communityKeys.all });
  };
}

/**
 * Uygulama açılışında saklı oturumu sunucuyla doğrular ve profil bilgisini tazeler.
 * Token geçersizse api() oturumu kendisi kapatır.
 */
export function useSessionRefresh() {
  const token = useAuthStore((s) => s.session?.token ?? null);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { data } = useQuery({
    queryKey: ['auth', 'me', token],
    enabled: token !== null,
    queryFn: ({ signal }) => api<{ user: AuthUserDTO }>('/auth/me', { signal }),
    staleTime: Infinity,
    retry: false,
  });
  useEffect(() => {
    if (data) updateUser(data.user);
  }, [data, updateUser]);
}

// ─────────────────────────────────────────────
// Sosyal giriş (Google, GitHub): tarayıcıda sunucu yönetimli OAuth
// ─────────────────────────────────────────────

export type OAuthProvider = keyof OAuthProvidersDTO;

/** Sağlayıcının dönüşte açacağı uygulama bağlantısı (Expo Go'da exp://…/--/oauth-callback) */
export const OAUTH_CALLBACK_PATH = 'oauth-callback';

export function useOAuthProviders() {
  return useQuery({
    queryKey: ['auth', 'oauth-providers'],
    queryFn: ({ signal }) => api<OAuthProvidersDTO>('/auth/oauth/providers', { signal }),
    staleTime: 5 * 60_000,
  });
}

/** Dönüş hem tarayıcı sonucundan hem yönlendiriciden gelebilir; her kod/hata bir kez işlenir */
const handled = new Set<string>();

export interface OAuthReturn {
  code?: string;
  error?: string;
}

export const parseOAuthReturn = (url: string): OAuthReturn => {
  const { queryParams } = Linking.parse(url);
  return {
    code: typeof queryParams?.code === 'string' ? queryParams.code : undefined,
    error: typeof queryParams?.error === 'string' ? queryParams.error : undefined,
  };
};

/**
 * Dönüşü işler: code → oturum, error → giriş ekranında gösterilecek hata.
 * Sonuç: 'signed-in' | 'error' | 'ignored' (zaten işlenmiş ya da boş dönüş)
 */
export function useCompleteOAuth() {
  const queryClient = useQueryClient();
  return useCallback(
    async ({ code, error }: OAuthReturn): Promise<'signed-in' | 'error' | 'ignored'> => {
      const key = code ?? error;
      if (!key || handled.has(key)) return 'ignored';
      handled.add(key);

      const { signIn, setOAuthError } = useAuthStore.getState();
      if (error) {
        // Kullanıcı sağlayıcı sayfasında vazgeçtiyse hata göstermeye gerek yok
        setOAuthError(error === 'cancelled' ? null : error);
        return 'error';
      }
      try {
        const res = await api<AuthResponseDTO>('/auth/oauth/exchange', { method: 'POST', body: { code } });
        setOAuthError(null);
        signIn(res);
        queryClient.invalidateQueries({ queryKey: communityKeys.all });
        return 'signed-in';
      } catch {
        setOAuthError('OAUTH_FAILED');
        return 'error';
      }
    },
    [queryClient],
  );
}

/** Sağlayıcının giriş sayfasını uygulama içi tarayıcıda açar; dönüşü useCompleteOAuth işler */
export function useStartOAuth() {
  const complete = useCompleteOAuth();
  return useCallback(
    async (provider: OAuthProvider, termsAccepted: boolean) => {
      useAuthStore.getState().setOAuthError(null);
      const redirect = Linking.createURL(OAUTH_CALLBACK_PATH);
      const params = new URLSearchParams({ redirect, deviceId: await getDeviceId() });
      // Yeni hesap açılacaksa sunucu şart onayını ister
      if (termsAccepted) params.set('terms', '1');
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE}/auth/oauth/${provider}/start?${params.toString()}`,
        redirect,
      );
      if (result.type === 'success') await complete(parseOAuthReturn(result.url));
    },
    [complete],
  );
}

/**
 * Hesabı ve tüm verileri kalıcı olarak siler; ardından yerel oturum ve önbellek temizlenir.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const signOut = useAuthStore((s) => s.signOut);
  return useMutation({
    mutationFn: () => api<void>('/auth/me', { method: 'DELETE' }),
    onSuccess: () => {
      signOut();
      queryClient.clear();
    },
  });
}
