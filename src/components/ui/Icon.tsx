import type { CSSProperties, JSX } from 'react';
import type { IconStyle } from '@/lib/theme/tokens';

// Geometric single-weight line icons (ported from icons.jsx). currentColor stroke.
const ICON_PATHS = {
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V20h12v-9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6" />
      <path d="M7 12h10" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M3.5 4v3h3" />
      <path d="M12 8.5V12l2.5 1.6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16.5v-4M12.5 16.5V8M17 16.5v-6.5" />
    </>
  ),
  flame: (
    <path d="M12 3.5c.6 3-1.8 4-1.8 6.2 0 1 .6 1.8 1.4 2 0-1.2.8-2 .8-2 .8 1 2 2 2 4a4.4 4.4 0 0 1-8.8 0c0-3.6 4.4-4.8 6.4-10.2Z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M8 5.5 18 12 8 18.5V5.5Z" />,
  check: <path d="M5 12.5 10 17l9-10" />,
  chevronR: <path d="M9 5l7 7-7 7" />,
  chevronD: <path d="M5 9l7 7 7-7" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20c.6-3.6 3.5-5.5 7-5.5s6.4 1.9 7 5.5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5M9.5 2.5h5M12 6.5v0" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4.5V7A2.5 2.5 0 0 0 7 9.5M17 5.5h2.5V7A2.5 2.5 0 0 1 17 9.5" />
      <path d="M12 13v3M9 20h6M10 20l.5-4h3l.5 4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" />
    </>
  ),
  bolt: <path d="M13 3 5 13.5h5L11 21l8-10.5h-5L13 3Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.5" cy="12" r="1.4" />
    </>
  ),
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowR: <path d="M5 12h14M13 6l6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="M14.5 5.5 18.5 9.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19 5l-1.7 1.7M6.7 17.3 5 19M19 19l-1.7-1.7M6.7 6.7 5 5" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  repeat: (
    <>
      <path d="M4 9a4 4 0 0 1 4-4h9M21 15a4 4 0 0 1-4 4H8" />
      <path d="M14.5 2.5 17.5 5l-3 2.5M9.5 21.5 6.5 19l3-2.5" />
    </>
  ),
  weight: (
    <>
      <path d="M8 8h8l1.5 11h-11L8 8Z" />
      <path d="M9.5 8a2.5 2.5 0 0 1 5 0" />
    </>
  ),
  heart: <path d="M12 20S4 14.5 4 9.2A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 8 2.2C20 14.5 12 20 12 20Z" />,
} satisfies Record<string, JSX.Element>;

export type IconName = keyof typeof ICON_PATHS;

export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

export function Icon({
  name,
  size = 22,
  stroke = 1.8,
  style = {},
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
}) {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{
        display: 'block',
        flexShrink: 0,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: stroke,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        ...style,
      }}
    >
      {paths}
    </svg>
  );
}

/** Tile wrapper whose chrome follows the icon-style tweak (line | soft | solid). */
export function IconTile({
  name,
  variant = 'soft',
  size = 38,
  icon = 20,
  stroke = 1.8,
  active = false,
  style = {},
}: {
  name: IconName;
  variant?: IconStyle;
  size?: number;
  icon?: number;
  stroke?: number;
  active?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 'var(--r-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background .18s, color .18s, border-color .18s',
    ...style,
  };
  let chrome: CSSProperties;
  if (variant === 'solid') {
    chrome = {
      background: active ? 'var(--accent)' : 'var(--surface-2)',
      color: active ? 'var(--on-accent)' : 'var(--text-2)',
    };
  } else if (variant === 'soft') {
    chrome = {
      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
      color: active ? 'var(--accent-text)' : 'var(--text-2)',
    };
  } else {
    chrome = { background: 'transparent', color: active ? 'var(--accent-text)' : 'var(--text-2)' };
  }
  return (
    <div style={{ ...base, ...chrome }}>
      <Icon name={name} size={icon} stroke={stroke} />
    </div>
  );
}
