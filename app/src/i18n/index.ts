import type { Locale } from '@localbite/shared';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { ar } from './ar';
import { de } from './de';
import { en, type Dictionary } from './en';
import { es } from './es';
import { ru } from './ru';
import { tr } from './tr';

/**
 * Arayüz dilleri. İçerik (mekan açıklamaları, yorumlar) sunucuda yalnızca TR/EN olarak tutulur;
 * diğer dillerde içerik İngilizce gelir (bkz. contentLocale).
 */
export const APP_LANGUAGES = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number]['code'];

const dictionaries: Record<AppLanguage, Dictionary> = { en, tr, de, ru, ar, es };
const STORAGE_KEY = 'localbite.locale';

const isLanguage = (v: string | null | undefined): v is AppLanguage => APP_LANGUAGES.some((l) => l.code === v);

/** Sunucudan istenen içerik dili */
const contentLocale = (lang: AppLanguage): Locale => (lang === 'tr' ? 'tr' : 'en');

function initialLanguage(): AppLanguage {
  // Kullanıcının seçimi (senkron okuma: ilk render doğru dilde olsun) → cihaz dili → İngilizce
  try {
    const saved = SecureStore.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // SecureStore erişilemiyorsa cihaz diline düş
  }
  for (const { languageCode } of getLocales()) {
    if (isLanguage(languageCode)) return languageCode;
  }
  return 'en';
}

interface LanguageState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: initialLanguage(),
  setLanguage: (language) => {
    set({ language });
    SecureStore.setItemAsync(STORAGE_KEY, language).catch(() => {});
  },
}));

/** Arayüz dili (bileşenlerde: değişince yeniden render olur) */
export const useLanguage = () => useLanguageStore((s) => s.language);
export const useT = (): Dictionary => dictionaries[useLanguage()];
/** Sunucu içeriğinin dili (sorgu anahtarları, yorum/kayıt dili) */
export const useLocale = (): Locale => contentLocale(useLanguage());

/** Bileşen dışı kod (API istemcisi, biçimlendiriciler) için anlık değerler */
export const getLanguage = (): AppLanguage => useLanguageStore.getState().language;
export const getLocale = (): Locale => contentLocale(getLanguage());
export const getT = (): Dictionary => dictionaries[getLanguage()];

export type { Dictionary };
