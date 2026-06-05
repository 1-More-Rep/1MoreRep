'use client';

import { useState } from 'react';
import type { Muscle } from '@/domain/muscles/taxonomy';
import { Segmented } from '@/components/ui/Segmented';

type View = 'front' | 'back';

/**
 * 2D body silhouette with clickable muscle regions. Mode-agnostic: the caller
 * supplies `tint(muscle)` (region fill) and `regionLabel(muscle)` (aria-label),
 * so the same SVG drives both the fatigue and strength views.
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
  const [view, setView] = useState<View>('front');

  function Region({ muscle, children }: { muscle: Muscle; children: React.ReactNode }) {
    const isSel = selected === muscle;
    return (
      <g
        role="button"
        tabIndex={0}
        className="bodymap-region"
        aria-label={regionLabel(muscle)}
        aria-pressed={isSel}
        onClick={() => onSelect?.(muscle)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); // Space would otherwise scroll the page on activate
            onSelect?.(muscle);
          }
        }}
        style={{ cursor: onSelect ? 'pointer' : 'default', fill: tint(muscle), stroke: isSel ? 'var(--accent)' : 'var(--line-2)', strokeWidth: isSel ? 1.6 : 0.7, transition: 'fill .3s' }}
      >
        {children}
      </g>
    );
  }

  // mirror helper: render a shape at x and mirrored across the 60 centerline
  const M = (x: number) => 120 - x;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <Segmented<View>
        ariaLabel="Body view"
        size="sm"
        value={view}
        onChange={setView}
        options={[
          { value: 'front', label: 'Front' },
          { value: 'back', label: 'Back' },
        ]}
        style={{ width: 180 }}
      />

      <svg role="img" viewBox="0 0 120 250" width="100%" style={{ maxWidth: 280, display: 'block' }} aria-label={`${title}, ${view} view`}>
        {/* silhouette (non-interactive so muscle regions own the clicks) */}
        <g className="bodymap-silhouette" style={{ fill: 'var(--surface)', stroke: 'var(--line)', strokeWidth: 1 }}>
          <ellipse cx="60" cy="22" rx="13" ry="15" /> {/* head */}
          <rect x="54" y="35" width="12" height="8" rx="3" /> {/* neck */}
          <path d="M40 44 H80 Q92 46 92 60 L88 96 Q86 104 80 104 H40 Q34 104 32 96 L28 60 Q28 46 40 44 Z" /> {/* torso */}
          <path d="M34 50 Q22 54 20 78 L17 104 Q16 110 21 110 Q26 110 27 104 L31 80 Z" /> {/* left arm */}
          <path d={`M86 50 Q98 54 100 78 L103 104 Q104 110 99 110 Q94 110 93 104 L89 80 Z`} /> {/* right arm */}
          <path d="M40 104 H80 L78 170 Q77 178 70 178 H64 L62 184 H58 L56 178 H50 Q43 178 42 170 Z" /> {/* hips/thighs */}
          <rect x="46" y="176" width="12" height="60" rx="5" /> {/* left lower leg */}
          <rect x="62" y="176" width="12" height="60" rx="5" /> {/* right lower leg */}
        </g>

        {view === 'front' ? (
          <>
            <Region muscle="NECK"><rect x="55" y="36" width="10" height="7" rx="3" /></Region>
            <Region muscle="FRONT_DELTS"><ellipse cx="36" cy="52" rx="7" ry="6" /><ellipse cx={M(36)} cy="52" rx="7" ry="6" /></Region>
            <Region muscle="SIDE_DELTS"><ellipse cx="30" cy="56" rx="4" ry="5" /><ellipse cx={M(30)} cy="56" rx="4" ry="5" /></Region>
            <Region muscle="CHEST"><rect x="40" y="50" width="17" height="16" rx="5" /><rect x={M(57)} y="50" width="17" height="16" rx="5" /></Region>
            <Region muscle="ABS"><rect x="52" y="70" width="16" height="28" rx="4" /></Region>
            <Region muscle="OBLIQUES"><rect x="40" y="72" width="8" height="24" rx="3" /><rect x={M(48)} y="72" width="8" height="24" rx="3" /></Region>
            <Region muscle="BICEPS"><ellipse cx="25" cy="72" rx="5" ry="9" /><ellipse cx={M(25)} cy="72" rx="5" ry="9" /></Region>
            <Region muscle="FOREARMS"><ellipse cx="20" cy="96" rx="4" ry="9" /><ellipse cx={M(20)} cy="96" rx="4" ry="9" /></Region>
            <Region muscle="QUADS"><rect x="44" y="108" width="14" height="54" rx="6" /><rect x={M(58)} y="108" width="14" height="54" rx="6" /></Region>
            <Region muscle="ADDUCTORS"><rect x="56" y="110" width="8" height="40" rx="3" /></Region>
          </>
        ) : (
          <>
            <Region muscle="TRAPS"><path d="M48 44 H72 L66 64 H54 Z" /></Region>
            <Region muscle="REAR_DELTS"><ellipse cx="35" cy="53" rx="7" ry="6" /><ellipse cx={M(35)} cy="53" rx="7" ry="6" /></Region>
            <Region muscle="RHOMBOIDS"><rect x="50" y="58" width="20" height="14" rx="3" /></Region>
            <Region muscle="LATS"><path d="M40 64 L34 92 Q44 96 50 86 L52 66 Z" /><path d={`M80 64 L86 92 Q76 96 70 86 L68 66 Z`} /></Region>
            <Region muscle="LOWER_BACK"><rect x="50" y="86" width="20" height="16" rx="4" /></Region>
            <Region muscle="TRICEPS"><ellipse cx="25" cy="72" rx="5" ry="9" /><ellipse cx={M(25)} cy="72" rx="5" ry="9" /></Region>
            <Region muscle="FOREARMS"><ellipse cx="20" cy="96" rx="4" ry="9" /><ellipse cx={M(20)} cy="96" rx="4" ry="9" /></Region>
            <Region muscle="GLUTES"><ellipse cx="51" cy="116" rx="9" ry="10" /><ellipse cx={M(51)} cy="116" rx="9" ry="10" /></Region>
            <Region muscle="HAMSTRINGS"><rect x="44" y="128" width="14" height="42" rx="6" /><rect x={M(58)} y="128" width="14" height="42" rx="6" /></Region>
            <Region muscle="CALVES"><rect x="47" y="182" width="10" height="44" rx="5" /><rect x={M(57)} y="182" width="10" height="44" rx="5" /></Region>
          </>
        )}
      </svg>
    </div>
  );
}
