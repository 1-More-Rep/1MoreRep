import { getTranslations } from 'next-intl/server';
import { getImpersonation } from '@/lib/auth/guards';
import { StopImpersonatingButton } from './StopImpersonatingButton';

/**
 * Persistent banner shown while an admin is impersonating another user. Renders
 * nothing when not impersonating. Safe to mount in any server layout.
 */
export async function ImpersonationBanner() {
  const imp = await getImpersonation();
  if (!imp) return null;
  const t = await getTranslations('admin');
  return (
    <div
      role="status"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '8px 14px',
        background: '#a33',
        color: '#fff',
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      <span>
        {t('viewingAs')} <strong>{imp.user.displayName}</strong> {t('viewingAsEmail', { email: imp.user.email })}
      </span>
      <StopImpersonatingButton />
    </div>
  );
}
