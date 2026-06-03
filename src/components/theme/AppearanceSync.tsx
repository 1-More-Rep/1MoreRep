'use client';

import { useEffect } from 'react';
import { useTheme, THEME_STORAGE_KEY } from '@/components/theme/ThemeProvider';
import type { ThemeTweaks } from '@/lib/theme/tokens';

/**
 * Seeds the account-saved appearance on a device that has no local preference yet
 * (e.g. a fresh login on another device), so theme tweaks follow the account.
 * A device with an existing local choice keeps it.
 */
export function AppearanceSync({ saved }: { saved: Partial<ThemeTweaks> | null }) {
  const { setTweaks } = useTheme();
  useEffect(() => {
    if (!saved) return;
    try {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) setTweaks(saved);
    } catch {
      /* ignore */
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
