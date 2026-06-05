import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { runJob } from '@/server/jobs';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Constant-time string compare — avoids leaking the secret via response timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Internal scheduled-job trigger, hit by the Compose cron sidecar. Guarded by a
 * shared secret (JOB_SECRET) and bound to the internal network in production.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.JOB_SECRET;
  const provided = req.headers.get('x-job-secret') ?? '';
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { job } = await params;
  try {
    const result = await runJob(job);
    return NextResponse.json({ ok: true, job, result });
  } catch (e) {
    logger.error({ err: e, job }, 'job failed');
    const message = e instanceof Error ? e.message : 'job failed';
    return NextResponse.json({ ok: false, error: message }, { status: message.startsWith('unknown job') ? 404 : 500 });
  }
}
