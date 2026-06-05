'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import type { PrivacySettings } from '@prisma/client';
import { updatePrivacyAction, type SocialState } from '@/server/actions/social';
import { Btn } from '@/components/ui/Btn';
import { Alert } from '@/components/auth/ui';

interface VisibilityLabels {
  public: string;
  friends: string;
  private: string;
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text)' }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

function VisibilitySelect({ name, label, defaultValue, options }: { name: string; label: string; defaultValue: PrivacySettings['showStats']; options: VisibilityLabels }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      <select name={name} defaultValue={defaultValue} style={{ height: 46, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}>
        <option value="PUBLIC">{options.public}</option>
        <option value="FRIENDS">{options.friends}</option>
        <option value="PRIVATE">{options.private}</option>
      </select>
    </label>
  );
}

export function PrivacyForm({ p }: { p: PrivacySettings }) {
  const t = useTranslations('social');
  const [state, action] = useActionState(updatePrivacyAction, {} as SocialState);
  const options: VisibilityLabels = { public: t('visibilityPublic'), friends: t('visibilityFriends'), private: t('visibilityPrivate') };
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Alert kind="notice">{state.notice}</Alert>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{t('privacyProfileVisibility')}</span>
        <select name="profileVisible" defaultValue={p.profileVisible} style={{ height: 46, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}>
          <option value="PUBLIC">{options.public}</option>
          <option value="FRIENDS">{options.friends}</option>
          <option value="PRIVATE">{options.private}</option>
        </select>
      </label>
      <VisibilitySelect name="showWorkouts" label={t('privacyShowWorkouts')} defaultValue={p.showWorkouts} options={options} />
      <VisibilitySelect name="showStats" label={t('privacyShowStats')} defaultValue={p.showStats} options={options} />
      <VisibilitySelect name="showPhotos" label={t('privacyShowPhotos')} defaultValue={p.showPhotos} options={options} />
      <Toggle name="leaderboardOptIn" label={t('privacyLeaderboardOptIn')} defaultChecked={p.leaderboardOptIn} />
      <Toggle name="activityFeedOptIn" label={t('privacyActivityFeedOptIn')} defaultChecked={p.activityFeedOptIn} />
      <Toggle name="searchableByHandle" label={t('privacySearchableByHandle')} defaultChecked={p.searchableByHandle} />
      <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>{t('privacySave')}</Btn>
    </form>
  );
}
