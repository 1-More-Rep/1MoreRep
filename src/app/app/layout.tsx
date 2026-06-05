import type { ReactNode } from 'react';
import { AppShell } from '@/components/nav/AppShell';
import { requireUser, hasRole } from '@/lib/auth/guards';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { AppearanceSync } from '@/components/theme/AppearanceSync';
import { getSettings } from '@/lib/settings';
import type { ThemeTweaks } from '@/lib/theme/tokens';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(); // redirects to /login when unauthenticated
  const saved = (user.appearance as Partial<ThemeTweaks> | null) ?? null;
  const { brandName } = await getSettings();
  return (
    <>
      <AppearanceSync saved={saved} />
      <ImpersonationBanner />
      <AppShell isAdmin={hasRole(user, 'ADMIN')} brandName={brandName}>
        {children}
      </AppShell>
    </>
  );
}
