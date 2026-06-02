import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { hmacIp } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Persist a security/audit event. Never throws into the caller's path. */
export async function audit(e: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorId: e.actorId ?? null,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        metadata: e.metadata,
        ipHash: e.ip ? hmacIp(e.ip) : null,
      },
    });
  } catch (err) {
    logger.warn({ err, action: e.action }, 'audit write failed');
  }
}
