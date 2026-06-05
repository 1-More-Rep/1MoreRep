// Design tokens — TS port of the provided tokens.jsx.
// buildVars(t) -> CSS custom properties applied to a theme root.

export type Density = 'compact' | 'regular' | 'comfy';
export type FontPairing = 'calm' | 'techy' | 'friendly';
export type IconStyle = 'line' | 'soft' | 'solid';
/** User color-scheme preference. 'system' follows the OS (falling back to dark). */
export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeTweaks {
  /** The user's preference. The default is 'system'. */
  mode: ThemeMode;
  /** Resolved dark flag (derived from `mode` + the OS preference). buildVars reads this. */
  dark: boolean;
  accent: string;
  font: FontPairing;
  radius: number;
  density: Density;
  iconStyle: IconStyle;
}

/**
 * Resolve the effective dark flag from a mode and the OS preference.
 * 'system' follows the OS; when the OS preference can't be determined we fall
 * back to DARK (never light), per product requirement.
 */
export function resolveDark(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemPrefersDark;
}

export const ACCENTS = [
  '#e2553a', // ember (default) — warm red-orange
  '#2f6bff', // azure
  '#1ba672', // moss
  '#7c5cff', // iris
  '#c69a2e', // brass
] as const;

export const ACCENT_NAMES: Record<string, string> = {
  '#e2553a': 'Ember',
  '#2f6bff': 'Azure',
  '#1ba672': 'Moss',
  '#7c5cff': 'Iris',
  '#c69a2e': 'Brass',
};

// Each pairing maps to CSS variables that select among the fonts loaded in layout.tsx.
export const FONTS: Record<FontPairing, { sans: string; mono: string; label: string }> = {
  calm: { sans: 'var(--font-hanken)', mono: 'var(--font-jetbrains-mono)', label: 'Hanken · JetBrains' },
  techy: { sans: 'var(--font-space-grotesk)', mono: 'var(--font-space-mono)', label: 'Space Grotesk · Mono' },
  friendly: { sans: 'var(--font-manrope)', mono: 'var(--font-ibm-plex-mono)', label: 'Manrope · Plex' },
};

export const DENSITY: Record<Density, { pad: number; gap: number; screen: number; row: number }> = {
  compact: { pad: 14, gap: 10, screen: 18, row: 11 },
  regular: { pad: 18, gap: 14, screen: 22, row: 14 },
  comfy: { pad: 24, gap: 18, screen: 28, row: 18 },
};

const LIGHT = {
  bg: '#f1eee6',
  bg2: '#e8e4da',
  surface: '#fbfaf6',
  surface2: '#f3f1ea',
  text: '#211f19',
  text2: '#6c685c',
  text3: '#6d6960',
  line: '#e6e2d7',
  line2: '#dad5c8',
  onAccent: '#fffaf6',
  shadow: '0 1px 2px rgba(34,31,22,.05), 0 10px 30px rgba(34,31,22,.06)',
  shadowSm: '0 1px 2px rgba(34,31,22,.05)',
};

const DARK = {
  bg: '#141310',
  bg2: '#0e0d0a',
  surface: '#1d1b16',
  surface2: '#26231b',
  text: '#f3f0e6',
  text2: '#a7a191',
  text3: '#8f897a',
  line: '#2b2820',
  line2: '#39352a',
  onAccent: '#fffaf6',
  shadow: '0 1px 2px rgba(0,0,0,.32), 0 14px 34px rgba(0,0,0,.4)',
  shadowSm: '0 1px 2px rgba(0,0,0,.3)',
};

export const DEFAULT_TWEAKS: ThemeTweaks = {
  mode: 'system',
  dark: true, // safe fallback until the OS preference is resolved (never flash light)
  accent: '#e2553a',
  font: 'friendly',
  radius: 16,
  density: 'regular',
  iconStyle: 'soft',
};

/** Produce the CSS custom-property map for a given tweak set. */
export function buildVars(t: ThemeTweaks): Record<string, string> {
  const c = t.dark ? DARK : LIGHT;
  const d = DENSITY[t.density] ?? DENSITY.regular;
  const f = FONTS[t.font] ?? FONTS.friendly;
  const r = Math.round(t.radius);
  const accent = t.accent;
  return {
    '--accent': accent,
    '--accent-strong': `color-mix(in oklab, ${accent} 66%, #1a0a06)`,
    '--accent-soft': `color-mix(in oklab, ${accent} 14%, ${c.surface})`,
    '--accent-softer': `color-mix(in oklab, ${accent} 8%, ${c.surface})`,
    '--accent-line': `color-mix(in oklab, ${accent} 34%, ${c.surface})`,
    '--accent-text': t.dark ? `color-mix(in oklab, ${accent} 78%, white)` : `color-mix(in oklab, ${accent} 58%, #000)`,
    '--on-accent': c.onAccent,

    '--bg': c.bg,
    '--bg-2': c.bg2,
    '--surface': c.surface,
    '--surface-2': c.surface2,
    '--text': c.text,
    '--text-2': c.text2,
    '--text-3': c.text3,
    '--line': c.line,
    '--line-2': c.line2,
    '--shadow': c.shadow,
    '--shadow-sm': c.shadowSm,

    '--r': `${r}px`,
    '--r-lg': `${r + 6}px`,
    '--r-sm': `${Math.max(4, r - 6)}px`,
    '--r-xs': `${Math.max(3, Math.round(r / 2.2))}px`,
    '--r-pill': '999px',

    '--pad': `${d.pad}px`,
    '--gap': `${d.gap}px`,
    '--screen-pad': `${d.screen}px`,
    '--row': `${d.row}px`,

    '--font-sans': `${f.sans}, ui-sans-serif, system-ui, sans-serif`,
    '--font-mono': `${f.mono}, ui-monospace, 'SF Mono', monospace`,
  };
}
