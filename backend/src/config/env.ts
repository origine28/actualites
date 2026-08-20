import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const MB = 1024 * 1024;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().max(65535).default(8080),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL est obligatoire (ex: postgresql://user:pass@127.0.0.1:5432/news_db)'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET doit contenir au moins 32 caracteres'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET doit contenir au moins 32 caracteres'),
  STORAGE_ROOT: z.string().min(1).default('./storage'),
  MAX_IMAGE_SIZE: z.coerce.number().int().positive().default(5 * MB),
  MAX_PDF_SIZE: z.coerce.number().int().positive().default(50 * MB),
  MAX_APP_SIZE: z.coerce.number().int().positive().default(100 * MB),

  // Session
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),

  // Lockout
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),

  // Rate limiting login
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // Argon2id
  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  // CORS (optionnel — vide/absent = same-origin, pas de headers CORS ajoutés).
  CORS_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variables d'environnement invalides :\n${details}`);
}

export const env = parsed.data;
export type Env = typeof env;

export const IS_PRODUCTION = env.NODE_ENV === 'production';
