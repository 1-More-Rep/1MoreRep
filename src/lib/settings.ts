import 'server-only';
import type { InstanceSettings } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { decryptSecret, encryptSecret } from './crypto';

// In-memory defaults mirroring the InstanceSettings schema defaults. Used only as a
// build-time / DB-unreachable fallback so metadata/manifest prerender never crashes.
const DEFAULT_SETTINGS: InstanceSettings = {
  id: 1,
  brandName: '1MoreRep',
  brandLogoKey: null,
  themeColor: '#e2553a',
  defaultUnitSystem: 'METRIC',
  allowSelfRegistration: false,
  requireEmailVerification: true,
  smtpHost: null,
  smtpPort: null,
  smtpUser: null,
  smtpPasswordEnc: null,
  smtpFrom: null,
  smtpSecure: true,
  llmProvider: 'NONE',
  llmBaseUrl: 'http://ollama:11434',
  llmModel: 'llama3.1',
  llmApiKeyEnc: null,
  llmTimeoutMs: 20000,
  vapidPublicKey: null,
  vapidPrivateKeyEnc: null,
  vapidSubject: null,
  updatedAt: new Date(0),
  updatedById: null,
};

/** Fetch the singleton instance settings (creating defaults on first access). */
export async function getSettings(): Promise<InstanceSettings> {
  try {
    return await prisma.instanceSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  } catch (e) {
    // No DB during `next build` prerender (or a transient outage): return safe
    // defaults so brand/manifest/metadata rendering never crashes. Real settings
    // load once the database is reachable.
    if (e instanceof Prisma.PrismaClientInitializationError) return DEFAULT_SETTINGS;
    throw e;
  }
}

export async function updateSettings(
  patch: Prisma.InstanceSettingsUpdateInput,
  actorId?: string,
): Promise<InstanceSettings> {
  return prisma.instanceSettings.update({
    where: { id: 1 },
    data: { ...patch, updatedById: actorId },
  });
}

/** Resolve decrypted SMTP config, or null if SMTP is not configured. */
export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  secure: boolean;
}

export function resolveSmtp(s: InstanceSettings): SmtpConfig | null {
  if (!s.smtpHost || !s.smtpPort || !s.smtpFrom) return null;
  return {
    host: s.smtpHost,
    port: s.smtpPort,
    user: s.smtpUser ?? undefined,
    pass: s.smtpPasswordEnc ? decryptSecret(s.smtpPasswordEnc) : undefined,
    from: s.smtpFrom,
    secure: s.smtpSecure,
  };
}

/** Encrypt a secret for storage in an *Enc column. */
export function encryptForStorage(plain: string): string {
  return encryptSecret(plain);
}
