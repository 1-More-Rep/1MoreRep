import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Liveness + readiness probe. Used by the Docker healthcheck and CI.
 * Returns 200 only when the app can reach the database.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', db: 'up', time: new Date().toISOString() },
      { status: 200 },
    );
  } catch (err) {
    // Log the underlying reason — a 503 with no cause is undebuggable when the probe
    // starts failing in production.
    logger.error({ err }, '[health] database readiness check failed');
    return NextResponse.json({ status: 'degraded', db: 'down' }, { status: 503 });
  }
}
