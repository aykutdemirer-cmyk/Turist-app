import { z } from 'zod';
import {
  LOCALES,
  LOCAL_TIPS,
  LOCATION_REQUIRED_REPORTS,
  PRICE_LEVELS,
  REPORT_TYPES,
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
