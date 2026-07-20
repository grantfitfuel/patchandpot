/**
 * Small hook that answers: "does the current-month Calm audio exist,
 * AND has this browser already marked it as played?"  Used by the
 * header to show a subtle 'new' pill next to the 2-Minute Calm nav
 * item. Once the user plays (or manually marks played), the pill
 * quiets down for the rest of the month.
 *
 * State lives entirely in localStorage under a single key per slug,
 * mirroring how the rest of the app treats non-critical UI prefs.
 */
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API } from "@/lib/api";
import { useRegion } from "@/hooks/useRegion";

const STORE_KEY = "patchpot.calm.played.v1"; // { [slug]: true }

function readPlayed() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePlayed(next) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — non-critical */
  }
}

export function useCalmPill() {
  const { region } = useRegion();
  const hemisphere = region?.hemisphere === "southern" ? "sh" : "nh";
  const [slug, setSlug] = useState(null);
  const [available, setAvailable] = useState(false);

  // Fetch current-month slug lazily. This lives in the header so any
  // failure must fail SILENT — the pill just stays off. We never let
  // this block header render.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await axios.get(`${API}/calm/current`, {
          params: { hemisphere }, timeout: 5000,
        });
        if (!alive || !r.data?.slug) return;
        setSlug(r.data.slug);
        // Only surface the pill if the audio is actually ready — a
        // "not_yet_authored" flag means we shouldn't tease it.
        setAvailable(!!r.data.audio_generated || !r.data.not_yet_authored);
      } catch {
        // fail silent
      }
    })();
    return () => { alive = false; };
  }, [hemisphere]);

  const [played, setPlayedMap] = useState(readPlayed);

  const isUnread = available && slug && !played[slug];

  const markPlayed = useCallback((forSlug) => {
    const target = forSlug || slug;
    if (!target) return;
    const next = { ...readPlayed(), [target]: true };
    writePlayed(next);
    setPlayedMap(next);
  }, [slug]);

  return { slug, available, isUnread, markPlayed };
}
