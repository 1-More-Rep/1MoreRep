import { Mono } from '@/components/ui/typography';

export interface ChartPoint {
  label: string;
  value: number;
}

/** Minimal dependency-free SVG line chart. */
export function LineChart({ points, height = 150, unit = '' }: { points: ChartPoint[]; height?: number; unit?: string }) {
  if (points.length < 2) {
    return <div style={{ color: 'var(--text-3)', fontSize: 14, padding: '20px 0' }}>Not enough data yet — log a few entries.</div>;
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 12;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? 50 : (i / (points.length - 1)) * 100;
    const y = pad + (1 - (p.value - min) / range) * (height - pad * 2);
    return { x, y };
  });
  const linePath = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L100,${height} L0,${height} Z`;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
        <path d={areaPath} fill="var(--accent-soft)" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={2.4} fill="var(--accent)" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
        <span>{points[0]!.label}</span>
        <span>
          <Mono>{min}</Mono>–<Mono>{max}</Mono> {unit}
        </span>
        <span>{points[points.length - 1]!.label}</span>
      </div>
    </div>
  );
}
