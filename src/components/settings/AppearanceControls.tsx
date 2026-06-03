'use client';

import { useTheme } from '@/components/theme/ThemeProvider';
import { ACCENTS, ACCENT_NAMES, DENSITY, FONTS, type Density, type FontPairing } from '@/lib/theme/tokens';
import { Btn, Card, Mono, SectionLabel } from '@/components/ui';

const selectStyle: React.CSSProperties = {
  height: 40,
  padding: '0 10px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--line-2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
};

export function AppearanceControls() {
  const { tweaks, setTweak, reset } = useTheme();
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <SectionLabel style={{ marginBottom: 10 }}>Theme</SectionLabel>
        <Btn kind="soft" size="sm" icon={tweaks.dark ? 'sun' : 'moon'} onClick={() => setTweak('dark', !tweaks.dark)}>
          {tweaks.dark ? 'Switch to light' : 'Switch to dark'}
        </Btn>
      </div>

      <div>
        <SectionLabel style={{ marginBottom: 10 }}>Accent</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {ACCENTS.map((a) => (
            <button
              key={a}
              aria-label={ACCENT_NAMES[a]}
              aria-pressed={tweaks.accent === a}
              onClick={() => setTweak('accent', a)}
              style={{ width: 30, height: 30, borderRadius: 'var(--r-pill)', background: a, border: tweaks.accent === a ? '2px solid var(--text)' : '2px solid var(--line)', cursor: 'pointer' }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel>Font</SectionLabel>
          <select aria-label="Font pairing" value={tweaks.font} onChange={(e) => setTweak('font', e.target.value as FontPairing)} style={selectStyle}>
            {(Object.keys(FONTS) as FontPairing[]).map((f) => (
              <option key={f} value={f}>{FONTS[f].label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel>Density</SectionLabel>
          <select aria-label="Density" value={tweaks.density} onChange={(e) => setTweak('density', e.target.value as Density)} style={selectStyle}>
            {(Object.keys(DENSITY) as Density[]).map((dn) => (
              <option key={dn} value={dn}>{dn}</option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
        <SectionLabel>Corner radius</SectionLabel>
        <input type="range" min={4} max={24} value={tweaks.radius} onChange={(e) => setTweak('radius', Number(e.target.value))} aria-label="Corner radius" />
        <Mono>{tweaks.radius}px</Mono>
      </label>

      <Btn kind="ghost" size="sm" icon="repeat" onClick={reset} style={{ alignSelf: 'flex-start' }}>Reset to defaults</Btn>
    </Card>
  );
}
