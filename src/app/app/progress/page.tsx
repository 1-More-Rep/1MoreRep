import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { requireUser } from '@/lib/auth/guards';
import { exName } from '@/lib/i18n/exercise';
import { listBodyMetrics } from '@/server/services/bodyMetricService';
import { getHistory, sessionVolume } from '@/server/queries/sessions';
import { getExerciseSetHistory, getTopExerciseId, getExercise } from '@/server/queries/exercises';
import { Card, Chip, Icon, SectionLabel } from '@/components/ui';
import { type ChartPoint } from '@/components/charts/LineChart';
import { BodyMetricForm } from '@/components/progress/BodyMetricForm';
import { ProgressTabs, type MeasurementSeries } from '@/components/progress/ProgressTabs';
import { kgToLb, cmToIn, weightUnit, lengthUnit } from '@/domain/units';

export const dynamic = 'force-dynamic';

const short = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const round1 = (n: number) => Math.round(n * 10) / 10;

const MEASUREMENT_FIELDS: { key: string; labelKey: string }[] = [
  { key: 'chest', labelKey: 'fieldChest' },
  { key: 'waist', labelKey: 'fieldWaist' },
  { key: 'arms', labelKey: 'fieldArms' },
  { key: 'thighs', labelKey: 'fieldThighs' },
  { key: 'hips', labelKey: 'fieldHips' },
];

export default async function ProgressPage() {
  const t = await getTranslations('progress');
  const locale = await getLocale();
  const user = await requireUser();
  const [metrics, history, topExerciseId] = await Promise.all([
    listBodyMetrics(user.id),
    getHistory(user.id, 20),
    getTopExerciseId(user.id),
  ]);

  // All stored weights are canonical kg / cm — convert to the user's unit for display.
  const sys = user.unitSystem;
  const w = (kg: number) => (sys === 'IMPERIAL' ? kgToLb(kg) : kg); // also scales weight·reps volume
  const len = (cm: number) => (sys === 'IMPERIAL' ? cmToIn(cm) : cm);

  const bodyweight: ChartPoint[] = metrics
    .filter((m) => m.bodyweightKg != null)
    .map((m) => ({ label: short(m.recordedAt), value: round1(w(m.bodyweightKg ?? 0)) }));

  const volume: ChartPoint[] = [...history]
    .reverse()
    .filter((s) => s.completedAt)
    .map((s) => ({ label: short(s.completedAt!), value: round1(w(sessionVolume(s.entries))) }));

  // 1RM tab: est-1RM trend for the user's most-trained exercise.
  let oneRm: { exerciseName: string | null; points: ChartPoint[] } = { exerciseName: null, points: [] };
  if (topExerciseId) {
    const [ex, hist] = await Promise.all([getExercise(topExerciseId, user.id), getExerciseSetHistory(topExerciseId, user.id)]);
    oneRm = { exerciseName: ex ? exName(ex, locale) : null, points: hist.map((p) => ({ label: short(p.at), value: round1(w(p.est1RM)) })) };
  }

  // Measurements tab: one series per metric from the BodyMetric.measurements JSON.
  const measurements: MeasurementSeries[] = MEASUREMENT_FIELDS.map(({ key, labelKey }) => {
    const points: ChartPoint[] = [];
    for (const m of metrics) {
      const meas = (m.measurements ?? null) as Record<string, unknown> | null;
      const raw = meas?.[key];
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
      if (Number.isFinite(value)) points.push({ label: short(m.recordedAt), value: round1(len(value)) });
    }
    return { key, label: t(labelKey), points };
  }).filter((s) => s.points.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{t('title')}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/app/progress/prs" style={{ textDecoration: 'none' }}><Chip><Icon name="trophy" size={13} /> {t('prsChip')}</Chip></Link>
          <Link href="/app/progress/photos" style={{ textDecoration: 'none' }}><Chip><Icon name="user" size={13} /> {t('photosChip')}</Chip></Link>
        </div>
      </div>

      <Card>
        <ProgressTabs volume={volume} bodyweight={bodyweight} oneRm={oneRm} measurements={measurements} weightUnit={weightUnit(sys)} lengthUnit={lengthUnit(sys)} />
      </Card>

      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>{t('logBodyMetrics')}</SectionLabel>
        <BodyMetricForm unitSystem={sys} />
      </Card>
    </div>
  );
}
