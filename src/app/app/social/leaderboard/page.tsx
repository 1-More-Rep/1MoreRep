import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { getBoard, type BoardKey } from '@/server/queries/gamification';
import { Card, Mono, SectionLabel } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TABS: { board: BoardKey; label: string; unit: string; window: string }[] = [
  { board: 'WEEKLY_XP', label: 'Weekly XP', unit: 'XP', window: 'this week' },
  { board: 'ALLTIME_XP', label: 'XP', unit: 'XP', window: 'all-time' },
  { board: 'STREAK', label: 'Streak', unit: 'days', window: 'all-time' },
  { board: 'VOLUME', label: 'Volume', unit: 'kg·reps', window: 'all-time' },
  { board: 'PR', label: 'PRs', unit: 'records', window: 'all-time' },
];

function Row({ rank, name, value, isSelf, unit, pinned }: { rank: number; name: string; value: number; isSelf: boolean; unit: string; pinned?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px var(--pad)', borderTop: '1px solid var(--line)', background: isSelf ? 'var(--accent-soft)' : 'transparent' }}>
      <Mono style={{ width: 36, color: rank <= 3 ? 'var(--accent-text)' : 'var(--text-3)', fontWeight: 700 }}>{rank}</Mono>
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: isSelf ? 700 : 500 }}>{name}{isSelf ? ' (you)' : ''}{pinned ? ' · your rank' : ''}</span>
      <Mono style={{ fontWeight: 600 }}>{value.toLocaleString()}</Mono>
      <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{unit}</span>
    </div>
  );
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.board === sp.board) ?? TABS[0]!;
  const { rows, self } = await getBoard(tab.board, user.id, 50);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Leaderboards</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <Link
            key={t.board}
            href={`/app/social/leaderboard?board=${t.board}`}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--r-pill)',
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: 'none',
              background: t.board === tab.board ? 'var(--accent-strong)' : 'var(--surface-2)',
              color: t.board === tab.board ? 'var(--on-accent)' : 'var(--text-2)',
              border: `1px solid ${t.board === tab.board ? 'transparent' : 'var(--line)'}`,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <SectionLabel>{tab.label} · {tab.window}</SectionLabel>
      <Card pad={false}>
        {rows.length === 0 && <div style={{ padding: 'var(--pad)', color: 'var(--text-3)' }}>No data yet — log some workouts!</div>}
        {rows.map((r) => (
          <Row key={r.rank} rank={r.rank} name={r.name} value={r.value} isSelf={r.isSelf} unit={tab.unit} />
        ))}
        {self && (
          <>
            <div style={{ padding: '4px var(--pad)', borderTop: '1px dashed var(--line-2)', textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>⋯</div>
            <Row rank={self.rank} name={user.publicHandle ?? user.displayName} value={self.value} isSelf unit={tab.unit} pinned />
          </>
        )}
      </Card>
    </div>
  );
}
