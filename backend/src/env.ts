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
  /** Sağlayıcıların geri döneceği adres; sağlayıcı panelinde callback olarak kayıtlı olmalı */
  PUBLIC_API_URL: z.string().url().optional(),
  /** Girişten sonra dönülebilecek uygulama şemaları (açık yönlendirmeyi önler) */
  /**
   * Apple ile Giriş: kimlik token'ının hedef kitlesi (uygulama paket kimliği; Expo Go için host.exp.Exponent).
   * İmza Apple'ın açık anahtarlarıyla doğrulanır, sunucuda gizli anahtar gerekmez.
   */
  APPLE_BUNDLE_IDS: z.string().default('app.localbite,host.exp.Exponent'),
  /**
   * Uygulama içi satın alma (Explorer Pass). Google Play Billing / Apple IAP bağlanana kadar kapalı:
   * kapalıyken tüm rotalar ücretsizdir ve hiçbir yerde ödeme istenmez.
   */
  PAYMENTS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
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
   * Google Places API (New) sunucu anahtarı. Varsa liste/harita/detay Google'dan gelir (günlük sınırlar içinde);
   * yoksa, sınır dolunca ya da hata olunca OpenStreetMap verisine düşülür.
   */
  GOOGLE_PLACES_API_KEY: z.string().default(''),
  /**
   * Günlük Google istek sınırları (aylık ücretsiz: Nearby Enterprise, Details ve Photos 1.000'er). Varsayılanlar ücretsiz
   * kotayı biraz aşabilir: en kötü durumda ayda ~35 $ (liste) + ~25 $ (fotoğraf). Bütçeye göre Railway'de değiştirilir.
   */
  GOOGLE_NEARBY_DAILY_LIMIT: z.coerce.number().int().min(0).default(60),
  GOOGLE_DETAIL_DAILY_LIMIT: z.coerce.number().int().min(0).default(30),
  GOOGLE_PHOTO_DAILY_LIMIT: z.coerce.number().int().min(0).default(150),
  /** Dükkân cephesi (Street View Static, ayda 10.000 ücretsiz; üst veri istekleri ücretsiz) */
  GOOGLE_STREETVIEW_DAILY_LIMIT: z.coerce.number().int().min(0).default(300),
  /** OSM yemek mekanlarını arka planda veritabanına aktar (liste anlık Overpass'a bağlı kalmasın) */
  OSM_IMPORT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** Yakındaki gerçek mekanları (OpenStreetMap) listeye ekle */
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
