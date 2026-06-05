import type { ReactNode } from 'react';
import { IconTile, type IconName } from './Icon';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  subtitle?: ReactNode;
  /** Primary call-to-action rendered below the copy (e.g. a <Btn href>). */
  action?: ReactNode;
}

/** Friendly empty state: tiled icon + title + subtext + optional CTA. */
export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 10,
        padding: '34px 18px',
      }}
    >
      <IconTile name={icon} variant="soft" size={52} icon={26} active />
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-3)', maxWidth: 320 }}>{subtitle}</div>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
