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
    // Preferred path: GA4's `gtag('event', name, params)` — this is what
    // the snippet in index.html installs on window when REACT_APP_GA4_ID
    // is set. It writes to dataLayer in the shape GA4 expects.
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", event, params || {});
      return;
    }
    // Fallback for GTM-only setups (no gtag shim) — push a plain object
    // that a Custom Event trigger in GTM can key off.
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  } catch {
    /* noop */
  }
}

export function track(event, params = {}, opts = {}) {
  const payload = { event, params, sid: _sid(), path: window.location.pathname };
  // GA4 first — it's just a `push` into dataLayer, cheap.
  // `opts.skipGa` lets callers (e.g. trackPageView) send a hand-crafted
  // GA4 event separately without double-firing.
  if (!opts.skipGa) _push_gtag(event, params);
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
  // First-party record only — we hand-craft the GA4 page_view below with
  // the canonical `page_location` / `page_path` / `page_title` fields.
  track("page_view", { path, ...extras }, { skipGa: true });
  if (GA_ID && typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: path,
      page_title: document.title,
    });
  }
}
