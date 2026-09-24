import type { VenueType } from '@localbite/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CakeSlice, Sandwich, Soup, Truck, type LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { create } from 'zustand';

// ─────────────────────────────────────────────
// Paletler
// ─────────────────────────────────────────────

export interface Palette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  /** Renkli zemin (primary, açık rozeti, fotoğraf) üzerindeki metin: tüm temalarda beyaz */
  textInverse: string;

  primary: string;
  primarySoft: string;
  /** İkinci vurgu: puan yıldızları, rozetler */
  gold: string;

  open: string;
  openSoft: string;
  closed: string;
  warning: string;
  warningSoft: string;
  danger: string;

  mobile: string;
  mobileAccent: string;
  shop: string;
  shopSoft: string;

  /** Fotoğraf üstü yarı saydam rozet zemini */
  overlay: string;
  shadow: string;
}

export const THEME_NAMES = ['warm', 'dark', 'clean'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

const shared = {
  textInverse: '#FFFFFF',
  mobile: '#F97316',
  mobileAccent: '#FACC15',
  shop: '#2563EB',
} as const;

const palettes: Record<ThemeName, Palette> = {
  /** Sokak Sıcaklığı: kiremit vurgular, krem zemin */
  warm: {
    ...shared,
    bg: '#FFFBF5',
    surface: '#FFFFFF',
    surfaceMuted: '#F6F1EA',
    border: '#EAE2D6',
    text: '#1F1A14',
    textMuted: '#6F6557',
    primary: '#C2410C',
    primarySoft: '#FFEDD5',
    gold: '#F59E0B',
    open: '#16A34A',
    openSoft: '#DCFCE7',
    closed: '#9CA3AF',
    warning: '#B45309',
    warningSoft: '#FEF3C7',
    danger: '#B91C1C',
    shopSoft: '#DBEAFE',
    overlay: 'rgba(24,18,12,0.62)',
    shadow: '#3B2A14',
  },
  /** Gece Keşfi: füme zemin, altın ve neon turuncu */
  dark: {
    ...shared,
    bg: '#121212',
    surface: '#1C1C1E',
    surfaceMuted: '#27272A',
    border: '#303034',
    text: '#F4F1EA',
    textMuted: '#A8A29A',
    primary: '#FF7A1A',
    primarySoft: '#3A230F',
    gold: '#F5C542',
    open: '#34D399',
    openSoft: '#0F2E23',
    closed: '#6B7280',
    warning: '#FBBF24',
    warningSoft: '#3A2E0C',
    danger: '#F87171',
    shopSoft: '#172554',
    overlay: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
  },
  /** Temiz Minimalist: beyaz zemin, antrasit metin, zümrüt vurgu */
  clean: {
    ...shared,
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F3F4F6',
    border: '#E5E7EB',
    text: '#1F2328',
    textMuted: '#5B616E',
    primary: '#059669',
    primarySoft: '#D1FAE5',
    gold: '#F97316',
    open: '#059669',
    openSoft: '#D1FAE5',
    closed: '#9CA3AF',
    warning: '#C2410C',
    warningSoft: '#FFEDD5',
    danger: '#DC2626',
    shopSoft: '#DBEAFE',
    overlay: 'rgba(17,24,39,0.6)',
    shadow: '#111827',
  },
};

export interface Theme {
  name: ThemeName;
  isDark: boolean;
  colors: Palette;
  font: ReturnType<typeof makeFont>;
  shadow: ReturnType<typeof makeShadow>;
}

function makeFont(c: Palette) {
  return {
    title: { fontSize: 22, fontWeight: '700' as const, color: c.text },
    heading: { fontSize: 17, fontWeight: '700' as const, color: c.text },
    body: { fontSize: 15, fontWeight: '400' as const, color: c.text },
    small: { fontSize: 13, fontWeight: '500' as const, color: c.textMuted },
    tiny: { fontSize: 11, fontWeight: '600' as const, color: c.textMuted },
  };
}

function makeShadow(c: Palette, isDark: boolean) {
  return {
    card: {
      shadowColor: c.shadow,
      shadowOpacity: isDark ? 0.5 : 0.14,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: isDark ? 2 : 5,
    },
    pin: {
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
  };
}

const themes: Record<ThemeName, Theme> = Object.fromEntries(
  THEME_NAMES.map((name) => {
    const isDark = name === 'dark';
    const colors = palettes[name];
    return [name, { name, isDark, colors, font: makeFont(colors), shadow: makeShadow(colors, isDark) }];
  }),
) as Record<ThemeName, Theme>;

// ─────────────────────────────────────────────
// Seçili tema (AsyncStorage'da saklanır)
// ─────────────────────────────────────────────

const STORAGE_KEY = 'localbite.theme';
const isThemeName = (v: string | null): v is ThemeName => (THEME_NAMES as readonly string[]).includes(v ?? '');

interface ThemeState {
  name: ThemeName;
  /** Kayıtlı tema okunana kadar false; kök layout bu sürede çizim yapmaz (tema yanıp sönmesin) */
  hydrated: boolean;
  setTheme: (name: ThemeName) => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  name: 'warm',
  hydrated: false,
  setTheme: (name) => {
    set({ name });
    AsyncStorage.setItem(STORAGE_KEY, name).catch(() => {});
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (isThemeName(saved)) set({ name: saved });
    } catch {
      // varsayılan temada kal
    }
    set({ hydrated: true });
  },
}));

export const useTheme = (): Theme => themes[useThemeStore((s) => s.name)];
export const getTheme = (): Theme => themes[useThemeStore.getState().name];
export const themePreview = (name: ThemeName) => palettes[name];

/**
 * Temaya bağlı StyleSheet. Modül seviyesinde tanımlanır, bileşende hook olarak çağrılır;
 * her tema için bir kez oluşturulup önbelleğe alınır.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: Theme) => T & StyleSheet.NamedStyles<any>,
): () => T {
  const cache = new Map<ThemeName, T>();
  return function useStyles() {
    const theme = useTheme();
    let styles = cache.get(theme.name);
    if (!styles) {
      styles = StyleSheet.create(factory(theme)) as T;
      cache.set(theme.name, styles);
    }
    return styles;
  };
}

// ─────────────────────────────────────────────
// Temadan bağımsız sabitler
// ─────────────────────────────────────────────

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

/** Kategori renkleri tüm temalarda aynı: harita pinleri ve kartlar tanınır kalsın */
export const venueTypeMeta: Record<VenueType, { color: string; gradient: [string, string]; Icon: LucideIcon; emoji: string }> = {
  HOME_COOKING: { color: '#2563EB', gradient: ['#1E3A8A', '#3B82F6'], Icon: Soup, emoji: '🍲' },
  STREET_CART: { color: '#F97316', gradient: ['#9A3412', '#FB923C'], Icon: Truck, emoji: '🍢' },
  LOCAL_BURGER_WRAP: { color: '#7C3AED', gradient: ['#4C1D95', '#A78BFA'], Icon: Sandwich, emoji: '🍔' },
  DESSERT_TEA: { color: '#DB2777', gradient: ['#831843', '#F472B6'], Icon: CakeSlice, emoji: '☕' },
};

const AUTHOR_COLORS = ['#C2410C', '#7C3AED', '#0F766E', '#B45309', '#DB2777', '#1D4ED8'];

/** Yazar adından sabit bir renk (aynı kişi hep aynı renkte) */
export function authorColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}
