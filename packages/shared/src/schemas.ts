import { z } from 'zod';
import {
  CONTENT_REPORT_REASONS,
  LOCALES,
  LOCAL_TIPS,
  LOCATION_REQUIRED_REPORTS,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TYPES,
  MODERATION_STATUSES,
  PRICE_LEVELS,
  REPORTABLE_CONTENT,
  REPORT_TYPES,
  VENUE_STATUSES,
  VENUE_TYPES,
} from './enums';

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);
export const localeSchema = z.enum(LOCALES);

/** Uygulamanın ilk açılışta ürettiği anonim kimlik (UUID vb.). */
export const deviceIdSchema = z.string().trim().min(8).max(128);

/** "true" / "1" / true → true. Query string'ler için. */
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

/** "HOME_COOKING,STREET_CART" veya tekrar eden parametre → dizi */
const csvList = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v),
    z.array(item),
  );

export const nearbyQuerySchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  /** metre */
  radius: z.coerce.number().int().min(100).max(20_000).default(2_000),
  category: csvList(z.enum(VENUE_TYPES)).optional(),
  openNowOnly: booleanish.default(false),
  /** BUDGET → yalnızca $ mekanlar */
  maxPrice: z.enum(PRICE_LEVELS).optional(),
  locale: localeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

export const recentConfirmationsQuerySchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  radius: z.coerce.number().int().min(100).max(20_000).default(5_000),
  /** Geriye dönük saat */
  hours: z.coerce.number().int().min(1).max(72).default(24),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type RecentConfirmationsQuery = z.infer<typeof recentConfirmationsQuerySchema>;

export const scheduleInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openMinute: z.number().int().min(0).max(1439),
    closeMinute: z.number().int().min(0).max(1439),
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    locationNote: z.string().trim().max(200).optional(),
  })
  .refine((s) => (s.latitude === undefined) === (s.longitude === undefined), {
    message: 'latitude and longitude must be provided together',
    path: ['longitude'],
  });
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const reportInputSchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    note: z.string().trim().max(280).optional(),
  })
  .refine(
    (r) => !LOCATION_REQUIRED_REPORTS.includes(r.type) || (r.latitude !== undefined && r.longitude !== undefined),
    { message: 'latitude and longitude are required for this report type', path: ['latitude'] },
  );
export type ReportInput = z.infer<typeof reportInputSchema>;

export const suggestDishSchema = z.object({
  localName: z.string().trim().min(2).max(80),
  /** Turistin dilinde ad: "Stewed white beans" */
  translatedName: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional(),
});

export const suggestVenueSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(VENUE_TYPES),
  isMobile: z.boolean().default(false),
  priceLevel: z.enum(PRICE_LEVELS).default('BUDGET'),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  locationNote: z.string().trim().max(200).optional(),
  neighborhood: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  locale: localeSchema.default('en'),
  tagline: z.string().trim().max(140).optional(),
  description: z.string().trim().max(1000).optional(),
  localTips: z.array(z.enum(LOCAL_TIPS)).max(LOCAL_TIPS.length).default([]),
  mustTry: z.array(suggestDishSchema).max(3).default([]),
  schedules: z.array(scheduleInputSchema).max(21).default([]),
});
export type SuggestVenueInput = z.infer<typeof suggestVenueSchema>;

// ─────────────────────────────────────────────
// Üyelik
// ─────────────────────────────────────────────

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(60),
  email: emailSchema,
  password: passwordSchema,
  locale: localeSchema.optional(),
  /** Kullanım Şartları ve Topluluk Kuralları onayı zorunlu */
  acceptTerms: z.literal(true),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Google ile giriş: istemcinin Google'dan aldığı ID token */
export const googleLoginSchema = z.object({ idToken: z.string().min(20).max(4096) });
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

/** Tarayıcı tabanlı sosyal giriş */
export const OAUTH_PROVIDERS = ['google', 'github'] as const;
export const oauthStartQuerySchema = z.object({
  /** Girişten sonra dönülecek uygulama bağlantısı (ör. exp://…/--/oauth-callback) */
  redirect: z.string().min(1).max(500),
  deviceId: deviceIdSchema.optional(),
  /** "1": kullanıcı şartları uygulamada onayladı (yeni hesap açmak için zorunlu) */
  terms: z.literal('1').optional(),
});
export const oauthCallbackQuerySchema = z.object({
  code: z.string().max(2000).optional(),
  state: z.string().max(4000).optional(),
  error: z.string().max(200).optional(),
});
export const oauthExchangeSchema = z.object({ code: z.string().min(16).max(200) });

// ─────────────────────────────────────────────
// Mekan yorumu (üye başına mekan başına bir tane; tekrar gönderince güncellenir)
// ─────────────────────────────────────────────

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(1000),
  locale: localeSchema.default('en'),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

// ─────────────────────────────────────────────
// Topluluk
// ─────────────────────────────────────────────

export const createPostSchema = z.object({
  title: z.string().trim().min(3).max(120),
  content: z.string().trim().min(3).max(2000),
  venueId: z.string().min(1).max(100).optional(),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(1000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const feedQuerySchema = z.object({
  /** Önceki sayfanın son gönderisinin id'si */
  cursor: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

// ─────────────────────────────────────────────
// Moderasyon
// ─────────────────────────────────────────────

export const reportContentSchema = z.object({
  contentType: z.enum(REPORTABLE_CONTENT),
  contentId: z.string().min(1).max(100),
  reason: z.enum(CONTENT_REPORT_REASONS),
  note: z.string().trim().max(500).optional(),
});
export type ReportContentInput = z.infer<typeof reportContentSchema>;

export const blockUserSchema = z.object({ userId: z.string().min(1).max(100) });

export const adminReportsQuerySchema = z.object({
  status: z.enum(MODERATION_STATUSES).default('PENDING'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Web formu: uygulamaya erişemeyen kullanıcının silme talebi */
export const deletionRequestSchema = z.object({
  email: emailSchema,
  note: z.string().trim().max(1000).optional(),
});

// ─────────────────────────────────────────────
// Esnaf paneli (VENDOR — yalnızca kendi mekanı)
// ─────────────────────────────────────────────

/** GPS: cihazın anlık konumu · MAP: haritada pin sürüklenerek seçildi */
export const vendorLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  source: z.enum(['GPS', 'MAP']),
});
export type VendorLocationInput = z.infer<typeof vendorLocationSchema>;

/** null = çalışma saatlerine göre (elle ayarı kaldır) */
export const vendorOpenSchema = z.object({ isOpen: z.boolean().nullable() });
export type VendorOpenInput = z.infer<typeof vendorOpenSchema>;

export const vendorAnnouncementSchema = z.object({
  title: z.string().trim().min(3).max(80),
  content: z.string().trim().min(3).max(500),
  type: z.enum(ANNOUNCEMENT_TYPES).default('ANNOUNCEMENT'),
});
export type VendorAnnouncementInput = z.input<typeof vendorAnnouncementSchema>;

export const vendorDishSchema = z.object({
  /** TL; null = fiyatı kaldır */
  priceTry: z.number().min(0).max(100_000).nullable(),
  portion: z.string().trim().max(60).nullable(),
});
export type VendorDishInput = z.infer<typeof vendorDishSchema>;

// ─────────────────────────────────────────────
// Super Admin yönetim merkezi
// ─────────────────────────────────────────────

export const adminVenuesQuerySchema = z.object({
  status: z.enum(VENUE_STATUSES).optional(),
  promoted: booleanish.optional(),
  /** Yalnızca canlı konum paylaşan seyyarlar */
  live: booleanish.optional(),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type AdminVenuesQuery = z.infer<typeof adminVenuesQuerySchema>;

export const adminPromotedSchema = z.object({ isPromoted: z.boolean() });

export const adminAnnouncementsQuerySchema = z.object({
  status: z.enum(ANNOUNCEMENT_STATUSES).default('PENDING'),
});
