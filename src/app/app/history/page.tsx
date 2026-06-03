import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { getHistory, sessionVolume, completedSetCount } from '@/server/queries/sessions';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Mono, SectionLabel } from '@/components/ui/typography';

export const dynamic = 'force-dynamic';

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtDur = (s: number | null) => (s == null ? '—' : `${Math.round(s / 60)}m`);

export default async function HistoryPage() {
  const user = await requireUser();
  const sessions = await getHistory(user.id, 60);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>History</h1>
      {sessions.length === 0 && <Card soft><span style={{ color: 'var(--text-3)' }}>No completed workouts yet.</span></Card>}
      {sessions.map((s) => (
        <Link key={s.id} href={`/app/history/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <SectionLabel>{s.completedAt ? fmtDate(s.completedAt) : ''}</SectionLabel>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>{s.name ?? 'Workout'}</div>
              </div>
              <Chip><Mono>{completedSetCount(s.entries)}</Mono>&nbsp;sets</Chip>
              <Chip><Mono>{sessionVolume(s.entries).toLocaleString()}</Mono>&nbsp;kg·reps</Chip>
              <Chip><Mono>{fmtDur(s.durationSec)}</Mono></Chip>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
