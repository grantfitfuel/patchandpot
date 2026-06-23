/**
 * Sentry error reporting — silent no-op when REACT_APP_SENTRY_DSN is missing.
 *
 * Imported once from `index.js` so it runs before React renders. Drop a real
 * DSN into frontend/.env and rebuild to enable browser error reporting.
 *
 * Why not at module scope here? CRA inlines `process.env.REACT_APP_*` at
 * build time, so the DSN is fixed when the bundle ships. That's fine — DSNs
 * are public-safe (Sentry's docs explicitly say so).
 */
import * as Sentry from "@sentry/react";

const DSN = process.env.REACT_APP_SENTRY_DSN || "";

if (DSN) {
  try {
    Sentry.init({
      dsn: DSN,
      environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production",
      // Keep cost predictable — bump these via env when you want richer data.
      tracesSampleRate: Number(process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE || 0),
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      // Strip query strings + fragments from breadcrumbs so we never accidentally
      // ship API keys / Stripe session ids to Sentry.
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb?.data?.url) {
          try {
            const u = new URL(breadcrumb.data.url);
            breadcrumb.data.url = u.origin + u.pathname;
          } catch (_) { /* leave as-is */ }
        }
        return breadcrumb;
      },
    });
  } catch (e) {
    // Sentry init failing must never block the app from rendering.
     
    console.warn("Sentry init failed (continuing without it):", e);
  }
}

export { Sentry };
