import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/server/db/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Export the authenticated user's own data as JSON (GDPR-style takeout). */
export async function GET() {
  const user = await requireUser();
  const [profile, routines, workouts, prs, bodyMetrics, stats] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { email: true, displayName: true, publicHandle: true, unitSystem: true, timezone: true, createdAt: true } }),
    prisma.routine.findMany({ where: { ownerId: user.id }, include: { items: { include: { exercise: { select: { name: true } } } } } }),
    prisma.workoutSession.findMany({ where: { ownerId: user.id, status: 'COMPLETED' }, include: { entries: { include: { exercise: { select: { name: true } }, sets: true } } } }),
    prisma.personalRecord.findMany({ where: { ownerId: user.id }, include: { exercise: { select: { name: true } } } }),
    prisma.bodyMetric.findMany({ where: { ownerId: user.id } }),
    prisma.userStats.findUnique({ where: { userId: user.id } }),
  ]);

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), profile, stats, routines, workouts, prs, bodyMetrics }, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2);
  return new NextResponse(body, {
    headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="1morerep-export.json"', 'cache-control': 'no-store' },
  });
}
