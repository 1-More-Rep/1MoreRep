'use client';

import { useEffect, useState, useTransition } from 'react';
import type { Equipment, ExperienceLevel, Goal, UnitSystem } from '@prisma/client';
import { completeOnboardingAction } from '@/server/actions/onboarding';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ACCENTS, ACCENT_NAMES } from '@/lib/theme/tokens';
import { Card, Btn, SectionLabel } from '@/components/ui';

const STORAGE_KEY = '1mr-onboarding';

const GOALS: { label: string; value: Goal }[] = [
  { label: 'Build muscle', value: 'HYPERTROPHY' },
  { label: 'Get stronger', value: 'STRENGTH' },
  { label: 'Endurance', value: 'ENDURANCE' },
  { label: 'General health', value: 'GENERAL' },
];
const LEVELS: { label: string; value: ExperienceLevel; desc: string }[] = [
  { label: 'Beginner', value: 'BEGINNER', desc: 'New to lifting' },
  { label: 'Intermediate', value: 'INTERMEDIATE', desc: '6+ months consistent' },
  { label: 'Advanced', value: 'ADVANCED', desc: 'Years of training' },
];
const EQUIP: Equipment[] = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND'];

interface WizardState {
  step: number;
  goal: Goal;
  experience: ExperienceLevel;
  trainingDays: number;
  equipment: Equipment[];
  unitSystem: UnitSystem;
  bodyweight: string;
}

const DEFAULTS: WizardState = {
  step: 0,
  goal: 'HYPERTROPHY',
  experience: 'INTERMEDIATE',
  trainingDays: 3,
  equipment: [],
  unitSystem: 'METRIC',
  bodyweight: '',
};

const STEPS = ['Goal', 'Experience', 'Schedule', 'About you', 'Theme', 'Finish'];

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: '16px 12px',
  borderRadius: 'var(--r)',
  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-2)'}`,
  background: active ? 'var(--accent-soft)' : 'var(--surface)',
  color: active ? 'var(--accent-text)' : 'var(--text)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
});

export function OnboardingFlow() {
  const { tweaks, setTweak } = useTheme();
  const [s, setS] = useState<WizardState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [pending, start] = useTransition();

  // Resume mid-flow on reload.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setS({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<WizardState>) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        /* ignore */
      }
    }
  }, [s, hydrated]);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setS((p) => ({ ...p, [k]: v }));
  const go = (delta: number) => set('step', Math.max(0, Math.min(STEPS.length - 1, s.step + delta)));

  function finish() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const bwRaw = s.bodyweight ? Number(s.bodyweight) : null;
    const bodyweightKg = bwRaw != null && Number.isFinite(bwRaw) ? (s.unitSystem === 'IMPERIAL' ? bwRaw * 0.453592 : bwRaw) : null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    start(() =>
      completeOnboardingAction({
        timezone,
        unitSystem: s.unitSystem,
        goal: s.goal,
        experience: s.experience,
        trainingDays: s.trainingDays,
        equipment: s.equipment,
        bodyweightKg,
      }),
    );
  }

  function toggleEquip(e: Equipment) {
    set('equipment', s.equipment.includes(e) ? s.equipment.filter((x) => x !== e) : [...s.equipment, e]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      {/* progress */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {STEPS.map((label, i) => (
          <div key={label} title={label} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= s.step ? 'var(--accent)' : 'var(--line-2)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionLabel>{`Step ${s.step + 1} of ${STEPS.length} · ${STEPS[s.step]}`}</SectionLabel>
        {s.step < STEPS.length - 1 && (
          <button onClick={() => set('step', STEPS.length - 1)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer' }}>
            Skip
          </button>
        )}
      </div>

      {s.step === 0 && (
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>What&apos;s your main goal?</SectionLabel>
          {/* role=radio + aria-checked so the selection is exposed to AT, not conveyed by color alone. */}
          <div role="radiogroup" aria-label="Main goal" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {GOALS.map((g) => (
              <button key={g.value} role="radio" aria-checked={s.goal === g.value} onClick={() => set('goal', g.value)} style={pillBtn(s.goal === g.value)}>{g.label}</button>
            ))}
          </div>
        </Card>
      )}

      {s.step === 1 && (
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>Your experience</SectionLabel>
          <div role="radiogroup" aria-label="Experience level" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LEVELS.map((l) => (
              <button key={l.value} role="radio" aria-checked={s.experience === l.value} onClick={() => set('experience', l.value)} style={pillBtn(s.experience === l.value)}>
                {l.label}
                <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--text-3)', marginTop: 2 }}>{l.desc}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {s.step === 2 && (
        <>
          <Card>
            <SectionLabel style={{ marginBottom: 12 }}>Days per week</SectionLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Btn key={d} kind={s.trainingDays === d ? 'primary' : 'soft'} size="sm" onClick={() => set('trainingDays', d)}>{d}</Btn>
              ))}
            </div>
          </Card>
          <Card>
            <SectionLabel style={{ marginBottom: 12 }}>Available equipment (none = all)</SectionLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EQUIP.map((e) => (
                <Btn key={e} kind={s.equipment.includes(e) ? 'primary' : 'soft'} size="sm" onClick={() => toggleEquip(e)}>
                  {e.charAt(0) + e.slice(1).toLowerCase()}
                </Btn>
              ))}
            </div>
          </Card>
        </>
      )}

      {s.step === 3 && (
        <>
          <Card>
            <SectionLabel style={{ marginBottom: 12 }}>Units</SectionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind={s.unitSystem === 'METRIC' ? 'primary' : 'soft'} size="sm" onClick={() => set('unitSystem', 'METRIC')}>Metric (kg)</Btn>
              <Btn kind={s.unitSystem === 'IMPERIAL' ? 'primary' : 'soft'} size="sm" onClick={() => set('unitSystem', 'IMPERIAL')}>Imperial (lb)</Btn>
            </div>
          </Card>
          <Card>
            <SectionLabel style={{ marginBottom: 12 }}>Bodyweight (optional)</SectionLabel>
            <input
              type="number"
              inputMode="decimal"
              value={s.bodyweight}
              onChange={(e) => set('bodyweight', e.target.value)}
              placeholder={s.unitSystem === 'IMPERIAL' ? 'lb' : 'kg'}
              aria-label="Bodyweight"
              style={{ height: 46, width: '100%', padding: '0 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15 }}
            />
          </Card>
        </>
      )}

      {s.step === 4 && (
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>Make it yours</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Btn kind="soft" size="sm" icon={tweaks.dark ? 'sun' : 'moon'} onClick={() => setTweak('dark', !tweaks.dark)}>
              {tweaks.dark ? 'Light mode' : 'Dark mode'}
            </Btn>
          </div>
          <SectionLabel style={{ marginBottom: 10 }}>Accent</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {ACCENTS.map((a) => (
              <button
                key={a}
                aria-label={ACCENT_NAMES[a]}
                aria-pressed={tweaks.accent === a}
                onClick={() => setTweak('accent', a)}
                style={{ width: 32, height: 32, borderRadius: 'var(--r-pill)', background: a, border: tweaks.accent === a ? '2px solid var(--text)' : '2px solid var(--line)', cursor: 'pointer' }}
              />
            ))}
          </div>
        </Card>
      )}

      {s.step === 5 && (
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>You&apos;re all set</SectionLabel>
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
            Goal: <strong>{GOALS.find((g) => g.value === s.goal)?.label}</strong>
            <br />
            Experience: <strong>{LEVELS.find((l) => l.value === s.experience)?.label}</strong>
            <br />
            Schedule: <strong>{s.trainingDays} day{s.trainingDays === 1 ? '' : 's'}/week</strong>
            <br />
            Equipment: <strong>{s.equipment.length ? s.equipment.map((e) => e.charAt(0) + e.slice(1).toLowerCase()).join(', ') : 'Any'}</strong>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {s.step > 0 && <Btn kind="ghost" size="lg" onClick={() => go(-1)} disabled={pending}>Back</Btn>}
        {s.step < STEPS.length - 1 ? (
          <Btn size="lg" full icon="arrowR" onClick={() => go(1)}>Continue</Btn>
        ) : (
          <Btn size="lg" full icon="bolt" disabled={pending} onClick={finish}>
            {pending ? 'Setting up…' : 'Generate my first workout'}
          </Btn>
        )}
      </div>
    </div>
  );
}
