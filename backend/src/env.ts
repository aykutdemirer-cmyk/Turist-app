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
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
