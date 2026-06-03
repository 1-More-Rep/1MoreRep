import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { listBodyMetrics } from '@/server/services/bodyMetricService';
import { getHistory, sessionVolume } from '@/server/queries/sessions';
import { Card, Chip, Icon, SectionLabel } from '@/components/ui';
import { LineChart, type ChartPoint } from '@/components/charts/LineChart';
import { BodyMetricForm } from '@/components/progress/BodyMetricForm';

export const dynamic = 'force-dynamic';

const short = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default async function ProgressPage() {
  const user = await requireUser();
  const [metrics, history] = await Promise.all([listBodyMetrics(user.id), getHistory(user.id, 20)]);

  const bw: ChartPoint[] = metrics.filter((m) => m.bodyweightKg != null).map((m) => ({ label: short(m.recordedAt), value: Math.round((m.bodyweightKg ?? 0) * 10) / 10 }));
  const vol: ChartPoint[] = [...history].reverse().filter((s) => s.completedAt).map((s) => ({ label: short(s.completedAt!), value: sessionVolume(s.entries) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>Progress</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/app/progress/prs" style={{ textDecoration: 'none' }}><Chip><Icon name="trophy" size={13} /> PRs</Chip></Link>
          <Link href="/app/progress/photos" style={{ textDecoration: 'none' }}><Chip><Icon name="user" size={13} /> Photos</Chip></Link>
        </div>
      </div>

      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Bodyweight</SectionLabel>
        <LineChart points={bw} unit="kg" />
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 12 }}>Session volume</SectionLabel>
        <LineChart points={vol} unit="kg·reps" />
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>Log body metrics</SectionLabel>
        <BodyMetricForm />
      </Card>
    </div>
  );
}
