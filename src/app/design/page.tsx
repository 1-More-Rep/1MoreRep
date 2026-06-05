'use client';

import { useTheme } from '@/components/theme/ThemeProvider';
import { ACCENTS, ACCENT_NAMES, DENSITY, FONTS, type Density, type FontPairing } from '@/lib/theme/tokens';
import { Btn, Card, Chip, Divider, Icon, IconTile, ICON_NAMES, Mono, Ring, SectionLabel, WeekBars } from '@/components/ui';

const WEEK = [
  { d: 'M', v: 0.62 },
  { d: 'T', v: 0.9 },
  { d: 'W', v: 0.4, today: true },
  { d: 'T', v: 0 },
  { d: 'F', v: 0.72 },
  { d: 'S', v: 0.55 },
  { d: 'S', v: 0 },
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <SectionLabel style={{ marginBottom: 14 }}>{title}</SectionLabel>
      {children}
    </Card>
  );
}

export default function DesignSystemPage() {
  const { tweaks, setTweak, reset } = useTheme();
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bolt" size={21} stroke={2.1} />
        </span>
        <h1 data-testid="ds-title" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>
          Design System
        </h1>
      </header>

      {/* Live tweak controls — pre-stages the Appearance settings screen. */}
      <Card>
        <SectionLabel style={{ marginBottom: 14 }}>Tweaks</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
          <Btn
            kind="soft"
            size="sm"
            icon={tweaks.dark ? 'sun' : 'moon'}
            data-testid="toggle-dark"
            onClick={() => setTweak('mode', tweaks.dark ? 'light' : 'dark')}
          >
            {tweaks.dark ? 'Light' : 'Dark'}
          </Btn>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {ACCENTS.map((a) => (
              <button
                key={a}
                aria-label={ACCENT_NAMES[a]}
                aria-pressed={tweaks.accent === a}
                onClick={() => setTweak('accent', a)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 'var(--r-pill)',
                  background: a,
                  border: tweaks.accent === a ? '2px solid var(--text)' : '2px solid var(--line)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          <select aria-label="Font pairing" value={tweaks.font} onChange={(e) => setTweak('font', e.target.value as FontPairing)} style={selectStyle}>
            {(Object.keys(FONTS) as FontPairing[]).map((f) => (
              <option key={f} value={f}>{FONTS[f].label}</option>
            ))}
          </select>

          <select aria-label="Density" value={tweaks.density} onChange={(e) => setTweak('density', e.target.value as Density)} style={selectStyle}>
            {(Object.keys(DENSITY) as Density[]).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
            radius
            <input type="range" min={4} max={24} value={tweaks.radius} onChange={(e) => setTweak('radius', Number(e.target.value))} />
            <Mono style={{ fontSize: 12 }}>{tweaks.radius}px</Mono>
          </label>

          <Btn kind="ghost" size="sm" icon="repeat" onClick={reset}>Reset</Btn>
        </div>
      </Card>

      <Group title="Buttons">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Btn kind="primary" icon="play">Primary</Btn>
          <Btn kind="soft" icon="check">Soft</Btn>
          <Btn kind="ghost" icon="plus">Ghost</Btn>
          <Btn kind="primary" size="sm">Small</Btn>
          <Btn kind="primary" size="lg" icon="bolt">Large</Btn>
          <Btn kind="primary" disabled>Disabled</Btn>
        </div>
      </Group>

      <Group title="Chips & labels">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Chip>Chest</Chip>
          <Chip>Shoulders</Chip>
          <Chip accent>
            <Icon name="flame" size={13} stroke={2} /> 6 day streak
          </Chip>
          <Chip accent>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--accent)' }} />
            <Mono>52:30</Mono>
          </Chip>
        </div>
      </Group>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--gap)' }}>
        <Group title="Progress ring">
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Ring pct={0.72} size={110}>
              <Mono style={{ fontSize: 24, fontWeight: 700 }}>72</Mono>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>percent</span>
            </Ring>
            <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Consistency this week</div>
          </div>
        </Group>
        <Group title="Week activity">
          <WeekBars data={WEEK} height={96} />
        </Group>
      </div>

      <Group title="Numbers (mono, tabular)">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><Mono style={{ fontSize: 28, fontWeight: 700 }}>12.4k</Mono><div style={{ fontSize: 12, color: 'var(--text-3)' }}>kg lifted</div></div>
          <div><Mono style={{ fontSize: 28, fontWeight: 700 }}>4 × 8</Mono><div style={{ fontSize: 12, color: 'var(--text-3)' }}>scheme</div></div>
          <div><Mono style={{ fontSize: 28, fontWeight: 700 }}>70 kg</Mono><div style={{ fontSize: 12, color: 'var(--text-3)' }}>load</div></div>
        </div>
      </Group>

      <Group title="Cards">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
          <Card>Default surface card</Card>
          <Card soft>Soft surface-2 card</Card>
        </div>
        <Divider style={{ margin: '16px 0' }} />
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Divider above.</span>
      </Group>

      <Group title="Icon tiles">
        <div style={{ display: 'flex', gap: 12 }}>
          {(['line', 'soft', 'solid'] as const).map((v) => (
            <div key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <IconTile name="dumbbell" variant={v} active />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{v}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title={`Icons (${ICON_NAMES.length})`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 10 }}>
          {ICON_NAMES.map((n) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8, color: 'var(--text-2)' }}>
              <Icon name={n} size={22} />
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{n}</span>
            </div>
          ))}
        </div>
      </Group>
    </main>
  );
}

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: '0 10px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
};
