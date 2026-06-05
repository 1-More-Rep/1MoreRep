'use client';

import { useEffect } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import type { ThemeTweaks } from '@/lib/theme/tokens';

/**
 * Account-first theme sync. The account-saved appearance is the source of truth and
 * is applied on every authenticated load, so the theme follows the user across
 * devices (the per-device localStorage value is only a fast cache, not the authority).
 */
export function AppearanceSync({ saved }: { saved: Partial<ThemeTweaks> | null }) {
  const { setTweaks } = useTheme();
  useEffect(() => {
    if (!saved || Object.keys(saved).length === 0) return;
    // Back-fill mode from a legacy `dark` boolean so old accounts resolve correctly.
    const next: Partial<ThemeTweaks> = { ...saved };
    if (next.mode === undefined && typeof next.dark === 'boolean') {
      next.mode = next.dark ? 'dark' : 'light';
    }
    setTweaks(next);
    // run once on mount with the server-provided account value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
