import type { ReactNode } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileTabBar } from './MobileTabBar';
import styles from './AppShell.module.css';

/**
 * Responsive app chrome: desktop sidebar (>=880px) or mobile bottom tab bar.
 * Both nav variants are always rendered; CSS shows the right one per breakpoint
 * (avoids layout shift / JS-dependent nav).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.sidebar}>
        <DesktopSidebar />
      </div>
      <div className={styles.main}>
        <div className={styles.content}>{children}</div>
        <div className={styles.tabbar}>
          <MobileTabBar />
        </div>
      </div>
    </div>
  );
}
