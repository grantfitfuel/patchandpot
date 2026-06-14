import { useCallback, useEffect, useState } from "react";

const KEY = "patchpot.region.v1";

const DEFAULT_REGION = {
  name: "London",
  country: "United Kingdom",
  latitude: 51.5074,
  longitude: -0.1278,
  climate_zone: "Temperate",
  hemisphere: "northern",
};

export function useRegion() {
  const [region, setRegionState] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (region) {
      localStorage.setItem(KEY, JSON.stringify(region));
    }
  }, [region]);

  const setRegion = useCallback((next) => {
    setRegionState(next);
  }, []);

  const clearRegion = useCallback(() => {
    localStorage.removeItem(KEY);
    setRegionState(null);
  }, []);

  return { region, setRegion, clearRegion, defaultRegion: DEFAULT_REGION };
}
