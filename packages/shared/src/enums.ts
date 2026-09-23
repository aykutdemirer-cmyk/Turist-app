// Prisma enum'larının aynası. Değer eklerken backend/prisma/schema.prisma ile birlikte güncelleyin.

export const VENUE_TYPES = ['HOME_COOKING', 'STREET_CART', 'LOCAL_BURGER_WRAP', 'DESSERT_TEA'] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

/** Pahalı seviye bilinçli olarak yok. */
export const PRICE_LEVELS = ['BUDGET', 'MODERATE'] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

export const LOCAL_TIPS = [
  'CASH_ONLY',
  'PAY_AT_COUNTER',
  'NO_RESERVATIONS',
  'SELF_SERVICE_TRAY',
  'SHARED_TABLES',
  'POINT_TO_ORDER',
  'CLOSES_WHEN_SOLD_OUT',
  'LUNCH_ONLY',
  'STANDING_ONLY',
] as const;
export type LocalTip = (typeof LOCAL_TIPS)[number];

export const VENUE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CLOSED'] as const;
export type VenueStatus = (typeof VENUE_STATUSES)[number];

export const REPORT_TYPES = ['SPOTTED_TODAY', 'UPVOTE', 'NOT_HERE', 'CLOSED'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** Raporlayanın mekanın yakınında olmasını gerektiren bildirimler. */
export const LOCATION_REQUIRED_REPORTS: readonly ReportType[] = ['SPOTTED_TODAY', 'NOT_HERE'];

/** SAMPLE: demo için yazılmış örnek yorum; arayüzde mutlaka "örnek" diye etiketlenir. */
export const REVIEW_SOURCES = ['SAMPLE', 'COMMUNITY', 'GOOGLE'] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const USER_ROLES = ['USER', 'LOCAL_GUIDE', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];
