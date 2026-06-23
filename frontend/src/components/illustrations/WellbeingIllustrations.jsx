/**
 * Three small hand-coded line illustrations for the Home wellbeing band.
 * SVG, single-stroke, currentColor — they pick up the Tailwind text colour
 * of whichever element they sit in (we use text-terracotta on the home
 * page). Slightly organic curves are intentional: lucide is too crisp /
 * UI-flat for the editorial wellbeing band, and a perfectly geometric
 * illustration would look stamped-out.
 *
 * viewBox is 80×80 for each so they line up with neighbouring 5×5 / 7×7
 * Tailwind icon sizes when scaled down.
 */
const COMMON_PROPS = {
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

/**
 * Notice — a swallow perched on a thin stake. Body is a soft pointed
 * crescent so the silhouette reads as a bird (rather than a hook). Wing
 * is implied by a single inner line; the forked tail is two short strokes
 * trailing off to the right.
 */
export function NoticeIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON_PROPS}>
      {/* slim stake and a tiny leaf */}
      <path d="M40 78 V 36" />
      <path d="M40 60 q 6 -3 9 -8 q -6 -1 -9 4" />
      {/* swallow body — pointed-oval silhouette, perched leaning left */}
      <path d="M22 22 q 2 -8 14 -8 q 16 0 26 6 q -10 6 -26 6 q -10 0 -14 -4 z" />
      {/* head bump */}
      <path d="M22 22 q -3 0 -4 -2 q 1 -2 4 -2" />
      {/* eye */}
      <circle cx="20.5" cy="20" r="0.9" fill="currentColor" stroke="none" />
      {/* wing line */}
      <path d="M30 20 q 6 4 16 4" />
      {/* legs onto stake */}
      <path d="M36 26 V 32" />
      <path d="M40 26 V 32" />
      {/* forked tail trailing right */}
      <path d="M62 26 l 8 -3" />
      <path d="M62 26 l 8 3" />
    </svg>
  );
}

/**
 * Slow — two open hands cupped together, holding a single seedling.
 * Each hand is a curved palm with three finger-creases sketched in;
 * the seedling is centred between them with two cotyledon leaves.
 */
export function SlowIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON_PROPS}>
      {/* left palm */}
      <path d="M10 44 q -2 14 14 22 q 8 4 16 4" />
      {/* right palm */}
      <path d="M70 44 q 2 14 -14 22 q -8 4 -16 4" />
      {/* finger creases — three short diagonals on each side */}
      <path d="M16 50 l 3 4" />
      <path d="M22 47 l 3 4" />
      <path d="M28 45 l 3 4" />
      <path d="M64 50 l -3 4" />
      <path d="M58 47 l -3 4" />
      <path d="M52 45 l -3 4" />
      {/* seedling stem */}
      <path d="M40 40 V 18" />
      {/* leaves */}
      <path d="M40 26 q -8 -2 -12 -8 q 4 -1 12 4" />
      <path d="M40 24 q 8 -2 12 -8 q -4 -1 -12 4" />
    </svg>
  );
}

/**
 * Nourish — a single tomato resting in a shallow bowl. Tomato has its
 * familiar five-pointed calyx and one little stem. Bowl is a flattened
 * half-ellipse with a thin foot beneath.
 */
export function NourishIllustration({ className = "" }) {
  return (
    <svg className={className} {...COMMON_PROPS}>
      {/* bowl */}
      <path d="M14 48 q 0 14 26 14 q 26 0 26 -14" />
      {/* bowl rim ellipse (front half only — the back implied) */}
      <path d="M14 48 q 0 -4 26 -4 q 26 0 26 4" />
      {/* foot under the bowl */}
      <path d="M30 64 H 50" />
      <path d="M34 64 V 68" />
      <path d="M46 64 V 68" />
      {/* tomato */}
      <circle cx="40" cy="34" r="11" />
      {/* calyx — five pointy leaves around the stem base */}
      <path d="M40 23 q -3 -2 -5 -1 q 2 3 5 4" />
      <path d="M40 23 q 3 -2 5 -1 q -2 3 -5 4" />
      <path d="M40 23 q -1 -3 -3 -3 q 0 3 3 4" />
      <path d="M40 23 q 1 -3 3 -3 q 0 3 -3 4" />
      {/* stem */}
      <path d="M40 22 V 18" />
    </svg>
  );
}
