/**
 * Twelve small monthly vignettes for the /wellbeing mindful-moment card.
 * Same monochrome single-stroke aesthetic as WellbeingIllustrations.jsx —
 * `currentColor`, ~80×80 viewBox, slightly organic curves so the set
 * reads as hand-drawn rather than icon-pack.
 *
 * Mapped 1-12 via `monthlyIllustration(month)`. Northern-hemisphere
 * seasonal cues: a frosted leaf in January, a sunflower in July, a
 * holly sprig in November, etc. Southern-hemisphere users still see a
 * pretty drawing — the picture leans poetic rather than horticulturally
 * literal so it lands either way.
 */
const COMMON = {
  width: "100%",
  height: "100%",
  viewBox: "0 0 80 80",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

/** January — frosted leaf with tiny ice spikes radiating from its rim. */
function JanIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M40 14 q -22 14 -18 38 q 14 8 22 8 q 8 0 16 -10 q 4 -22 -20 -36 z" />
      <path d="M40 14 V 60" />
      <path d="M40 24 q -8 6 -10 14" />
      <path d="M40 28 q 8 4 12 12" />
      <path d="M40 38 q -8 4 -10 12" />
      <path d="M40 42 q 8 2 11 10" />
      {/* ice spikes */}
      <path d="M22 30 l -4 -2" /><path d="M20 40 l -5 0" /><path d="M22 50 l -4 2" />
      <path d="M58 30 l 4 -2" /><path d="M60 40 l 5 0" /><path d="M58 50 l 4 2" />
      <path d="M40 12 V 6" />
    </svg>
  );
}

/** February — single snowdrop, three pendant petals on a thin stem. */
function FebIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M40 76 V 32" />
      {/* leaf blade */}
      <path d="M40 60 q -10 -2 -14 -14 q 8 -2 14 8" />
      {/* cap */}
      <path d="M40 30 q -3 -3 -3 -7 q 3 -1 6 0 q 0 4 -3 7" />
      {/* three petals hanging */}
      <path d="M40 30 q -7 4 -8 14 q 5 1 8 -2 q 3 3 8 2 q -1 -10 -8 -14 z" />
      <path d="M40 30 q -2 6 -2 14" />
      <path d="M40 30 q 2 6 2 14" />
    </svg>
  );
}

/** March — daffodil silhouette: trumpet centre with six flared petals. */
function MarIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M40 76 V 50" />
      {/* trumpet */}
      <ellipse cx="40" cy="36" rx="6" ry="5" />
      {/* six petals */}
      {[
        "M40 36 q -14 -10 -14 -22 q 8 -2 14 6",
        "M40 36 q 14 -10 14 -22 q -8 -2 -14 6",
        "M40 36 q -22 -2 -22 8 q 8 6 22 2",
        "M40 36 q 22 -2 22 8 q -8 6 -22 2",
        "M40 36 q -10 8 -8 18 q 6 -2 8 -10",
        "M40 36 q 10 8 8 18 q -6 -2 -8 -10",
      ].map((d) => <path key={d} d={d} />)}
      {/* leaf */}
      <path d="M40 64 q -10 -2 -12 -12 q 6 -1 12 8" />
    </svg>
  );
}

/** April — branch tip with three blossoms (cherry / apple). */
function AprIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M14 60 q 14 -8 26 -16 q 8 -6 26 -10" />
      {/* three small five-petal blooms */}
      {[
        [22, 56], [42, 40], [60, 30],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          {[0, 72, 144, 216, 288].map((a) => {
            const r = 5;
            const rx = cx + r * Math.cos((a * Math.PI) / 180);
            const ry = cy + r * Math.sin((a * Math.PI) / 180);
            return <circle key={a} cx={rx} cy={ry} r="2.5" />;
          })}
          <circle cx={cx} cy={cy} r="1" fill="currentColor" stroke="none" />
        </g>
      ))}
    </svg>
  );
}

/** May — peony: many overlapping curves to give the layered rosette. */
function MayIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M40 76 V 56" />
      <circle cx="40" cy="38" r="14" />
      <path d="M30 30 q 10 6 20 0" />
      <path d="M28 36 q 12 8 24 0" />
      <path d="M30 44 q 10 6 20 0" />
      <path d="M34 30 q 0 8 6 12 q 6 -4 6 -12" />
      <path d="M40 26 V 50" />
      {/* leaf */}
      <path d="M40 60 q 9 -2 12 -10 q -6 -2 -12 6" />
      <path d="M40 64 q -8 -2 -10 -10 q 6 -2 10 6" />
    </svg>
  );
}

/** June — sweet pea: stem with two pea flowers and a curling tendril. */
function JunIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M22 76 q 8 -10 8 -28 q 0 -16 14 -28" />
      {/* upper bloom */}
      <path d="M44 22 q -6 -8 0 -12 q 6 4 0 12 z" />
      <path d="M44 22 q -6 4 -10 0 q 4 -8 10 -4" />
      <path d="M44 22 q 6 4 10 0 q -4 -8 -10 -4" />
      {/* lower bloom */}
      <path d="M30 46 q -6 -8 0 -12 q 6 4 0 12 z" />
      <path d="M30 46 q -8 4 -10 0 q 4 -8 10 -4" />
      {/* tendril */}
      <path d="M30 60 q 8 0 8 -6 q 0 -6 -6 -6 q -4 0 -2 4" />
    </svg>
  );
}

/** July — sunflower: many petal rays around a stippled centre. */
function JulIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M40 76 V 52" />
      {/* twelve petals */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 40 + 9 * Math.cos(a);
        const y1 = 36 + 9 * Math.sin(a);
        const x2 = 40 + 18 * Math.cos(a);
        const y2 = 36 + 18 * Math.sin(a);
        return <path key={`ray-${i * 30}`} d={`M${x1} ${y1} L${x2} ${y2}`} />;
      })}
      <circle cx="40" cy="36" r="7" />
      {/* a couple of seed stipples */}
      <circle cx="38" cy="35" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="42" cy="37" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="40" cy="33" r="0.8" fill="currentColor" stroke="none" />
      {/* leaf */}
      <path d="M40 60 q -10 -2 -14 -10 q 6 -2 14 6" />
    </svg>
  );
}

/** August — cluster of three blackberry drupelets on a stem with a leaf. */
function AugIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M22 76 q 8 -8 14 -22" />
      {/* three berries — each a knot of small circles */}
      {[[40, 32], [54, 28], [46, 18]].map(([cx, cy]) => (
        <g key={`berry-${cx}-${cy}`}>
          {[[0, 0], [-3, -2], [3, -2], [-3, 2], [3, 2], [0, -3], [0, 3]].map(([dx, dy]) => (
            <circle key={`${dx}-${dy}`} cx={cx + dx} cy={cy + dy} r="1.7" />
          ))}
        </g>
      ))}
      {/* leaf */}
      <path d="M30 60 q 12 0 16 -10 q -10 -3 -16 4" />
      <path d="M30 60 q 4 -4 12 -8" />
    </svg>
  );
}

/** September — single dahlia bloom with concentric petal rings. */
function SepIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M40 76 V 54" />
      <circle cx="40" cy="36" r="2.4" fill="currentColor" stroke="none" />
      {/* inner ring of 6 petals */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i * 60 * Math.PI) / 180;
        const cx = 40 + 5 * Math.cos(a);
        const cy = 36 + 5 * Math.sin(a);
        return <circle key={`inner-${i * 60}`} cx={cx} cy={cy} r="3" />;
      })}
      {/* outer ring of 8 petals */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = ((i * 45 + 22) * Math.PI) / 180;
        const cx = 40 + 11 * Math.cos(a);
        const cy = 36 + 11 * Math.sin(a);
        return <ellipse key={`outer-${i * 45 + 22}`} cx={cx} cy={cy} rx="4" ry="2.5" transform={`rotate(${i * 45 + 22} ${cx} ${cy})`} />;
      })}
      <path d="M40 62 q -10 -2 -12 -10 q 6 -2 12 6" />
    </svg>
  );
}

/** October — rose hip and a curling stem with thorns. */
function OctIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M14 76 q 6 -8 10 -16 q 6 -12 18 -22" />
      {/* hip */}
      <ellipse cx="46" cy="32" rx="10" ry="11" />
      {/* calyx tip */}
      <path d="M46 21 q -2 -6 0 -10 q 2 4 0 10" />
      <path d="M44 21 q -3 -2 -5 -1 q 1 3 5 4" />
      <path d="M48 21 q 3 -2 5 -1 q -1 3 -5 4" />
      {/* gloss highlight */}
      <path d="M42 28 q 0 -4 4 -5" />
      {/* thorns */}
      <path d="M22 60 l -3 -2" /><path d="M30 50 l -3 -2" /><path d="M36 38 l -3 -2" />
    </svg>
  );
}

/** November — holly sprig: two leaves and three berries. */
function NovIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      {/* central stem */}
      <path d="M40 76 V 24" />
      {/* spiky holly leaf, left */}
      <path d="M40 50 q -4 -3 -8 -1 q 0 -3 -4 -2 q 2 -4 -2 -5 q 4 -3 0 -7 q 5 1 6 -3 q 4 4 8 2 z" />
      {/* spiky holly leaf, right */}
      <path d="M40 36 q 4 -3 8 -1 q 0 -3 4 -2 q -2 -4 2 -5 q -4 -3 0 -7 q -5 1 -6 -3 q -4 4 -8 2 z" />
      {/* three berries */}
      <circle cx="40" cy="22" r="2.4" />
      <circle cx="36" cy="20" r="2.4" />
      <circle cx="44" cy="20" r="2.4" />
    </svg>
  );
}

/** December — small evergreen sprig (yew / fir): central rachis with paired needles. */
function DecIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON}>
      <path d="M40 76 V 14" />
      {/* paired needles, both sides, getting shorter towards the tip */}
      {[
        [62, 16], [60, 12], [56, 8],
        [46, 18], [42, 14], [36, 10],
        [30, 20], [24, 16], [18, 12],
        [14, 24], [12, 30],
      ].map(([dx, dy], i) => {
        const y = 70 - i * 5;
        return (
          <g key={`needle-${dx}-${dy}`}>
            <path d={`M40 ${y} L ${40 - dx + 30} ${y - dy + 8}`} />
            <path d={`M40 ${y} L ${40 + dx - 30} ${y - dy + 8}`} />
          </g>
        );
      })}
    </svg>
  );
}

const BY_MONTH = {
  1: JanIllustration, 2: FebIllustration, 3: MarIllustration,
  4: AprIllustration, 5: MayIllustration, 6: JunIllustration,
  7: JulIllustration, 8: AugIllustration, 9: SepIllustration,
  10: OctIllustration, 11: NovIllustration, 12: DecIllustration,
};

/**
 * Returns the illustration component for a given month (1-12). Defaults
 * to JulIllustration if a caller passes an out-of-range value (sunflowers
 * are the most universally legible if we ever fall through).
 */
export function monthlyIllustration(month) {
  return BY_MONTH[Number(month)] || JulIllustration;
}
