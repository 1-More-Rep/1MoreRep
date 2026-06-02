import { Mono } from './typography';

export interface WeekBar {
  /** Day label, e.g. "M". */
  d: string;
  /** Normalized value 0..1 (relative volume). */
  v: number;
  today?: boolean;
}

/** Weekly activity bars (volume per day). */
export function WeekBars({
  data,
  height = 96,
  accentToday = true,
}: {
  data: WeekBar[];
  height?: number;
  accentToday?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height }}>
      {data.map((b, i) => {
        const filled = b.v > 0;
        const h = Math.max(4, b.v * (height - 22));
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              height: '100%',
              justifyContent: 'flex-end',
            }}
          >
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: 18,
                  height: h,
                  borderRadius: 'var(--r-xs)',
                  background: filled ? 'var(--accent)' : 'var(--surface-2)',
                  border: filled ? 'none' : '1px solid var(--line)',
                  position: 'relative',
                }}
              >
                {b.today && accentToday && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 'var(--r-xs)',
                      border: '1.5px dashed var(--accent-line)',
                    }}
                  />
                )}
              </div>
            </div>
            <Mono
              style={{
                fontSize: 11,
                color: b.today ? 'var(--accent-text)' : 'var(--text-3)',
                fontWeight: b.today ? 700 : 500,
              }}
            >
              {b.d}
            </Mono>
          </div>
        );
      })}
    </div>
  );
}
