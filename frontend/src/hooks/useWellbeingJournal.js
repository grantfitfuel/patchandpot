/**
 * Per-patch wellbeing journal.
 *
 * A small mood + gratitude check-in stored alongside the active patch's
 * other localStorage data. Each entry is `{ date, mood (1-5), note }`.
 * Lives entirely client-side — no PII ever reaches the server.
 *
 * Storage shape (per patch):
 *   patchpot.patch.<active_id>.wellbeing.v1 = [
 *     { date: "YYYY-MM-DD", mood: 4, note: "Picked first courgette." },
 *     ...
 *   ]
 *
 * Public hook API mirrors useMyGarden — list + add/remove + has-today.
 */
import { useCallback, useEffect, useState } from "react";
import { PATCH_KEYS, getActivePatchId, onActiveChange } from "@/hooks/usePatches";

function patchKey(id) {
  return id ? `patchpot.patch.${id}.wellbeing.v1` : null;
}

function readJournal() {
  const id = getActivePatchId();
  const k = patchKey(id);
  if (!k) return [];
  try {
    return JSON.parse(localStorage.getItem(k) || "[]");
  } catch {
    return [];
  }
}

function writeJournal(entries) {
  const id = getActivePatchId();
  const k = patchKey(id);
  if (!k) return;
  try {
    localStorage.setItem(k, JSON.stringify(entries));
  } catch (e) {
    console.warn("useWellbeingJournal: persist failed", e);
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Re-export the namespaced storage-key helper so callers building exports
// or PDFs can resolve a specific patch's journal slot without subscribing
// to React state.
export const WELLBEING_KEY = (id) => `patchpot.patch.${id}.wellbeing.v1`;

export function useWellbeingJournal() {
  const [entries, setEntries] = useState(() => readJournal());

  // Re-sync when the user switches active patch.
  useEffect(() => {
    const off = onActiveChange(() => setEntries(readJournal()));
    return () => off();
  }, []);

  // Persist on change. (We intentionally skip the very first render's write
  // because readJournal returned the canonical value already.)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrated) { setHydrated(true); return; }
    writeJournal(entries);
  }, [entries, hydrated]);

  const addEntry = useCallback(({ mood, note }) => {
    const safeMood = Math.max(1, Math.min(5, Number(mood) || 3));
    const safeNote = (note || "").trim().slice(0, 280);
    setEntries((prev) => {
      const date = todayISO();
      const without = prev.filter((e) => e.date !== date);
      // One entry per day per patch; latest wins. Newest first for display.
      return [{ date, mood: safeMood, note: safeNote }, ...without];
    });
  }, []);

  const removeEntry = useCallback((date) => {
    setEntries((prev) => prev.filter((e) => e.date !== date));
  }, []);

  const today = entries.find((e) => e.date === todayISO()) || null;

  return { entries, today, addEntry, removeEntry };
}
