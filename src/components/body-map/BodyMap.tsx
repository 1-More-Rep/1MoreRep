'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Muscle } from '@/domain/muscles/taxonomy';
import { Segmented } from '@/components/ui/Segmented';

type View = 'front' | 'back';

/**
 * 2D body map with clickable muscle regions. Mode-agnostic: the caller supplies
 * `tint(muscle)` (region fill) and `regionLabel(muscle)` (aria-label), so the same
 * figure drives both the fatigue and strength views.
 *
 * Each muscle is a self-contained, NON-OVERLAPPING shape (or a mirrored pair), and
 * only the painted shape is clickable — see `.bodymap-region` in globals.css. This
 * is deliberate: an earlier version used `pointer-events: bounding-box`, which made
 * each group's whole (overlapping) bounding box hot, so taps landed on the wrong
 * muscle. Keep regions disjoint and never reintroduce bounding-box hit-testing.
 */
export function BodyMap({
  tint,
  regionLabel,
  title,
  onSelect,
  selected,
}: {
  tint: (m: Muscle) => string;
  regionLabel: (m: Muscle) => string;
  title: string;
  onSelect?: (m: Muscle) => void;
  selected?: Muscle | null;
}) {
  const t = useTranslations('muscles');
  const [view, setView] = useState<View>('front');

  function Region({ muscle, children }: { muscle: Muscle; children: React.ReactNode }) {
    const isSel = selected === muscle;
    // Keyboard focus must be visible (WCAG 2.4.7). A CSS :focus-visible rule can't win
    // against the inline stroke, so track focus and paint an accent stroke + halo that
    // shows regardless of the region's fill colour.
    const [focused, setFocused] = useState(false);
    return (
      <g
        role="button"
        tabIndex={0}
        className="bodymap-region"
        aria-label={regionLabel(muscle)}
        aria-pressed={isSel}
        onClick={() => onSelect?.(muscle)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); // Space would otherwise scroll the page on activate
            onSelect?.(muscle);
          }
        }}
        style={{
          cursor: onSelect ? 'pointer' : 'default',
          fill: tint(muscle),
          stroke: isSel || focused ? 'var(--accent)' : 'var(--line-2)',
          strokeWidth: focused ? 3 : isSel ? 2 : 0.8,
          strokeLinejoin: 'round',
          filter: focused ? 'drop-shadow(0 0 3px var(--accent))' : undefined,
          transition: 'fill .3s, stroke .15s, stroke-width .15s',
        }}
      >
        {children}
      </g>
    );
  }

  // Mirror an x-coordinate across the figure's centerline (viewBox is 240 wide).
  const M = (x: number) => 240 - x;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <Segmented<View>
        ariaLabel={t('bodyView')}
        size="sm"
        value={view}
        onChange={setView}
        options={[
          { value: 'front', label: t('front') },
          { value: 'back', label: t('back') },
        ]}
        style={{ width: 180 }}
      />

      <svg
        role="img"
        viewBox="0 0 240 372"
        width="100%"
        style={{ maxWidth: 300, display: 'block' }}
        aria-label={t('mapAria', { title, view: view === 'front' ? t('front') : t('back') })}
      >
        {/* Decorative silhouette (head, limbs, joints, feet) — never owns clicks;
            the muscle regions sit on top and own hit-testing. */}
        <g className="bodymap-silhouette" style={{ fill: 'var(--surface-2)', stroke: 'var(--line)', strokeWidth: 1.2 }}>
          <circle cx="120" cy="34" r="19" />
          <rect x="110" y="46" width="20" height="16" rx="6" />
          <path d="M70 84 Q70 68 94 66 L146 66 Q170 68 170 84 L158 182 Q156 202 144 206 L96 206 Q84 202 82 182 Z" />
          <rect x="52" y="80" width="26" height="126" rx="13" />
          <rect x="162" y="80" width="26" height="126" rx="13" />
          <circle cx="64" cy="210" r="10" />
          <circle cx="176" cy="210" r="10" />
          <rect x="83" y="196" width="74" height="22" rx="11" />
          <rect x="83" y="206" width="32" height="152" rx="15" />
          <rect x="125" y="206" width="32" height="152" rx="15" />
          <ellipse cx="97" cy="362" rx="13" ry="7" />
          <ellipse cx="143" cy="362" rx="13" ry="7" />
        </g>

        {view === 'front' ? (
          <>
            <Region muscle="NECK"><rect x="111" y="49" width="18" height="12" rx="5" /></Region>
            <Region muscle="SIDE_DELTS"><ellipse cx="72" cy="79" rx="9" ry="11" /><ellipse cx={M(72)} cy="79" rx="9" ry="11" /></Region>
            <Region muscle="FRONT_DELTS"><ellipse cx="90" cy="80" rx="14" ry="12" /><ellipse cx={M(90)} cy="80" rx="14" ry="12" /></Region>
            <Region muscle="CHEST"><rect x="99" y="80" width="19" height="32" rx="8" /><rect x={M(118)} y="80" width="19" height="32" rx="8" /></Region>
            <Region muscle="BICEPS"><rect x="62" y="96" width="18" height="46" rx="9" /><rect x={M(80)} y="96" width="18" height="46" rx="9" /></Region>
            <Region muscle="FOREARMS"><rect x="60" y="150" width="18" height="50" rx="9" /><rect x={M(78)} y="150" width="18" height="50" rx="9" /></Region>
            <Region muscle="ABS"><rect x="107" y="116" width="26" height="52" rx="7" /></Region>
            <Region muscle="OBLIQUES"><rect x="94" y="118" width="10" height="44" rx="5" /><rect x={M(104)} y="118" width="10" height="44" rx="5" /></Region>
            <Region muscle="QUADS"><rect x="85" y="206" width="21" height="80" rx="11" /><rect x={M(106)} y="206" width="21" height="80" rx="11" /></Region>
            <Region muscle="ADDUCTORS"><path d="M108 212 L118 212 L115 262 Q111 262 108 252 Z" /><path d="M132 212 L122 212 L125 262 Q129 262 132 252 Z" /></Region>
          </>
        ) : (
          <>
            <Region muscle="TRAPS"><path d="M120 60 Q139 66 134 88 L126 106 L114 106 L106 88 Q101 66 120 60 Z" /></Region>
            <Region muscle="REAR_DELTS"><ellipse cx="90" cy="80" rx="13" ry="11" /><ellipse cx={M(90)} cy="80" rx="13" ry="11" /></Region>
            <Region muscle="TRICEPS"><rect x="62" y="96" width="18" height="46" rx="9" /><rect x={M(80)} y="96" width="18" height="46" rx="9" /></Region>
            <Region muscle="FOREARMS"><rect x="60" y="150" width="18" height="50" rx="9" /><rect x={M(78)} y="150" width="18" height="50" rx="9" /></Region>
            <Region muscle="RHOMBOIDS"><rect x="107" y="110" width="26" height="20" rx="5" /></Region>
            <Region muscle="LATS"><path d="M82 96 Q72 124 98 152 L106 150 Q106 114 100 98 Z" /><path d="M158 96 Q168 124 142 152 L134 150 Q134 114 140 98 Z" /></Region>
            <Region muscle="LOWER_BACK"><rect x="107" y="134" width="26" height="26" rx="6" /></Region>
            <Region muscle="GLUTES"><ellipse cx="103" cy="190" rx="19" ry="15" /><ellipse cx={M(103)} cy="190" rx="19" ry="15" /></Region>
            <Region muscle="HAMSTRINGS"><rect x="86" y="212" width="22" height="72" rx="11" /><rect x={M(108)} y="212" width="22" height="72" rx="11" /></Region>
            <Region muscle="CALVES"><rect x="90" y="290" width="20" height="54" rx="10" /><rect x={M(110)} y="290" width="20" height="54" rx="10" /></Region>
          </>
        )}
      </svg>
    </div>
  );
}
