import { Card, Chip, Mono, SectionLabel, Ring, WeekBars } from '@/components/ui';

// P1 placeholder Today. The real data-driven Today dashboard lands in P5/P8.
export default function TodayPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div>
        <SectionLabel style={{ marginBottom: 7 }}>Tuesday, June 2</SectionLabel>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.05, margin: 0 }}>
          Good morning
        </h1>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionLabel>Today&apos;s session</SectionLabel>
          <Chip accent>Push Day</Chip>
        </div>
        <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-.015em' }}>Chest · Shoulders · Triceps</div>
        <div style={{ display: 'flex', gap: 'var(--gap)', marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <Mono style={{ fontSize: 19, fontWeight: 700 }}>6</Mono>
            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>exercises</span>
          </div>
          <div style={{ width: 1, background: 'var(--line)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <Mono style={{ fontSize: 19, fontWeight: 700 }}>18</Mono>
            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>sets</span>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Ring pct={0.6} size={84} stroke={9}>
            <Mono style={{ fontSize: 20, fontWeight: 700 }}>6</Mono>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>days</span>
          </Ring>
          <div>
            <SectionLabel>Streak</SectionLabel>
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 4 }}>Keep it going</div>
          </div>
        </Card>
        <Card>
          <SectionLabel style={{ marginBottom: 14 }}>This week</SectionLabel>
          <WeekBars
            data={[
              { d: 'M', v: 0.62 },
              { d: 'T', v: 0, today: true },
              { d: 'W', v: 0 },
              { d: 'T', v: 0 },
              { d: 'F', v: 0 },
              { d: 'S', v: 0 },
              { d: 'S', v: 0 },
            ]}
            height={80}
          />
        </Card>
      </div>
    </div>
  );
}
