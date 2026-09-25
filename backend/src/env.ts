import { existsSync } from 'node:fs';
import { z } from 'zod';

// Prisma CLI .env'i kendisi okur; sunucu için Node'un yerleşik yükleyicisini kullanıyoruz.
if (existsSync('.env')) process.loadEnvFile('.env');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  /** "*" veya virgülle ayrılmış origin listesi */
  CORS_ORIGIN: z.string().default('*'),
  /** HS256 imzalama anahtarı */
  JWT_SECRET: z.string().min(32),
  /** Oturum süresi (gün) */
  JWT_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Virgülle ayrılmış Google OAuth client ID'leri; boşsa Google ile giriş kapalı */
  GOOGLE_CLIENT_ID: z.string().default(''),
  /** Tarayıcı tabanlı OAuth akışı için (web uygulaması istemcisi); boşsa Google girişi kapalı */
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  /** GitHub OAuth App; ikisi de boşsa GitHub girişi kapalı */
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  /** Sağlayıcıların geri döneceği adres; sağlayıcı panelinde callback olarak kayıtlı olmalı */
  PUBLIC_API_URL: z.string().url().optional(),
  /** Girişten sonra dönülebilecek uygulama şemaları (açık yönlendirmeyi önler) */
  OAUTH_APP_SCHEMES: z.string().default('exp,exps,localbite'),
  /**
   * Web'den (yönetici paneli) sosyal girişe izin verilen tam origin'ler, virgülle.
   * Şema değil origin eşleşmesi: tek kullanımlık kod yalnızca bu adreslere gönderilir.
   */
  OAUTH_WEB_ORIGINS: z.string().default('http://localhost:5173'),
  /** Kullanım şartları, gizlilik ve silme talepleri için iletişim adresi (yayından önce gerçek adresle değiştirin) */
  LEGAL_CONTACT_EMAIL: z.string().email().default('privacy@localbite.example'),
  /** İş ortaklığı kimlikleri (boşsa bağlantı kimliksiz gider) */
  GETYOURGUIDE_PARTNER_ID: z.string().optional(),
  VIATOR_PID: z.string().optional(),
  AIRALO_REF: z.string().optional(),
  /**
   * Mağaza ödemesi bağlanana kadar test satın alması. Üretimde AÇILMAZ (bkz. aşağıdaki kontrol):
   * aksi hâlde herkes Premium'u bedava alabilirdi.
   */
  /**
   * Google Places API (New) anahtarı; boşsa canlı mekanlar yalnızca OpenStreetMap'ten (Overpass) gelir.
   * Kota/hata durumunda da OSM'e düşülür.
   */
  GOOGLE_PLACES_API_KEY: z.string().default(''),
  /** Yakındaki canlı gerçek mekanları (Google/OSM) listeye ekle */
  LIVE_PLACES_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ALLOW_MOCK_PURCHASES: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  // Belirtilmemişse yalnızca geliştirmede açık; üretimde açıkça true verilse bile kapalı
  ALLOW_MOCK_PURCHASES:
    parsed.NODE_ENV !== 'production' && (process.env.ALLOW_MOCK_PURCHASES === undefined || parsed.ALLOW_MOCK_PURCHASES),
};
export type Env = typeof env;
