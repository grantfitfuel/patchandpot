import { useCallback, useEffect, useState } from "react";
import { PATCH_KEYS, getActivePatchId, onActiveChange } from "@/hooks/usePatches";

/**
 * Plant list + per-month task completion — both scoped to the active patch.
 *
 * Public API is unchanged from the pre-patches single-garden version. Under
 * the hood we read/write the namespaced keys
 *   patchpot.patch.<active_id>.garden.v1
 *   patchpot.patch.<active_id>.tasks.v1
 * and re-mount our state when the active patch flips, so switching from
 * "Home" to "Cottage" instantly swaps both the plant grid and the
 * checked-task state.
 */

function readGarden() {
  const id = getActivePatchId();
  if (!id) return [];
  try {
    return JSON.parse(localStorage.getItem(PATCH_KEYS.garden(id)) || "[]");
  } catch {
    return [];
  }
}

function writeGarden(plants) {
  const id = getActivePatchId();
  if (!id) return;
  try {
    localStorage.setItem(PATCH_KEYS.garden(id), JSON.stringify(plants));
  } catch (e) {
    console.warn("useMyGarden: persist failed", e);
  }
}

export function useMyGarden() {
  const [plants, setPlants] = useState(() => readGarden());

  // Re-sync from the new patch's storage when the active patch changes.
  useEffect(() => {
    const off = onActiveChange(() => setPlants(readGarden()));
    return () => off();
  }, []);

  // Persist whenever the local list changes — scoped to the current active
  // patch (whichever patch is active at the time of the write).
  useEffect(() => {
    writeGarden(plants);
  }, [plants]);

  const addPlant = useCallback((plant) => {
    setPlants((prev) =>
      prev.find((p) => p.id === plant.id) ? prev : [...prev, { ...plant, added_at: new Date().toISOString() }]
    );
  }, []);

  const removePlant = useCallback((id) => {
    setPlants((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const has = useCallback((id) => plants.some((p) => p.id === id), [plants]);

  return { plants, addPlant, removePlant, has };
}

function readTasksAll() {
  const id = getActivePatchId();
  if (!id) return {};
  try {
    return JSON.parse(localStorage.getItem(PATCH_KEYS.tasks(id)) || "{}");
  } catch {
    return {};
  }
}

function writeTasksAll(all) {
  const id = getActivePatchId();
  if (!id) return;
  try {
    localStorage.setItem(PATCH_KEYS.tasks(id), JSON.stringify(all));
  } catch (e) {
    console.warn("useCompletedTasks: persist failed", e);
  }
}

export function useCompletedTasks(monthKey) {
  const [completed, setCompleted] = useState(() => {
    const all = readTasksAll();
    return all[monthKey] || {};
  });

  // Persist on change.
  useEffect(() => {
    const all = readTasksAll();
    all[monthKey] = completed;
    writeTasksAll(all);
  }, [completed, monthKey]);

  // Re-load when month changes.
  useEffect(() => {
    const all = readTasksAll();
    setCompleted(all[monthKey] || {});
  }, [monthKey]);

  // Re-load when the active patch changes.
  useEffect(() => {
    const off = onActiveChange(() => {
      const all = readTasksAll();
      setCompleted(all[monthKey] || {});
    });
    return () => off();
  }, [monthKey]);

  const toggle = useCallback((taskId) => {
    setCompleted((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  return { completed, toggle };
}
