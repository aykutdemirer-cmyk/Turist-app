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
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
