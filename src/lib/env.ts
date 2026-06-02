import { z } from 'zod';

/**
 * Centralized, validated environment access.
 *
 * Only variables that must exist BEFORE the database/UI is available live in env
 * (per the plan: SMTP/LLM config live in the DB, not here). Everything is parsed
 * once at module load so a misconfigured deploy fails fast and loudly.
 *
 * During `next build` (no real env), we relax validation so the build can run;
 * runtime access on the server still validates.
 */
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://onemorerep:devpassword@localhost:5432/onemorerep?schema=public'),
  // Secrets — required in production at runtime; optional in dev/test/build.
  APP_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    if (isBuildPhase) {
      // Best-effort defaults during build; never used to serve traffic.
      return EnvSchema.parse({});
    }
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const env: Env = loadEnv();
