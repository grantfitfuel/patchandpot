/**
 * Vibrant filled-color motifs — the fresh replacement for the old
 * stroke-only line illustrations the user described as "stale" and
 * "depressing". Each motif uses the Patch & Pot palette (forest / moss
 * / terracotta / sand) with filled shapes and a hand-drawn pulse so the
 * UI feels alive rather than diagrammatic.
 *
 * All motifs render at viewBox 100×100 and scale to their container.
 * Each is self-contained — no external deps, no currentColor — so they
 * work on any coloured band.
 */

const FOREST = "#2D4A22";
const MOSS = "#5C6B52";
const TERRACOTTA = "#C65D47";
const SAND = "#F7F5F0";
const CORAL = "#E78A6F";
const BUTTER = "#F4C96B";
const SKY = "#CFE1D5";

const BASE = {
  width: "100%",
  height: "100%",
  viewBox: "0 0 100 100",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
};

/** Sun bursting over a hill — "Notice" / morning light. */
export function SunriseMotif({ className = "" }) {
  return (
    <svg className={className} {...BASE}>
      <defs>
        <clipPath id="sunrise-clip">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <g clipPath="url(#sunrise-clip)">
        {/* sky band */}
        <rect x="0" y="0" width="100" height="62" fill={SKY} />
        {/* sun */}
        <circle cx="50" cy="45" r="18" fill={BUTTER} />
        <circle cx="50" cy="45" r="12" fill={TERRACOTTA} opacity="0.85" />
        {/* rays */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
          <rect
            key={d}
            x="48.5"
            y="18"
            width="3"
            height="8"
            rx="1.5"
            fill={BUTTER}
            transform={`rotate(${d} 50 45)`}
          />
        ))}
        {/* hill */}
        <path d="M0 62 Q 25 48 50 58 T 100 62 L 100 100 L 0 100 Z" fill={FOREST} />
        {/* little sprout */}
        <path d="M50 58 V 50" stroke={MOSS} strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="46" cy="52" rx="3" ry="1.8" fill={MOSS} transform="rotate(-28 46 52)" />
        <ellipse cx="54" cy="52" rx="3" ry="1.8" fill={MOSS} transform="rotate(28 54 52)" />
      </g>
    </svg>
  );
}

/** Honeybee drifting across — movement, pollination. */
export function BeeMotif({ className = "" }) {
  return (
    <svg className={className} {...BASE}>
      {/* flight path */}
      <path
        d="M8 72 Q 25 55 42 68 T 78 55"
        stroke={MOSS}
        strokeWidth="1.4"
        strokeDasharray="3 3"
        fill="none"
        strokeLinecap="round"
      />
      {/* flower (bottom-left) */}
      <circle cx="16" cy="78" r="3" fill={BUTTER} />
      <circle cx="12" cy="76" r="3" fill={TERRACOTTA} />
      <circle cx="20" cy="76" r="3" fill={TERRACOTTA} />
      <circle cx="14" cy="81" r="3" fill={TERRACOTTA} />
      <circle cx="18" cy="81" r="3" fill={TERRACOTTA} />
      <circle cx="16" cy="78" r="1.6" fill={FOREST} />
      {/* bee body */}
      <ellipse cx="78" cy="48" rx="12" ry="7.5" fill={BUTTER} />
      <rect x="72" y="41" width="3" height="14" fill={FOREST} />
      <rect x="78" y="41" width="3" height="14" fill={FOREST} />
      <circle cx="68" cy="48" r="2" fill={FOREST} />
      {/* wings */}
      <ellipse cx="76" cy="40" rx="6" ry="4" fill={SAND} opacity="0.9" />
      <ellipse cx="82" cy="40" rx="6" ry="4" fill={SAND} opacity="0.9" />
      <ellipse cx="76" cy="40" rx="6" ry="4" fill="none" stroke={FOREST} strokeWidth="0.8" />
      <ellipse cx="82" cy="40" rx="6" ry="4" fill="none" stroke={FOREST} strokeWidth="0.8" />
    </svg>
  );
}

/** Full-bloom poppy — colour, generosity, "Nourish". */
export function PoppyMotif({ className = "" }) {
  return (
    <svg className={className} {...BASE}>
      {/* stem */}
      <path d="M50 95 Q 48 70 52 48" stroke={FOREST} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* leaf */}
      <path
        d="M48 72 Q 32 68 28 78 Q 40 82 48 76 Z"
        fill={MOSS}
      />
      {/* back petals */}
      <ellipse cx="50" cy="40" rx="22" ry="18" fill={CORAL} transform="rotate(-6 50 40)" />
      {/* front petals */}
      <ellipse cx="42" cy="44" rx="12" ry="16" fill={TERRACOTTA} transform="rotate(-24 42 44)" />
      <ellipse cx="58" cy="44" rx="12" ry="16" fill={TERRACOTTA} transform="rotate(24 58 44)" />
      <ellipse cx="50" cy="34" rx="13" ry="15" fill={CORAL} />
      {/* center */}
      <circle cx="50" cy="42" r="5" fill={FOREST} />
      <circle cx="50" cy="42" r="3" fill={BUTTER} />
      {/* stamen dots */}
      <circle cx="47" cy="40" r="0.9" fill={BUTTER} />
      <circle cx="53" cy="40" r="0.9" fill={BUTTER} />
      <circle cx="50" cy="39" r="0.9" fill={BUTTER} />
      <circle cx="50" cy="45" r="0.9" fill={BUTTER} />
    </svg>
  );
}

/** Hands cradling a seedling — "Slow". */
export function SeedlingMotif({ className = "" }) {
  return (
    <svg className={className} {...BASE}>
      {/* soil mound */}
      <ellipse cx="50" cy="78" rx="30" ry="7" fill={FOREST} />
      {/* pot */}
      <path d="M26 60 L 32 86 L 68 86 L 74 60 Z" fill={TERRACOTTA} />
      <rect x="24" y="58" width="52" height="5" rx="1" fill={CORAL} />
      {/* main stem */}
      <path d="M50 60 V 32" stroke={FOREST} strokeWidth="2.2" strokeLinecap="round" />
      {/* leaves */}
      <ellipse cx="42" cy="42" rx="9" ry="5" fill={MOSS} transform="rotate(-30 42 42)" />
      <ellipse cx="58" cy="42" rx="9" ry="5" fill={MOSS} transform="rotate(30 58 42)" />
      <ellipse cx="40" cy="30" rx="7" ry="4.2" fill={FOREST} transform="rotate(-24 40 30)" />
      <ellipse cx="60" cy="30" rx="7" ry="4.2" fill={FOREST} transform="rotate(24 60 30)" />
      {/* top bud */}
      <circle cx="50" cy="24" r="3.4" fill={BUTTER} />
      <circle cx="50" cy="24" r="1.6" fill={TERRACOTTA} />
    </svg>
  );
}

/** Harvest tomatoes in a bowl — "Nourish" / summer glut. */
export function HarvestMotif({ className = "" }) {
  return (
    <svg className={className} {...BASE}>
      {/* bowl back */}
      <ellipse cx="50" cy="60" rx="36" ry="6" fill={CORAL} />
      {/* bowl body */}
      <path d="M14 60 Q 50 92 86 60 Z" fill={TERRACOTTA} />
      {/* fruit back */}
      <circle cx="34" cy="54" r="9" fill={CORAL} />
      <circle cx="62" cy="52" r="10" fill={TERRACOTTA} />
      {/* highlight */}
      <ellipse cx="60" cy="48" rx="2.4" ry="1.4" fill={SAND} opacity="0.6" />
      <ellipse cx="32" cy="50" rx="2" ry="1.2" fill={SAND} opacity="0.6" />
      {/* calyx leaves */}
      <path d="M34 48 Q 32 44 36 42 Q 36 46 34 48 Z" fill={FOREST} />
      <path d="M62 44 Q 60 40 64 38 Q 64 42 62 44 Z" fill={FOREST} />
      <path d="M62 44 Q 65 41 68 42 Q 65 45 62 44 Z" fill={FOREST} />
      {/* herb sprig */}
      <path d="M80 56 Q 86 44 82 32" stroke={FOREST} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <ellipse cx="81" cy="46" rx="3" ry="1.6" fill={MOSS} transform="rotate(-50 81 46)" />
      <ellipse cx="83" cy="38" rx="3" ry="1.6" fill={MOSS} transform="rotate(-70 83 38)" />
    </svg>
  );
}

/** Watering-can arc — care, routine. */
export function WateringMotif({ className = "" }) {
  return (
    <svg className={className} {...BASE}>
      {/* can body (centered, larger) */}
      <path d="M30 42 L 70 42 L 66 78 L 34 78 Z" fill={FOREST} />
      {/* can neck */}
      <rect x="26" y="37" width="10" height="7" rx="1" fill={FOREST} />
      {/* spout */}
      <path d="M14 26 L 30 36 L 30 44 L 18 36 Z" fill={MOSS} />
      {/* rose (shower head) */}
      <circle cx="14" cy="26" r="5.5" fill={CORAL} />
      <circle cx="12" cy="24" r="0.7" fill={FOREST} />
      <circle cx="16" cy="24" r="0.7" fill={FOREST} />
      <circle cx="12" cy="28" r="0.7" fill={FOREST} />
      <circle cx="16" cy="28" r="0.7" fill={FOREST} />
      <circle cx="14" cy="26" r="0.7" fill={FOREST} />
      {/* handle on the right */}
      <path d="M62 42 Q 78 36 76 60 Q 76 70 68 70" stroke={MOSS} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* water droplets */}
      <ellipse cx="10" cy="42" rx="1.6" ry="3" fill={SKY} />
      <ellipse cx="6" cy="54" rx="1.4" ry="2.6" fill={SKY} />
      <ellipse cx="12" cy="60" rx="1.6" ry="3" fill={SKY} />
      {/* highlight on body */}
      <path d="M36 46 L 36 72" stroke={MOSS} strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
      {/* little sprout popping from the top */}
      <path d="M50 42 V 32" stroke={MOSS} strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="46" cy="34" rx="3" ry="1.8" fill={BUTTER} transform="rotate(-28 46 34)" />
      <ellipse cx="54" cy="34" rx="3" ry="1.8" fill={BUTTER} transform="rotate(28 54 34)" />
    </svg>
  );
}

/** Window-sill pot — small-space / "Grow Anywhere". */
export function WindowsillMotif({ className = "" }) {
  return (
    <svg className={className} {...BASE}>
      {/* window frame */}
      <rect x="10" y="12" width="80" height="60" fill={SKY} />
      <rect x="10" y="12" width="80" height="60" fill="none" stroke={FOREST} strokeWidth="2" />
      <rect x="48" y="12" width="4" height="60" fill={FOREST} />
      <rect x="10" y="40" width="80" height="4" fill={FOREST} />
      {/* sill */}
      <rect x="4" y="72" width="92" height="8" fill={CORAL} />
      {/* pot */}
      <path d="M38 80 L 42 96 L 58 96 L 62 80 Z" fill={TERRACOTTA} />
      {/* herb bush */}
      <circle cx="42" cy="76" r="7" fill={MOSS} />
      <circle cx="50" cy="72" r="8" fill={FOREST} />
      <circle cx="58" cy="76" r="7" fill={MOSS} />
      {/* flowers */}
      <circle cx="46" cy="70" r="1.6" fill={BUTTER} />
      <circle cx="54" cy="68" r="1.6" fill={BUTTER} />
      <circle cx="50" cy="64" r="1.6" fill={CORAL} />
      {/* sun outside */}
      <circle cx="78" cy="26" r="7" fill={BUTTER} />
    </svg>
  );
}

/** Garden calendar — layered leaves rotating with the seasons. */
export function SeasonsMotif({ className = "" }) {
  return (
    <svg className={className} {...BASE}>
      <circle cx="50" cy="50" r="36" fill={SAND} />
      <circle cx="50" cy="50" r="36" fill="none" stroke={FOREST} strokeWidth="2" />
      {/* quadrants */}
      <path d="M50 14 A 36 36 0 0 1 86 50 L 50 50 Z" fill={BUTTER} opacity="0.85" />
      <path d="M86 50 A 36 36 0 0 1 50 86 L 50 50 Z" fill={CORAL} opacity="0.85" />
      <path d="M50 86 A 36 36 0 0 1 14 50 L 50 50 Z" fill={MOSS} opacity="0.9" />
      <path d="M14 50 A 36 36 0 0 1 50 14 L 50 50 Z" fill={SKY} />
      {/* center bud */}
      <circle cx="50" cy="50" r="7" fill={FOREST} />
      <circle cx="50" cy="50" r="3" fill={BUTTER} />
      {/* season dots */}
      <circle cx="50" cy="20" r="2.2" fill={FOREST} />
      <circle cx="80" cy="50" r="2.2" fill={FOREST} />
      <circle cx="50" cy="80" r="2.2" fill={FOREST} />
      <circle cx="20" cy="50" r="2.2" fill={FOREST} />
    </svg>
  );
}
