'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildVars, DEFAULT_TWEAKS, type ThemeTweaks } from '@/lib/theme/tokens';

export const THEME_STORAGE_KEY = '1mr-theme';

interface ThemeContextValue {
  tweaks: ThemeTweaks;
  setTweak: <K extends keyof ThemeTweaks>(key: K, value: ThemeTweaks[K]) => void;
  setTweaks: (next: Partial<ThemeTweaks>) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Apply a tweak set to the document root (CSS vars + data-theme + icon style). */
export function applyTweaks(tweaks: ThemeTweaks, root: HTMLElement = document.documentElement) {
  const vars = buildVars(tweaks);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.setAttribute('data-theme', tweaks.dark ? 'dark' : 'light');
  root.setAttribute('data-icon-style', tweaks.iconStyle);
}

function readStored(): ThemeTweaks {
  if (typeof window === 'undefined') return DEFAULT_TWEAKS;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_TWEAKS;
    return { ...DEFAULT_TWEAKS, ...(JSON.parse(raw) as Partial<ThemeTweaks>) };
  } catch {
    return DEFAULT_TWEAKS;
  }
}

export function ThemeProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<ThemeTweaks>;
}) {
  const [tweaks, setState] = useState<ThemeTweaks>({ ...DEFAULT_TWEAKS, ...initial });

  // Hydrate from localStorage on mount (server can't know per-user prefs yet; in
  // later phases the user's saved appearance settings seed `initial`).
  useEffect(() => {
    setState(readStored());
  }, []);

  // Persist + apply whenever tweaks change.
  useEffect(() => {
    applyTweaks(tweaks);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      /* ignore quota/private-mode errors */
    }
  }, [tweaks]);

  const setTweak = useCallback<ThemeContextValue['setTweak']>((key, value) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);
  const setTweaks = useCallback((next: Partial<ThemeTweaks>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);
  const reset = useCallback(() => setState(DEFAULT_TWEAKS), []);

  const value = useMemo(() => ({ tweaks, setTweak, setTweaks, reset }), [tweaks, setTweak, setTweaks, reset]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

/**
 * Inline, render-blocking script that applies the stored theme before paint to
 * avoid a flash of the default theme. Injected once in the root layout.
 */
export const themeBootScript = `
(function(){
  try {
    var raw = localStorage.getItem('${THEME_STORAGE_KEY}');
    if(!raw) return;
    var t = JSON.parse(raw);
    var r = document.documentElement, s = r.style;
    if (t && typeof t.dark === 'boolean') r.setAttribute('data-theme', t.dark ? 'dark' : 'light');
    if (t && t.iconStyle) r.setAttribute('data-icon-style', t.iconStyle);
    if (t && t.accent) {
      s.setProperty('--accent', t.accent);
      // light-mode accent-text must match buildVars (color-mix 58% #000), not raw accent.
      s.setProperty('--accent-text', t.dark ? 'color-mix(in oklab, '+t.accent+' 78%, white)' : 'color-mix(in oklab, '+t.accent+' 58%, #000)');
    }
    if (t && typeof t.radius === 'number') {
      var rad = Math.round(t.radius);
      s.setProperty('--r', rad+'px');
      s.setProperty('--r-lg', (rad+6)+'px');
      s.setProperty('--r-sm', Math.max(4, rad-6)+'px');
      s.setProperty('--r-xs', Math.max(3, Math.round(rad/2.2))+'px');
    }
    var DENS = { compact:{pad:14,gap:10,screen:18,row:11}, regular:{pad:18,gap:14,screen:22,row:14}, comfy:{pad:24,gap:18,screen:28,row:18} };
    var d = DENS[(t && t.density)] || DENS.regular;
    s.setProperty('--pad', d.pad+'px'); s.setProperty('--gap', d.gap+'px'); s.setProperty('--screen-pad', d.screen+'px'); s.setProperty('--row', d.row+'px');
    var FONTS = { calm:['var(--font-hanken)','var(--font-jetbrains-mono)'], techy:['var(--font-space-grotesk)','var(--font-space-mono)'], friendly:['var(--font-manrope)','var(--font-ibm-plex-mono)'] };
    var f = FONTS[(t && t.font)] || FONTS.friendly;
    s.setProperty('--font-sans', f[0]+", ui-sans-serif, system-ui, sans-serif");
    s.setProperty('--font-mono', f[1]+", ui-monospace, 'SF Mono', monospace");
  } catch(e){}
})();
`;
