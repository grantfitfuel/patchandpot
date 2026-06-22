import { useEffect } from "react";

/**
 * Capture an attribution `?ref=` query param on first arrival and persist it
 * to localStorage so it survives the Stripe redirect dance. The token is
 * sanitised here and again server-side (defensive) — only lowercase letters,
 * digits, dots, hyphens and underscores survive; max 64 chars.
 *
 * No-ops if there's no `ref` in the URL or storage is unavailable. We
 * intentionally do NOT strip the ref from the URL — leaving it visible
 * helps debugging and means a back-button refresh still works.
 */
const STORAGE_KEY = "pp-ref";
const MAX_LEN = 64;
const ALLOWED = /^[a-z0-9._-]+$/;

export function useReferralCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("ref");
      if (!raw) return;
      const cleaned = raw.trim().toLowerCase().slice(0, MAX_LEN);
      if (!ALLOWED.test(cleaned)) return;
      // Don't clobber an existing ref — first attribution wins, otherwise a
      // user clicking around multiple embeds before paying would overwrite
      // the original source.
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return;
      localStorage.setItem(STORAGE_KEY, cleaned);
    } catch {
      // Quota or privacy-mode — silently skip.
    }
  }, []);
}
