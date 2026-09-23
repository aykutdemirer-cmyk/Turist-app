import { DEFAULT_LOCALE, LOCALES, type Locale } from '@localbite/shared';

const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/** Öncelik: ?locale= → Accept-Language → varsayılan (en) */
export function resolveLocale(explicit: Locale | undefined, acceptLanguage: string | undefined): Locale {
  if (explicit) return explicit;
  for (const part of acceptLanguage?.split(',') ?? []) {
    const lang = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

/** Tercih edilen dildeki çeviriyi, yoksa varsayılan dili, o da yoksa ilk satırı seçer. */
export function pickTranslation<T extends { locale: string }>(rows: readonly T[], locale: Locale): T | undefined {
  return rows.find((r) => r.locale === locale) ?? rows.find((r) => r.locale === DEFAULT_LOCALE) ?? rows[0];
}

/** Sorguda yalnızca gereken çeviri satırlarını çekmek için */
export const localesFor = (locale: Locale): Locale[] => [...new Set([locale, DEFAULT_LOCALE])];
