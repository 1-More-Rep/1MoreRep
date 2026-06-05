import type { ReactNode } from 'react';
import { AppShell } from '@/components/nav/AppShell';
import { requireUser, hasRole } from '@/lib/auth/guards';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { AppearanceSync } from '@/components/theme/AppearanceSync';
import { NotificationPrompt } from '@/components/pwa/NotificationPrompt';
import { getSettings } from '@/lib/settings';
import type { ThemeTweaks } from '@/lib/theme/tokens';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(); // redirects to /login when unauthenticated
  const saved = (user.appearance as Partial<ThemeTweaks> | null) ?? null;
  const settings = await getSettings();
  return (
    <>
      <AppearanceSync saved={saved} />
      <ImpersonationBanner />
      <AppShell isAdmin={hasRole(user, 'ADMIN')} brandName={settings.brandName}>
        {children}
      </AppShell>
      <NotificationPrompt vapidPublicKey={settings.vapidPublicKey ?? null} userId={user.id} />
    </>
  );
}
