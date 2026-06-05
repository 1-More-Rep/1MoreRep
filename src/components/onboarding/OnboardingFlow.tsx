'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { Equipment, ExperienceLevel, Goal, UnitSystem } from '@prisma/client';
import { completeOnboardingAction } from '@/server/actions/onboarding';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ACCENTS, ACCENT_NAMES } from '@/lib/theme/tokens';
import { Card, Btn, SectionLabel } from '@/components/ui';

const STORAGE_KEY = '1mr-onboarding';

// Stable i18n keys live here; labels/descriptions are resolved via t() at render.
const GOALS: { key: string; value: Goal }[] = [
  { key: 'goalHypertrophy', value: 'HYPERTROPHY' },
  { key: 'goalStrength', value: 'STRENGTH' },
  { key: 'goalEndurance', value: 'ENDURANCE' },
  { key: 'goalGeneral', value: 'GENERAL' },
];
const LEVELS: { key: string; value: ExperienceLevel; descKey: string }[] = [
  { key: 'levelBeginner', value: 'BEGINNER', descKey: 'levelBeginnerDesc' },
  { key: 'levelIntermediate', value: 'INTERMEDIATE', descKey: 'levelIntermediateDesc' },
  { key: 'levelAdvanced', value: 'ADVANCED', descKey: 'levelAdvancedDesc' },
];
const EQUIP: Equipment[] = ['BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND'];
// Equipment labels are sourced from a stable key per enum value.
const EQUIP_KEY: Record<Equipment, string> = {
  BARBELL: 'equipBarbell',
  DUMBBELL: 'equipDumbbell',
  MACHINE: 'equipMachine',
  CABLE: 'equipCable',
  BODYWEIGHT: 'equipBodyweight',
  KETTLEBELL: 'equipKettlebell',
  BAND: 'equipBand',
  EZ_BAR: 'equipEzBar',
  BALL: 'equipBall',
  OTHER: 'equipOther',
};
// Stable i18n keys for the wizard step names (order matters).
const STEP_KEYS = ['stepGoal', 'stepExperience', 'stepSchedule', 'stepAbout', 'stepTheme', 'stepFinish'];

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
  const t = useTranslations('onboarding');
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
  const go = (delta: number) => set('step', Math.max(0, Math.min(STEP_KEYS.length - 1, s.step + delta)));

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
        {STEP_KEYS.map((key, i) => (
          <div key={key} title={t(key)} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= s.step ? 'var(--accent)' : 'var(--line-2)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionLabel>{t('stepProgress', { current: s.step + 1, total: STEP_KEYS.length, name: t(STEP_KEYS[s.step] ?? 'stepGoal') })}</SectionLabel>
        {s.step < STEP_KEYS.length - 1 && (
          <button onClick={() => set('step', STEP_KEYS.length - 1)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer' }}>
            {t('skip')}
          </button>
        )}
      </div>

      {s.step === 0 && (
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>{t('goalQuestion')}</SectionLabel>
          {/* role=radio + aria-checked so the selection is exposed to AT, not conveyed by color alone. */}
          <div role="radiogroup" aria-label={t('goalGroupLabel')} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {GOALS.map((g) => (
              <button key={g.value} role="radio" aria-checked={s.goal === g.value} onClick={() => set('goal', g.value)} style={pillBtn(s.goal === g.value)}>{t(g.key)}</button>
            ))}
          </div>
        </Card>
      )}

      {s.step === 1 && (
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>{t('experienceTitle')}</SectionLabel>
          <div role="radiogroup" aria-label={t('experienceGroupLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LEVELS.map((l) => (
              <button key={l.value} role="radio" aria-checked={s.experience === l.value} onClick={() => set('experience', l.value)} style={pillBtn(s.experience === l.value)}>
                {t(l.key)}
                <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--text-3)', marginTop: 2 }}>{t(l.descKey)}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {s.step === 2 && (
        <>
          <Card>
            <SectionLabel style={{ marginBottom: 12 }}>{t('daysPerWeek')}</SectionLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Btn key={d} kind={s.trainingDays === d ? 'primary' : 'soft'} size="sm" onClick={() => set('trainingDays', d)}>{d}</Btn>
              ))}
            </div>
          </Card>
          <Card>
            <SectionLabel style={{ marginBottom: 12 }}>{t('equipmentTitle')}</SectionLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EQUIP.map((e) => (
                <Btn key={e} kind={s.equipment.includes(e) ? 'primary' : 'soft'} size="sm" onClick={() => toggleEquip(e)}>
                  {t(EQUIP_KEY[e])}
                </Btn>
              ))}
            </div>
          </Card>
        </>
      )}

      {s.step === 3 && (
        <>
          <Card>
            <SectionLabel style={{ marginBottom: 12 }}>{t('unitsTitle')}</SectionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind={s.unitSystem === 'METRIC' ? 'primary' : 'soft'} size="sm" onClick={() => set('unitSystem', 'METRIC')}>{t('unitMetric')}</Btn>
              <Btn kind={s.unitSystem === 'IMPERIAL' ? 'primary' : 'soft'} size="sm" onClick={() => set('unitSystem', 'IMPERIAL')}>{t('unitImperial')}</Btn>
            </div>
          </Card>
          <Card>
            <SectionLabel style={{ marginBottom: 12 }}>{t('bodyweightTitle')}</SectionLabel>
            <input
              type="number"
              inputMode="decimal"
              value={s.bodyweight}
              onChange={(e) => set('bodyweight', e.target.value)}
              placeholder={s.unitSystem === 'IMPERIAL' ? 'lb' : 'kg'}
              aria-label={t('bodyweightAria')}
              style={{ height: 46, width: '100%', padding: '0 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15 }}
            />
          </Card>
        </>
      )}

      {s.step === 4 && (
        <Card>
          <SectionLabel style={{ marginBottom: 12 }}>{t('themeTitle')}</SectionLabel>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Btn kind="soft" size="sm" icon={tweaks.dark ? 'sun' : 'moon'} onClick={() => setTweak('dark', !tweaks.dark)}>
              {tweaks.dark ? t('lightMode') : t('darkMode')}
            </Btn>
          </div>
          <SectionLabel style={{ marginBottom: 10 }}>{t('accent')}</SectionLabel>
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
          <SectionLabel style={{ marginBottom: 12 }}>{t('finishTitle')}</SectionLabel>
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7 }}>
            {t('summaryGoal')} <strong>{t(GOALS.find((g) => g.value === s.goal)?.key ?? 'goalHypertrophy')}</strong>
            <br />
            {t('summaryExperience')} <strong>{t(LEVELS.find((l) => l.value === s.experience)?.key ?? 'levelIntermediate')}</strong>
            <br />
            {t('summarySchedule')} <strong>{t('summaryDaysPerWeek', { count: s.trainingDays })}</strong>
            <br />
            {t('summaryEquipment')} <strong>{s.equipment.length ? s.equipment.map((e) => t(EQUIP_KEY[e])).join(', ') : t('summaryAny')}</strong>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {s.step > 0 && <Btn kind="ghost" size="lg" onClick={() => go(-1)} disabled={pending}>{t('back')}</Btn>}
        {s.step < STEP_KEYS.length - 1 ? (
          <Btn size="lg" full icon="arrowR" onClick={() => go(1)}>{t('continue')}</Btn>
        ) : (
          <Btn size="lg" full icon="bolt" disabled={pending} onClick={finish}>
            {pending ? t('settingUp') : t('generateFirstWorkout')}
          </Btn>
        )}
      </div>
    </div>
  );
}
