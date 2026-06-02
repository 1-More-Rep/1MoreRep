import { describe, it, expect } from 'vitest';
import { buildVars, DEFAULT_TWEAKS } from './tokens';

describe('buildVars', () => {
  it('produces light palette by default', () => {
    const v = buildVars(DEFAULT_TWEAKS);
    expect(v['--bg']).toBe('#f1eee6');
    expect(v['--surface']).toBe('#fbfaf6');
    expect(v['--accent']).toBe('#e2553a');
    expect(v['--accent-text']).toBe('#e2553a'); // light: accent-text == accent
  });

  it('switches to dark palette', () => {
    const v = buildVars({ ...DEFAULT_TWEAKS, dark: true });
    expect(v['--bg']).toBe('#141310');
    expect(v['--surface']).toBe('#1d1b16');
    expect(v['--accent-text']).toContain('color-mix'); // dark lightens the accent
  });

  it('derives radius scale from --r', () => {
    const v = buildVars({ ...DEFAULT_TWEAKS, radius: 16 });
    expect(v['--r']).toBe('16px');
    expect(v['--r-lg']).toBe('22px');
    expect(v['--r-sm']).toBe('10px');
  });

  it('applies density spacing', () => {
    expect(buildVars({ ...DEFAULT_TWEAKS, density: 'compact' })['--pad']).toBe('14px');
    expect(buildVars({ ...DEFAULT_TWEAKS, density: 'comfy' })['--pad']).toBe('24px');
  });

  it('selects font pairing variables', () => {
    expect(buildVars({ ...DEFAULT_TWEAKS, font: 'techy' })['--font-sans']).toContain('--font-space-grotesk');
    expect(buildVars({ ...DEFAULT_TWEAKS, font: 'calm' })['--font-mono']).toContain('--font-jetbrains-mono');
  });
});
