import { useCallback, useSyncExternalStore } from "react";

const KEY = "patchpot.region.v1";

const DEFAULT_REGION = {
  name: "London",
  country: "United Kingdom",
  latitude: 51.5074,
  longitude: -0.1278,
  climate_zone: "Temperate",
  hemisphere: "northern",
};

// Module-level singleton store so every component that calls useRegion()
// sees the same value and re-renders on change.
const listeners = new Set();
let current = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return current;
}

function getServerSnapshot() {
  return null;
}

export function useRegion() {
  const region = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setRegion = useCallback((next) => {
    current = next;
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage may be unavailable */
    }
    emit();
  }, []);

  const clearRegion = useCallback(() => {
    current = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    emit();
  }, []);

  return { region, setRegion, clearRegion, defaultRegion: DEFAULT_REGION };
}

// Listen for cross-tab changes so a region picked in another tab is reflected here too.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try {
      current = e.newValue ? JSON.parse(e.newValue) : null;
    } catch {
      current = null;
    }
    emit();
  });
}
