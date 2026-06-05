import type { ReactNode } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileTabBar } from './MobileTabBar';
import { MobileHeader } from './MobileHeader';
import styles from './AppShell.module.css';

/**
 * Responsive app chrome: desktop sidebar (>=880px) or mobile header + bottom tab
 * bar. All nav variants are always rendered; CSS shows the right one per
 * breakpoint (avoids layout shift / JS-dependent nav).
 */
export function AppShell({
  children,
  isAdmin = false,
  brandName,
}: {
  children: ReactNode;
  isAdmin?: boolean;
  brandName?: string;
}) {
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>Skip to content</a>
      <div className={styles.sidebar}>
        <DesktopSidebar isAdmin={isAdmin} />
      </div>
      <div className={styles.main}>
        <div className={styles.mobileHeader}>
          <MobileHeader brandName={brandName} />
        </div>
        <main id="main" className={styles.content}>{children}</main>
        <div className={styles.tabbar}>
          <MobileTabBar />
        </div>
      </div>
    </div>
  );
}
