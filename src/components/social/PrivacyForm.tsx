'use client';

import { useActionState } from 'react';
import type { PrivacySettings } from '@prisma/client';
import { updatePrivacyAction, type SocialState } from '@/server/actions/social';
import { Btn } from '@/components/ui/Btn';
import { Alert } from '@/components/auth/ui';

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text)' }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

function VisibilitySelect({ name, label, defaultValue }: { name: string; label: string; defaultValue: PrivacySettings['showStats'] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      <select name={name} defaultValue={defaultValue} style={{ height: 46, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}>
        <option value="PUBLIC">Public</option>
        <option value="FRIENDS">Friends only</option>
        <option value="PRIVATE">Private</option>
      </select>
    </label>
  );
}

export function PrivacyForm({ p }: { p: PrivacySettings }) {
  const [state, action] = useActionState(updatePrivacyAction, {} as SocialState);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Alert kind="notice">{state.notice}</Alert>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Profile visibility</span>
        <select name="profileVisible" defaultValue={p.profileVisible} style={{ height: 46, padding: '0 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}>
          <option value="PUBLIC">Public</option>
          <option value="FRIENDS">Friends only</option>
          <option value="PRIVATE">Private</option>
        </select>
      </label>
      <VisibilitySelect name="showWorkouts" label="Who can see my workouts" defaultValue={p.showWorkouts} />
      <VisibilitySelect name="showStats" label="Who can see my stats" defaultValue={p.showStats} />
      <VisibilitySelect name="showPhotos" label="Who can see my progress photos" defaultValue={p.showPhotos} />
      <Toggle name="leaderboardOptIn" label="Show me on public leaderboards" defaultChecked={p.leaderboardOptIn} />
      <Toggle name="activityFeedOptIn" label="Share my activity with friends" defaultChecked={p.activityFeedOptIn} />
      <Toggle name="searchableByHandle" label="Let others find me by handle" defaultChecked={p.searchableByHandle} />
      <Btn type="submit" icon="check" style={{ alignSelf: 'flex-start' }}>Save privacy</Btn>
    </form>
  );
}
