/**
 * Conversion & product-analytics tracking.
 *
 * Dual-write:
 *   1. First-party  → POST /api/track/event   (Mongo `analytics_events`).
 *      Always fires, gives us data we own even if visitors block GA.
 *   2. GA4 / GTM    → window.dataLayer.push  (only if REACT_APP_GA4_ID
 *      is set at build time — otherwise silently skipped).
 *
 * All calls are fire-and-forget. Never throws — analytics must never
 * break a click handler.
 */
import { API } from "./api";

const GA_ID = process.env.REACT_APP_GA4_ID || "";

// ── Anonymous, in-browser session so we can join events server-side. ──
const SESSION_KEY = "patchpot.track.sid";

function _sid() {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

function _push_gtag(event, params) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  } catch {
    /* noop */
  }
}

export function track(event, params = {}) {
  const payload = { event, params, sid: _sid(), path: window.location.pathname };
  // GA4 first — it's just a `push` into dataLayer, cheap.
  _push_gtag(event, params);
  // First-party — best-effort beacon.
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      // `sendBeacon` survives page unload, so `cta_click` on an outbound
      // navigation still gets recorded.
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${API}/track/event`, blob);
      return;
    }
    fetch(`${API}/track/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* private-mode / SSR — noop */
  }
}

// Fire a `page_view` on mount. Use this from your top-level App / route
// wrapper. Debounced so a quick client-side redirect doesn't double-fire.
let _last_view_key = "";
export function trackPageView(path, extras = {}) {
  const key = `${path}::${JSON.stringify(extras)}`;
  if (key === _last_view_key) return;
  _last_view_key = key;
  track("page_view", { path, ...extras });
  // GA4 needs the measurement_id + page_location the standard way:
  if (GA_ID) {
    _push_gtag("page_view", {
      page_location: window.location.href,
      page_path: path,
    });
  }
}
