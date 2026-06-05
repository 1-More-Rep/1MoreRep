'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildVars, DEFAULT_TWEAKS, resolveDark, type ThemeMode, type ThemeTweaks } from '@/lib/theme/tokens';

export const THEME_STORAGE_KEY = '1mr-theme';

interface ThemeContextValue {
  tweaks: ThemeTweaks;
  setTweak: <K extends keyof ThemeTweaks>(key: K, value: ThemeTweaks[K]) => void;
  setTweaks: (next: Partial<ThemeTweaks>) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** True when the OS prefers dark; defaults to DARK when it can't be determined. */
function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

/** Apply a tweak set to the document root (CSS vars + data-theme + color-scheme + icon style). */
export function applyTweaks(tweaks: ThemeTweaks, root: HTMLElement = document.documentElement) {
  const vars = buildVars(tweaks);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.setAttribute('data-theme', tweaks.dark ? 'dark' : 'light');
  root.style.colorScheme = tweaks.dark ? 'dark' : 'light';
  root.setAttribute('data-icon-style', tweaks.iconStyle);
}

/** Migrate a persisted tweak set: back-fill `mode` from a legacy `dark` boolean. */
function normalize(raw: Partial<ThemeTweaks>): ThemeTweaks {
  const merged: ThemeTweaks = { ...DEFAULT_TWEAKS, ...raw };
  if (!raw.mode && typeof raw.dark === 'boolean') merged.mode = raw.dark ? 'dark' : 'light';
  merged.dark = resolveDark(merged.mode, systemPrefersDark());
  return merged;
}

function readStored(): ThemeTweaks {
  if (typeof window === 'undefined') return DEFAULT_TWEAKS;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return normalize({});
    return normalize(JSON.parse(raw) as Partial<ThemeTweaks>);
  } catch {
    return normalize({});
  }
}

export function ThemeProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<ThemeTweaks>;
}) {
  // Lazy-init from localStorage on the client (DEFAULT on the server). We do NOT
  // re-apply localStorage in a mount effect: AppearanceSync (a descendant) applies
  // the account-saved theme in its own mount effect, and child effects run before
  // this parent's — a parent setState(readStored()) here would clobber the account
  // value and break cross-device theming. The account is the source of truth.
  const [tweaks, setState] = useState<ThemeTweaks>(() =>
    typeof window === 'undefined' ? normalize({ ...initial }) : readStored(),
  );

  // Persist + apply whenever tweaks change.
  useEffect(() => {
    applyTweaks(tweaks);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      /* ignore quota/private-mode errors */
    }
  }, [tweaks]);

  // Live OS theme changes only matter while following the system.
  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const onChange = () =>
      setState((prev) => (prev.mode === 'system' ? { ...prev, dark: mql.matches } : prev));
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  // Setting `mode` must re-resolve the derived `dark`.
  const setTweak = useCallback<ThemeContextValue['setTweak']>((key, value) => {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'mode') next.dark = resolveDark(value as ThemeMode, systemPrefersDark());
      return next;
    });
  }, []);
  const setTweaks = useCallback((next: Partial<ThemeTweaks>) => {
    setState((prev) => {
      const merged = { ...prev, ...next };
      // When the mode is (re)set, the derived dark flag must be recomputed.
      if (next.mode !== undefined) merged.dark = resolveDark(merged.mode, systemPrefersDark());
      return merged;
    });
  }, []);
  const reset = useCallback(() => setState(normalize({})), []);

  const value = useMemo(() => ({ tweaks, setTweak, setTweaks, reset }), [tweaks, setTweak, setTweaks, reset]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

/**
 * Inline, render-blocking script that applies the stored (or system-resolved) theme
 * before first paint to avoid a flash. Injected once in the root layout. When no
 * preference is stored — or the stored mode is 'system' — it reads the OS preference,
 * defaulting to DARK if that can't be determined.
 */
export const themeBootScript = `
(function(){
  try {
    var r = document.documentElement, s = r.style;
    var raw = localStorage.getItem('${THEME_STORAGE_KEY}');
    var t = null; try { t = raw ? JSON.parse(raw) : null; } catch(e) {}
    var mode = (t && t.mode) ? t.mode : ((t && typeof t.dark === 'boolean') ? (t.dark ? 'dark' : 'light') : 'system');
    var dark;
    if (mode === 'dark') dark = true;
    else if (mode === 'light') dark = false;
    else { try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch(e){ dark = true; } }
    r.setAttribute('data-theme', dark ? 'dark' : 'light');
    s.colorScheme = dark ? 'dark' : 'light';
    if (t && t.iconStyle) r.setAttribute('data-icon-style', t.iconStyle);
    if (t && t.accent) {
      s.setProperty('--accent', t.accent);
      s.setProperty('--accent-text', dark ? 'color-mix(in oklab, '+t.accent+' 78%, white)' : 'color-mix(in oklab, '+t.accent+' 58%, #000)');
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
