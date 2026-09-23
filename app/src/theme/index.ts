import type { VenueType } from '@localbite/shared';
import { CakeSlice, Sandwich, Soup, Truck, type LucideIcon } from 'lucide-react-native';

export const colors = {
  bg: '#FFFBF5',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F1EA',
  border: '#EAE2D6',
  text: '#1F1A14',
  textMuted: '#6F6557',
  textInverse: '#FFFFFF',

  primary: '#C2410C', // terracotta
  primarySoft: '#FFEDD5',

  open: '#16A34A',
  openSoft: '#DCFCE7',
  closed: '#9CA3AF',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',

  mobile: '#F97316', // seyyar pini: turuncu
  mobileAccent: '#FACC15', // seyyar pini: sarı iç halka
  shop: '#2563EB', // esnaf pini: mavi
  shopSoft: '#DBEAFE',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const font = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  small: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
  tiny: { fontSize: 11, fontWeight: '600' as const, color: colors.textMuted },
};

export const shadow = {
  card: {
    shadowColor: '#3B2A14',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  pin: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
};

export const venueTypeMeta: Record<VenueType, { color: string; Icon: LucideIcon; emoji: string }> = {
  HOME_COOKING: { color: colors.shop, Icon: Soup, emoji: '🍲' },
  STREET_CART: { color: colors.mobile, Icon: Truck, emoji: '🍢' },
  LOCAL_BURGER_WRAP: { color: '#7C3AED', Icon: Sandwich, emoji: '🍔' },
  DESSERT_TEA: { color: '#DB2777', Icon: CakeSlice, emoji: '☕' },
};
