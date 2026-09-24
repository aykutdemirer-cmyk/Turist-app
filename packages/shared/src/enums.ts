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

export const VENUE_STATUSES = ['PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'CLOSED'] as const;
export type VenueStatus = (typeof VENUE_STATUSES)[number];

/**
 * Ana sayfa yemek kategorileri. Bir mekan birden fazlasında olabilir;
 * STREET_CART seyyarlara (locationType = DYNAMIC_STREET) API tarafından eklenir.
 */
export const FOOD_CATEGORIES = [
  'STEW',
  'DONER_WRAP',
  'BURGER_TOAST',
  'PIDE_PIZZA',
  'SOUP',
  'STREET_CART',
  'OLIVE_OIL_VEGAN',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const REPORT_TYPES = ['SPOTTED_TODAY', 'UPVOTE', 'NOT_HERE', 'CLOSED'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** Raporlayanın mekanın yakınında olmasını gerektiren bildirimler. */
export const LOCATION_REQUIRED_REPORTS: readonly ReportType[] = ['SPOTTED_TODAY', 'NOT_HERE'];

/** APP: uygulama üyesi · GOOGLE: Google Haritalar · OTHER: diğer dış kaynak · SAMPLE: demo için örnek yorum (arayüzde mutlaka "örnek" diye etiketlenir) */
export const REVIEW_SOURCES = ['APP', 'GOOGLE', 'OTHER', 'SAMPLE'] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const USER_ROLES = ['USER', 'LOCAL_GUIDE', 'VENDOR', 'SUPER_ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** STATIC: sabit dükkan · DYNAMIC_STREET: seyyar (konumu değişir) */
export const LOCATION_TYPES = ['STATIC', 'DYNAMIC_STREET'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const ANNOUNCEMENT_TYPES = ['ANNOUNCEMENT', 'PROMOTION'] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export const ANNOUNCEMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

/** Şikayet edilebilir içerik türleri ve nedenleri (moderasyon) */
export const REPORTABLE_CONTENT = ['POST', 'COMMENT', 'REVIEW'] as const;
export type ReportableContent = (typeof REPORTABLE_CONTENT)[number];

export const CONTENT_REPORT_REASONS = ['SPAM', 'ABUSE', 'MISLEADING', 'OTHER'] as const;
export type ContentReportReason = (typeof CONTENT_REPORT_REASONS)[number];

export const MODERATION_STATUSES = ['PENDING', 'REMOVED', 'DISMISSED'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];
