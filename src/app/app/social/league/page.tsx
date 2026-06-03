import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { getLeagueBoard } from '@/server/queries/gamification';
import { Card, Chip, Mono, SectionLabel } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ZONE_COLOR: Record<string, string> = {
  promote: 'var(--accent-text)',
  relegate: 'var(--text-3)',
  hold: 'var(--text-2)',
};

export default async function LeaguePage() {
  const user = await requireUser();
  const board = await getLeagueBoard(user.id);

  if (!board) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>League</h1>
        <Card soft><span style={{ color: 'var(--text-3)' }}>Complete a workout this week to join a league.</span></Card>
      </div>
    );
  }

  const days = Math.max(0, Math.ceil((board.settlesAt.getTime() - Date.now()) / 86400000));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <Link href="/app/social" style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}>← Social</Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0, textTransform: 'capitalize' }}>{board.tier.toLowerCase()} league</h1>
        <Chip><Mono>{days}</Mono>&nbsp;day{days === 1 ? '' : 's'} left</Chip>
      </div>
      <SectionLabel>Top 7 promote · bottom 5 relegate</SectionLabel>

      <Card pad={false}>
        {board.rows.map((r, i) => (
          <div
            key={r.userId}
            data-testid={r.isSelf ? 'league-self-row' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px var(--pad)',
              borderTop: i ? '1px solid var(--line)' : 'none',
              background: r.isSelf ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <Mono style={{ width: 24, color: ZONE_COLOR[r.zone], fontWeight: 700 }}>{r.rank}</Mono>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: r.isSelf ? 700 : 500 }}>{r.name}{r.isSelf ? ' (you)' : ''}</span>
            {r.zone === 'promote' && <Chip accent>▲</Chip>}
            {r.zone === 'relegate' && <Chip>▼</Chip>}
            <Mono style={{ fontWeight: 600 }}>{r.weeklyXp}</Mono>
          </div>
        ))}
      </Card>
    </div>
  );
}
