'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/components/theme/ThemeProvider';
import { saveAppearanceAction } from '@/server/actions/appearance';
import { ACCENTS, ACCENT_NAMES, DENSITY, FONTS, type Density, type FontPairing, type ThemeMode } from '@/lib/theme/tokens';
import { Btn, Card, Mono, SectionLabel, Segmented } from '@/components/ui';

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
  const t = useTranslations('appearance');
  const tp = useTranslations('settingsPages');
  const { tweaks, setTweak, reset } = useTheme();
  const firstRun = useRef(true);

  // Persist tweaks to the account (debounced) so they follow the user across devices.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      void saveAppearanceAction({ ...tweaks } as Record<string, unknown>).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [tweaks]);

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <SectionLabel style={{ marginBottom: 10 }}>{t('theme')}</SectionLabel>
        <Segmented<ThemeMode>
          ariaLabel={tp('colorThemeAria')}
          value={tweaks.mode}
          onChange={(m) => setTweak('mode', m)}
          options={[
            { value: 'system', label: t('system'), icon: 'monitor' },
            { value: 'light', label: t('light'), icon: 'sun' },
            { value: 'dark', label: t('dark'), icon: 'moon' },
          ]}
        />
      </div>

      <div>
        <SectionLabel style={{ marginBottom: 10 }}>{t('accent')}</SectionLabel>
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
          <SectionLabel>{t('font')}</SectionLabel>
          <select aria-label={tp('fontPairingAria')} value={tweaks.font} onChange={(e) => setTweak('font', e.target.value as FontPairing)} style={selectStyle}>
            {(Object.keys(FONTS) as FontPairing[]).map((f) => (
              <option key={f} value={f}>{FONTS[f].label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SectionLabel>{t('density')}</SectionLabel>
          <select aria-label={t('density')} value={tweaks.density} onChange={(e) => setTweak('density', e.target.value as Density)} style={selectStyle}>
            {(Object.keys(DENSITY) as Density[]).map((dn) => (
              <option key={dn} value={dn}>{dn}</option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
        <SectionLabel>{t('cornerRadius')}</SectionLabel>
        <input type="range" min={4} max={24} value={tweaks.radius} onChange={(e) => setTweak('radius', Number(e.target.value))} aria-label={t('cornerRadius')} />
        <Mono>{tweaks.radius}px</Mono>
      </label>

      <Btn kind="ghost" size="sm" icon="repeat" onClick={reset} style={{ alignSelf: 'flex-start' }}>{t('reset')}</Btn>
    </Card>
  );
}
