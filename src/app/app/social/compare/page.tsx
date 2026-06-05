import type { CSSProperties } from 'react';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/server/db/prisma';
import { getPrivacy, canView } from '@/server/social/privacy';
import { areFriends, listFriends } from '@/server/social/friends';
import { getStatsBundle } from '@/server/queries/gamification';
import { Card, Icon, Mono, SectionLabel } from '@/components/ui';
import { weightUnit, kgToLb, type UnitSystemLike } from '@/domain/units';

export const dynamic = 'force-dynamic';

interface Metric {
  label: string;
  format: (n: number) => string;
  /** Higher value is the per-row "leader" for the gentle accent. */
  value: (b: Awaited<ReturnType<typeof getStatsBundle>>) => number;
}

// Total volume is stored in kg; render it in the VIEWER's unit so both sides of the
// comparison use the same unit (converting both preserves the leader ordering).
function buildMetrics(system: UnitSystemLike): Metric[] {
  return [
    { label: 'Lifetime XP', format: (n) => n.toLocaleString(), value: (b) => b.stats.lifetimeXp },
    { label: 'Level', format: (n) => String(n), value: (b) => b.progress.level },
    { label: 'Current streak', format: (n) => `${n} day${n === 1 ? '' : 's'}`, value: (b) => b.stats.currentStreak },
    { label: 'Weekly XP', format: (n) => n.toLocaleString(), value: (b) => b.weeklyXp },
    {
      label: 'Total volume',
      format: (n) => `${Math.round(n).toLocaleString()} ${weightUnit(system)}`,
      value: (b) => {
        const kgReps = Number(b.stats.totalVolume) / 100;
        return system === 'IMPERIAL' ? kgToLb(kgReps) : kgReps;
      },
    },
  ];
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Compare</h1>
      <Card soft><span style={{ color: 'var(--text-3)' }}>{message}</span></Card>
    </div>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const viewer = await requireUser();
  const { with: withHandle } = await searchParams;

  // No target → friend picker.
  if (!withHandle) {
    const friends = await listFriends(viewer.id);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Compare</h1>
        <SectionLabel>Pick a friend</SectionLabel>
        {friends.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>Add a friend first to compare your progress.</span></Card>}
        {friends.map((f) =>
          f.publicHandle ? (
            <Link key={f.id} href={`/app/social/compare?with=${encodeURIComponent(f.publicHandle)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{f.displayName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>@{f.publicHandle}</div>
                </div>
                <Icon name="chevronR" size={18} stroke={1.8} />
              </Card>
            </Link>
          ) : null,
        )}
      </div>
    );
  }

  const friend = await prisma.user.findUnique({
    where: { publicHandle: withHandle },
    select: { id: true, displayName: true, publicHandle: true, status: true },
  });
  if (!friend || friend.status !== 'ACTIVE' || friend.id === viewer.id) {
    return <EmptyState message="That profile isn't available to compare." />;
  }
  if (!(await areFriends(viewer.id, friend.id))) {
    return <EmptyState message="You can only compare stats with friends." />;
  }

  const privacy = await getPrivacy(friend.id);
  if (!(await canView(viewer.id, friend.id, privacy.showStats))) {
    return <EmptyState message="This friend keeps their stats private." />;
  }

  const [me, them] = await Promise.all([getStatsBundle(viewer.id), getStatsBundle(friend.id)]);
  const METRICS = buildMetrics(viewer.unitSystem);
  const myName = viewer.publicHandle ? `@${viewer.publicHandle}` : viewer.displayName;
  const theirName = friend.publicHandle ? `@${friend.publicHandle}` : friend.displayName;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href={friend.publicHandle ? `/app/u/${friend.publicHandle}` : '/app/social'} style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← {theirName}</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Compare</h1>
      <Card pad={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, padding: 'var(--row) var(--pad)', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{myName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>vs</div>
          <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'left' }}>{theirName}</div>
        </div>
        {METRICS.map((m, i) => {
          const a = m.value(me);
          const b = m.value(them);
          const meLeads = a > b;
          const themLead = b > a;
          const cell = (lead: boolean): CSSProperties => ({
            fontSize: 16,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 'var(--r-sm)',
            background: lead ? 'var(--accent-soft)' : 'transparent',
            color: lead ? 'var(--accent-text)' : 'var(--text)',
          });
          return (
            <div key={m.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, padding: 'var(--row) var(--pad)', borderTop: i ? '1px solid var(--line)' : 'none', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Mono style={cell(meLeads)}>{m.format(a)}</Mono>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', minWidth: 80 }}>{m.label}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Mono style={cell(themLead)}>{m.format(b)}</Mono>
              </div>
            </div>
          );
        })}
      </Card>
      <SectionLabel style={{ textAlign: 'center', color: 'var(--text-3)' }}>Friendly progress, not a contest.</SectionLabel>
    </div>
  );
}
