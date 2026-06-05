'use client';

import { useTranslations } from 'next-intl';
import { logoutAction } from '@/server/actions/auth';
import { Icon } from '@/components/ui/Icon';

export function LogoutButton() {
  const t = useTranslations('auth');
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          width: '100%',
          padding: '10px 12px',
          borderRadius: 'var(--r-sm)',
          border: '1px solid transparent',
          background: 'transparent',
          color: 'var(--text-3)',
          fontSize: 14.5,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
        }}
      >
        <Icon name="arrowR" size={19} stroke={1.8} />
        {t('logOut')}
      </button>
    </form>
  );
}
