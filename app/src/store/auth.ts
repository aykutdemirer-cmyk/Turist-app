import type { AuthResponseDTO, AuthUserDTO } from '@localbite/shared';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const TOKEN_KEY = 'localbite.authToken';
const USER_KEY = 'localbite.authUser';

/** Giriş modalında gösterilen gerekçe metninin anahtarı (t.auth.reasons) */
export type AuthReason = 'review' | 'post' | 'comment' | 'like' | 'profile';

interface Session {
  token: string;
  user: AuthUserDTO;
}

/** Senkron okuma: ilk render'da oturum durumu doğru olsun (misafir ekranı yanıp sönmesin) */
function initialSession(): Session | null {
  try {
    const token = SecureStore.getItem(TOKEN_KEY);
    const user = SecureStore.getItem(USER_KEY);
    if (token && user) return { token, user: JSON.parse(user) as AuthUserDTO };
  } catch {
    // misafir olarak başla
  }
  return null;
}

interface AuthState {
  session: Session | null;
  signIn: (res: AuthResponseDTO) => void;
  updateUser: (user: AuthUserDTO) => void;
  signOut: () => void;

  /** Giriş gerektiren eylem: giriş başarılı olunca çalıştırılır */
  pendingAction: (() => void) | null;
  setPendingAction: (action: (() => void) | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: initialSession(),
  signIn: ({ token, user }) => {
    set({ session: { token, user } });
    SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => {});
  },
  updateUser: (user) => {
    const session = get().session;
    if (!session) return;
    set({ session: { ...session, user } });
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => {});
  },
  signOut: () => {
    set({ session: null, pendingAction: null });
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
  },

  pendingAction: null,
  setPendingAction: (pendingAction) => set({ pendingAction }),
}));

export const useCurrentUser = () => useAuthStore((s) => s.session?.user ?? null);
/** Bileşen dışı kod (API istemcisi) için anlık değer */
export const getAuthToken = () => useAuthStore.getState().session?.token ?? null;
