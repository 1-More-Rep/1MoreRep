import { describe, it, expect } from 'vitest';
import { buildVars, DEFAULT_TWEAKS, resolveDark } from './tokens';

describe('buildVars', () => {
  it('produces the light palette when dark is false', () => {
    const v = buildVars({ ...DEFAULT_TWEAKS, dark: false });
    expect(v['--bg']).toBe('#f1eee6');
    expect(v['--surface']).toBe('#fbfaf6');
    expect(v['--accent']).toBe('#e2553a');
    expect(v['--accent-text']).toContain('color-mix'); // light: darkened accent for AA-readable text
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

describe('resolveDark', () => {
  it('honors explicit light/dark regardless of the OS', () => {
    expect(resolveDark('light', true)).toBe(false);
    expect(resolveDark('light', false)).toBe(false);
    expect(resolveDark('dark', false)).toBe(true);
    expect(resolveDark('dark', true)).toBe(true);
  });

  it('follows the OS when mode is system', () => {
    expect(resolveDark('system', true)).toBe(true);
    expect(resolveDark('system', false)).toBe(false);
  });

  it('defaults to system mode (which falls back to dark when OS is unknown)', () => {
    expect(DEFAULT_TWEAKS.mode).toBe('system');
    // The provider passes `systemPrefersDark()` which returns true when matchMedia throws,
    // so an unknown OS preference resolves to dark — never light.
    expect(resolveDark(DEFAULT_TWEAKS.mode, true)).toBe(true);
  });
});
