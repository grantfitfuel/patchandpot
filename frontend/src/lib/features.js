/**
 * Runtime feature flags for the frontend.
 *
 * These are plain constants, imported anywhere in the app to conditionally
 * render a feature. Kept in one file so flipping a flag doesn't require
 * grep-and-replace across many components.
 *
 * Flip a flag and the change ripples through the Home page, the paywall
 * modal, and the legal pages simultaneously.
 */

// When false, the Home page hides:
//   - The FoundingBanner (30-spot ribbon at the top)
//   - The EmbedFoundingSnippet ("Embed the Founding offer") panel
//   - The £50 Bundle CTA and its lifetime pricing tile
// And the PaywallModal filters `lifetime` out of its tier list.
// Backend routes (`/api/founding-status`, checkout for `lifetime`) stay
// live so stale links continue to work — they're just no longer
// advertised anywhere on the site.
export const SHOW_LIFETIME_TIERS = false;
