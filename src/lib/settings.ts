import 'server-only';
import type { InstanceSettings, Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { decryptSecret, encryptSecret } from './crypto';

/** Fetch the singleton instance settings (creating defaults on first access). */
export async function getSettings(): Promise<InstanceSettings> {
  return prisma.instanceSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
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
