import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

/** Haritada kullanıcıyı temsil eden gezgin karakterleri; hepsi sırt çantası rozetiyle çizilir. */
export const AVATARS = [
  { id: 'backpacker', face: '🧔🏻‍♂️' },
  { id: 'explorer', face: '👨🏽‍🦱' },
  { id: 'wanderer', face: '👱🏼‍♂️' },
  { id: 'hiker', face: '👩🏻‍🦰' },
  { id: 'nomad', face: '👩🏽' },
  { id: 'globetrotter', face: '🧑🏿‍🦱' },
] as const;

export type AvatarId = (typeof AVATARS)[number]['id'];
export const DEFAULT_AVATAR: AvatarId = 'backpacker';

const STORAGE_KEY = 'localbite.avatar';

const isAvatarId = (v: string | null): v is AvatarId => AVATARS.some((a) => a.id === v);

function initialAvatar(): AvatarId {
  try {
    const saved = SecureStore.getItem(STORAGE_KEY);
    if (isAvatarId(saved)) return saved;
  } catch {
    // varsayılana düş
  }
  return DEFAULT_AVATAR;
}

interface ProfileState {
  avatarId: AvatarId;
  setAvatar: (id: AvatarId) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  avatarId: initialAvatar(),
  setAvatar: (avatarId) => {
    set({ avatarId });
    SecureStore.setItemAsync(STORAGE_KEY, avatarId).catch(() => {});
  },
}));

export const avatarFace = (id: AvatarId) => AVATARS.find((a) => a.id === id)?.face ?? AVATARS[0].face;
export const useAvatarFace = () => avatarFace(useProfileStore((s) => s.avatarId));
