'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { Muscle } from '@prisma/client';
import { MUSCLE_LABEL } from '@/domain/muscles/taxonomy';
import type { Landmark } from '@/domain/generator/landmarks';
import { reportSorenessAction } from '@/server/actions/fatigue';
import { fatigueToTint } from '@/domain/fatigue/model';
import { MUSCLE_STANDARD, STRENGTH_TIERS } from '@/domain/strength/standards';
import type { MuscleStrength } from '@/server/services/strengthService';
import { BodyMap } from './BodyMap';
import { Card } from '@/components/ui/Card';
import { Btn } from '@/components/ui/Btn';
import { Segmented } from '@/components/ui/Segmented';
import { Mono, SectionLabel } from '@/components/ui/typography';

export interface MuscleInfo {
  fatigue: number;
  recoveryEtaHours: number;
  /** Trailing-7d fractional set volume (sets/week, by muscle weight). */
  weeklyVolume: number;
  /** MEV/MAV/MRV landmarks for this muscle. */
  landmarks: Landmark;
}

type Mode = 'recovery' | 'strength';

type T = ReturnType<typeof useTranslations>;

// Ordinal opacity ramp over the accent: more filled = stronger. No-data = flat.
const TIER_ALPHA = [0.1, 0.3, 0.5, 0.7, 0.88, 1.0];

function fatigueFill(f: number | undefined): string {
  const { cssVar, alpha } = fatigueToTint(f ?? 0);
  return `color-mix(in oklab, var(${cssVar}) ${Math.round(alpha * 100)}%, var(--surface-2))`;
}

function strengthFill(s: MuscleStrength | undefined): string {
  if (!s) return 'var(--surface-2)';
  return `color-mix(in oklab, var(--accent) ${Math.round(TIER_ALPHA[s.tierIndex]! * 100)}%, var(--surface-2))`;
}

function etaLabel(hours: number, t: T): string {
  if (hours <= 0) return t('fresh');
  if (hours < 1) return t('etaLessThanHour');
  if (hours < 48) return t('etaHours', { hours: Math.round(hours) });
  return t('etaDays', { days: Math.round(hours / 24) });
}

function volumeZone(v: number, lm: Landmark, t: T): { label: string; color: string } {
  if (v < lm.mev) return { label: t('belowMev'), color: 'var(--text-3)' };
  if (v < lm.mav) return { label: t('maintenance'), color: 'var(--accent-text)' };
  if (v <= lm.mrv) return { label: t('productive'), color: 'var(--accent)' };
  return { label: t('overMrv'), color: '#c0392b' };
}

/** Labeled 7-day set-volume bar with MEV / MAV / MRV thresholds. */
function VolumeBar({ volume, landmarks }: { volume: number; landmarks: Landmark }) {
  const t = useTranslations('muscles');
  const { mev, mav, mrv } = landmarks;
  const scaleMax = Math.max(mrv * 1.15, volume * 1.05, 1);
  const pct = (n: number) => `${Math.min(100, (n / scaleMax) * 100)}%`;
  const zone = volumeZone(volume, landmarks, t);
  const markers: { v: number; label: string }[] = [
    { v: mev, label: 'MEV' },
    { v: mav, label: 'MAV' },
    { v: mrv, label: 'MRV' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <SectionLabel>{t('volume7d')}</SectionLabel>
        <span style={{ fontSize: 12, fontWeight: 700, color: zone.color }}>{zone.label}</span>
      </div>
      <div style={{ position: 'relative', height: 14, background: 'var(--surface-2)', borderRadius: 99, border: '1px solid var(--line)' }}>
        <div style={{ position: 'absolute', inset: 0, width: pct(volume), background: zone.color, borderRadius: 99, opacity: 0.85, transition: 'width .2s' }} />
        {markers.map((m) => (
          <div key={m.label} aria-hidden="true" style={{ position: 'absolute', top: -2, bottom: -2, left: pct(m.v), width: 1.5, background: 'var(--text-2)', opacity: 0.55 }} />
        ))}
      </div>
      <div style={{ position: 'relative', height: 16, marginTop: 4 }}>
        {markers.map((m) => (
          <div key={m.label} style={{ position: 'absolute', left: pct(m.v), transform: 'translateX(-50%)', fontSize: 9.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
            {m.label} {m.v}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--text-3)' }}>
        {t.rich('setsThisWeek', {
          count: Number(volume.toFixed(1)),
          v: () => <Mono style={{ color: 'var(--text-2)', fontWeight: 700 }}>{volume.toFixed(1)}</Mono>,
        })}
      </div>
    </div>
  );
}

/** Compact legend: a Fresh→Fatigued gradient (recovery) or the six named tiers (strength). */
function Legend({ mode }: { mode: Mode }) {
  const t = useTranslations('muscles');
  const tTier = useTranslations('strengthTier');
  if (mode === 'recovery') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('fresh')}</span>
        <div style={{ height: 8, width: 120, borderRadius: 99, background: 'linear-gradient(90deg, color-mix(in oklab, var(--accent) 8%, var(--surface-2)), var(--accent))' }} />
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('fatigued')}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {STRENGTH_TIERS.map((tier, i) => (
        <span key={tier} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-3)' }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: `color-mix(in oklab, var(--accent) ${Math.round(TIER_ALPHA[i]! * 100)}%, var(--surface-2))`, border: '1px solid var(--line)' }} />
          {tTier(tier)}
        </span>
      ))}
    </div>
  );
}

export function MuscleOverview({
  data,
  strength,
  bodyweightKg,
  topExercises,
}: {
  data: Record<Muscle, MuscleInfo>;
  strength: Partial<Record<Muscle, MuscleStrength>>;
  bodyweightKg: number | null;
  topExercises: Record<string, { id: string; name: string }[]>;
}) {
  const t = useTranslations('muscles');
  const tTier = useTranslations('strengthTier');
  const [mode, setMode] = useState<Mode>('recovery');
  const [selected, setSelected] = useState<Muscle | null>(null);
  const [pending, start] = useTransition();

  const info = selected ? data[selected] : null;
  const str = selected ? strength[selected] : null;

  useEffect(() => {
    if (selected) document.getElementById('muscle-detail-card')?.focus();
  }, [selected]);

  const tint = (m: Muscle) => (mode === 'recovery' ? fatigueFill(data[m]?.fatigue) : strengthFill(strength[m]));
  const regionLabel = (m: Muscle) => {
    if (mode === 'recovery') {
      const eta = data[m]?.recoveryEtaHours ?? 0;
      const base = t('regionFatigued', { muscle: MUSCLE_LABEL[m], pct: Math.round((data[m]?.fatigue ?? 0) * 100) });
      return eta > 0 ? base + t('regionRecovers', { hours: Math.round(eta) }) : base;
    }
    const s = strength[m];
    return s
      ? t('regionStrength', { muscle: MUSCLE_LABEL[m], tier: tTier(s.tier) })
      : t('regionNoData', { muscle: MUSCLE_LABEL[m] });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--gap)' }}>
      <Segmented<Mode>
        ariaLabel={t('mapMode')}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setSelected(null);
        }}
        options={[
          { value: 'recovery', label: t('recovery'), icon: 'heart' },
          { value: 'strength', label: t('strength'), icon: 'trophy' },
        ]}
      />

      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BodyMap tint={tint} regionLabel={regionLabel} title={mode === 'recovery' ? t('muscleFatigue') : t('muscleStrength')} onSelect={setSelected} selected={selected} />
        <Legend mode={mode} />
      </Card>

      {selected ? (
        <Card data-testid="muscle-detail" id="muscle-detail-card" tabIndex={-1} role="region" aria-live="polite" aria-label={t('selectedMuscleDetail')} style={{ outline: 'none' }}>
          {mode === 'recovery' && info ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <SectionLabel>{t('selectedMuscle')}</SectionLabel>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{MUSCLE_LABEL[selected]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Mono style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-text)' }}>{Math.round(info.fatigue * 100)}%</Mono>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('fatigue')} · {t('recoversIn', { eta: etaLabel(info.recoveryEtaHours, t) })}</div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <VolumeBar volume={info.weeklyVolume} landmarks={info.landmarks} />
              </div>
              <div style={{ marginTop: 16 }}>
                <SectionLabel style={{ marginBottom: 8 }}>{t('howSore')}</SectionLabel>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[0, 2, 4, 6, 8, 10].map((s) => (
                    <Btn key={s} kind="soft" size="sm" disabled={pending} onClick={() => start(() => reportSorenessAction(selected, s))}>
                      {s === 0 ? t('none') : s}
                    </Btn>
                  ))}
                </div>
              </div>
              {topExercises[selected]?.length ? (
                <div style={{ marginTop: 16 }}>
                  <SectionLabel style={{ marginBottom: 8 }}>{t('trainIt')}</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {topExercises[selected].slice(0, 4).map((ex) => (
                      <a key={ex.id} href={`/app/exercises/${ex.id}`} style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none' }}>
                        {ex.name}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <StrengthDetail muscle={selected} str={str ?? undefined} bodyweightKg={bodyweightKg} topExercises={topExercises[selected]} />
          )}
        </Card>
      ) : (
        <Card soft>
          <span style={{ color: 'var(--text-3)' }}>
            {mode === 'recovery' ? t('tapRecovery') : t('tapStrength')}
          </span>
        </Card>
      )}
    </div>
  );
}

function StrengthDetail({
  muscle,
  str,
  bodyweightKg,
  topExercises,
}: {
  muscle: Muscle;
  str: MuscleStrength | undefined;
  bodyweightKg: number | null;
  topExercises?: { id: string; name: string }[];
}) {
  const t = useTranslations('muscles');
  const tTier = useTranslations('strengthTier');
  const standard = MUSCLE_STANDARD[muscle];

  if (!str) {
    return (
      <div>
        <SectionLabel>{t('selectedMuscle')}</SectionLabel>
        <div style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 10px' }}>{MUSCLE_LABEL[muscle]}</div>
        <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {!standard
            ? t('noStandard')
            : bodyweightKg == null
              ? t('needBodyweight', { movement: standard.movement })
              : t('needData', { movement: standard.movement })}
        </div>
        {topExercises?.length ? (
          <div style={{ marginTop: 14 }}>
            <SectionLabel style={{ marginBottom: 8 }}>{t('trainIt')}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {topExercises.slice(0, 4).map((ex) => (
                <a key={ex.id} href={`/app/exercises/${ex.id}`} style={{ fontSize: 14, color: 'var(--text-2)', textDecoration: 'none' }}>
                  {ex.name}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const atTop = str.nextThreshold == null;
  const nextTier = atTop ? null : STRENGTH_TIERS[str.tierIndex + 1];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <SectionLabel>{t('selectedMuscle')}</SectionLabel>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{MUSCLE_LABEL[muscle]}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-text)', letterSpacing: '-.01em' }}>{tTier(str.tier)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            <Mono>{str.relative.toFixed(2)}</Mono>{t('bodyweightMultiple')}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
        {t.rich('bestLift', {
          lift: str.bestLift,
          value: Math.round(str.best1RMkg),
          b: (chunks) => <strong>{chunks}</strong>,
          m: (chunks) => <Mono>{chunks}</Mono>,
        })}
      </div>

      {atTop ? (
        <div style={{ marginTop: 10, fontSize: 13.5, color: 'var(--accent-text)', fontWeight: 600 }}>
          {t('topTier')}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 13.5, color: 'var(--text-3)' }}>
          {t.rich('reachTier', {
            tier: nextTier ? tTier(nextTier) : '',
            threshold: str.nextThreshold!.toFixed(2),
            b: (chunks) => <strong style={{ color: 'var(--text-2)' }}>{chunks}</strong>,
            m: (chunks) => <Mono>{chunks}</Mono>,
          })}
          {bodyweightKg ? (
            <>{t.rich('reachTierKg', { kg: Math.round(str.nextThreshold! * bodyweightKg), m: (chunks) => <Mono>{chunks}</Mono> })}</>
          ) : (
            '.'
          )}
        </div>
      )}
    </div>
  );
}
