import { useCallback, useSyncExternalStore } from "react";
import { prewarmGuidance } from "@/lib/api";
import { PATCH_KEYS, getActivePatchId, onActiveChange } from "@/hooks/usePatches";

/**
 * Region hook — now sourced from the *active patch*'s region slot.
 *
 * The public API is unchanged ({ region, setRegion, clearRegion, defaultRegion })
 * so every existing call site (Header, Calendar, GuidanceView, etc.) keeps
 * working with no edits. Under the hood we read/write
 *   localStorage[`patchpot.patch.<active_id>.region.v1`]
 * which means switching patches automatically swaps the region, and saving
 * a new region only writes into the currently active patch.
 */

const DEFAULT_REGION = {
  name: "London",
  country: "United Kingdom",
  latitude: 51.5074,
  longitude: -0.1278,
  climate_zone: "Temperate",
  hemisphere: "northern",
};

function activeKey() {
  const id = getActivePatchId();
  return id ? PATCH_KEYS.region(id) : null;
}

function readActiveRegion() {
  const key = activeKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const listeners = new Set();
let current = (typeof window !== "undefined") ? readActiveRegion() : null;

function emit() { listeners.forEach((l) => l()); }
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot() { return current; }
function getServerSnapshot() { return null; }

// Re-load whenever the active patch flips so consumers re-render with the
// freshly-active patch's region.
if (typeof window !== "undefined") {
  onActiveChange(() => {
    current = readActiveRegion();
    emit();
  });
}

export function useRegion() {
  const region = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setRegion = useCallback((next) => {
    const key = activeKey();
    if (!key) return;
    current = next;
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
    } catch (e) {
      console.warn("useRegion: persist failed", e);
    }
    emit();
    // Fire-and-forget cache prewarm.
    if (next) {
      try {
        const month = new Date().getMonth() + 1;
        const lang = (typeof localStorage !== "undefined"
          && localStorage.getItem("patchpot.lang.v1"))
          || "en";
        prewarmGuidance(next, month, lang);
      } catch (e) { /* never block region-set on prewarm */ }
    }
  }, []);

  const clearRegion = useCallback(() => {
    const key = activeKey();
    if (!key) return;
    current = null;
    try { localStorage.removeItem(key); }
    catch (e) { console.warn("useRegion: clear failed", e); }
    emit();
  }, []);

  return { region, setRegion, clearRegion, defaultRegion: DEFAULT_REGION };
}

// Cross-tab sync — listen for changes to *any* patch region key; only
// re-emit when the change matches our active patch.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith("patchpot.patch.")) return;
    if (e.key !== activeKey()) return;
    try {
      current = e.newValue ? JSON.parse(e.newValue) : null;
    } catch {
      current = null;
    }
    emit();
  });
}
