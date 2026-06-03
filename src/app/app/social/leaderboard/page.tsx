import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { getLeaderboard, type LeaderboardKind } from '@/server/queries/gamification';
import { Card, Chip, Mono, SectionLabel } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TABS: { kind: LeaderboardKind; label: string; unit: string }[] = [
  { kind: 'XP', label: 'XP', unit: 'XP' },
  { kind: 'STREAK', label: 'Streak', unit: 'days' },
  { kind: 'VOLUME', label: 'Volume', unit: 'kg·reps' },
];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kind = (TABS.find((t) => t.kind === sp.board)?.kind ?? 'XP') as LeaderboardKind;
  const rows = await getLeaderboard(kind, user.id, 50);
  const tab = TABS.find((t) => t.kind === kind)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Leaderboards</h1>

      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map((t) => (
          <Link
            key={t.kind}
            href={`/app/social/leaderboard?board=${t.kind}`}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--r-pill)',
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: 'none',
              background: t.kind === kind ? 'var(--accent)' : 'var(--surface-2)',
              color: t.kind === kind ? 'var(--on-accent)' : 'var(--text-2)',
              border: `1px solid ${t.kind === kind ? 'transparent' : 'var(--line)'}`,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <SectionLabel>{tab.label} · all-time</SectionLabel>
      <Card pad={false}>
        {rows.length === 0 && <div style={{ padding: 'var(--pad)', color: 'var(--text-3)' }}>No data yet.</div>}
        {rows.map((r, i) => (
          <div key={r.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px var(--pad)', borderTop: i ? '1px solid var(--line)' : 'none', background: r.isSelf ? 'var(--accent-soft)' : 'transparent' }}>
            <Mono style={{ width: 28, color: r.rank <= 3 ? 'var(--accent-text)' : 'var(--text-3)', fontWeight: 700 }}>{r.rank}</Mono>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: r.isSelf ? 700 : 500 }}>{r.name}{r.isSelf ? ' (you)' : ''}</span>
            <Mono style={{ fontWeight: 600 }}>{r.value.toLocaleString()}</Mono>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tab.unit}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
