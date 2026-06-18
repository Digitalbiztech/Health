import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  DIRECT_DATABASE_URL: z.string().url('DIRECT_DATABASE_URL must be a valid URL'),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_JWT_SECRET: z.string().min(1, 'SUPABASE_JWT_SECRET is required'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:8080'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Extraction microservice (FastAPI — apps/extraction)
  EXTRACTION_SERVICE_URL: z.string().url().default('http://localhost:8001'),
  EXTRACTION_SERVICE_TIMEOUT_MS: z.coerce.number().default(120_000),
  // Shared secret for service-to-service auth. Optional so local dev works
  // without it; when set, it is sent as the X-Service-Secret header and the
  // extraction service enforces it.
  EXTRACTION_SERVICE_SECRET: z.string().optional(),

  // AI chat providers (optional — orchestrator skips any provider whose key is missing)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GEMINI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
