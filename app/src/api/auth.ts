import type { AuthResponseDTO, AuthUserDTO, LoginInput, RegisterInput } from '@localbite/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from './client';
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
