/**
 * Paywall hook. Reads the access token from localStorage, validates it once
 * against the backend (which checks our access_grants Mongo collection), and
 * exposes { paid, loading, refresh }.
 *
 * The token is the Stripe Checkout session_id — purchase proof and access key
 * in one. No traditional accounts, no passwords.
 */
import { useCallback, useEffect, useState } from "react";
import { checkAccess } from "@/lib/api";

const TOKEN_KEY = "patchpot.access.v1";
const CACHE_KEY = "patchpot.access.paid.v1";

export function getStoredAccessToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (e) {
    console.warn("usePaywall: read token failed", e);
    return "";
  }
}

export function setStoredAccessToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(CACHE_KEY, "1");
  } catch (e) {
    console.warn("usePaywall: persist token failed", e);
  }
}

export function clearStoredAccessToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.warn("usePaywall: clear token failed", e);
  }
}

// Free-tier patch cap. The server (POST /api/access/check) returns the
// authoritative current limit; this constant is the optimistic fallback we
// use before the first verify() returns.
const FREE_PATCH_LIMIT = 5;

export function usePaywall() {
  // Cheap optimistic state from cache so paid users never see a flash of paywall.
  const [paid, setPaid] = useState(() => {
    try { return localStorage.getItem(CACHE_KEY) === "1"; }
    catch (e) { console.warn("usePaywall: read cache failed", e); return false; }
  });
  const [loading, setLoading] = useState(true);
  const [patchLimit, setPatchLimit] = useState(FREE_PATCH_LIMIT);

  const verify = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setPaid(false);
      setPatchLimit(FREE_PATCH_LIMIT);
      setLoading(false);
      return;
    }
    try {
      const res = await checkAccess(token);
      setPaid(!!res.paid);
      // Server is the source of truth for the cap. Fall back to free cap
      // if the field is missing (older deploys before this endpoint update).
      setPatchLimit(typeof res.patch_limit === "number" ? res.patch_limit : FREE_PATCH_LIMIT);
      if (res.paid) {
        try { localStorage.setItem(CACHE_KEY, "1"); }
        catch (e) { console.warn("usePaywall: persist cache failed", e); }
      } else {
        // Token in storage but server says no — clear so we don't keep retrying.
        clearStoredAccessToken();
      }
    } catch (e) {
      // Network glitch — trust the optimistic value, don't lock paid users out.
      console.warn("usePaywall: verify failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { verify(); }, [verify]);

  return { paid, loading, patchLimit, refresh: verify };
}
