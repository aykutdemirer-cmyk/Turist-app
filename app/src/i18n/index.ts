import { DEFAULT_LOCALE, LOCALES, type Locale } from '@localbite/shared';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { en, type Dictionary } from './en';
import { tr } from './tr';

const dictionaries: Record<Locale, Dictionary> = { en, tr };
const STORAGE_KEY = 'localbite.locale';

const isLocale = (v: string | null | undefined): v is Locale => !!v && (LOCALES as readonly string[]).includes(v);

function initialLocale(): Locale {
  // Kullanıcının seçimi (senkron okuma: ilk render doğru dilde olsun) → cihaz dili → İngilizce
  try {
    const saved = SecureStore.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // SecureStore erişilemiyorsa cihaz diline düş
  }
  for (const { languageCode } of getLocales()) {
    if (isLocale(languageCode)) return languageCode;
  }
  return DEFAULT_LOCALE;
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: initialLocale(),
  setLocale: (locale) => {
    set({ locale });
    SecureStore.setItemAsync(STORAGE_KEY, locale).catch(() => {});
  },
}));

/** Bileşenlerde: dil değişince yeniden render olur */
export const useLocale = () => useLocaleStore((s) => s.locale);
export const useT = (): Dictionary => dictionaries[useLocale()];

/** Bileşen dışı kod (API istemcisi, biçimlendiriciler) için anlık değer */
export const getLocale = (): Locale => useLocaleStore.getState().locale;
export const getT = (): Dictionary => dictionaries[getLocale()];

export type { Dictionary };
