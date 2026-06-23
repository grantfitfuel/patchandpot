/**
 * Multi-patch store — the source of truth for which "garden" (= region +
 * plant list + per-month task completion) the user is currently viewing.
 *
 * A "patch" is intentionally not just a region: each patch carries its own
 * plant list and its own per-month task completion. That means "Home" and
 * "Holiday cottage" can sit side by side without their To-Dos or My Garden
 * lists ever crossing wires.
 *
 * Storage layout
 * --------------
 *   patchpot.patches.v1
 *     { version: 1, active_id, patches: [{ id, name, created_at }] }
 *
 *   patchpot.patch.<id>.region.v1   ← consumed by useRegion()
 *   patchpot.patch.<id>.garden.v1   ← consumed by useMyGarden()
 *   patchpot.patch.<id>.tasks.v1    ← consumed by useCompletedTasks()
 *
 * Migration of pre-patch users
 * ----------------------------
 * If `patchpot.patches.v1` is absent on first read AND any of the legacy
 * keys (`patchpot.region.v1`, `patchpot.garden.v1`, `patchpot.tasks.v1`)
 * exist, we move them under a single newly-created patch (auto-named after
 * the existing region, or "Home" if none) and delete the legacy keys.
 * The user's data appears identical to them — they just gain the ability
 * to add a second patch.
 *
 * The store is a module-level singleton (same useSyncExternalStore pattern
 * as useRegion v2) so every consumer re-renders the instant the active
 * patch changes — including across tabs via the `storage` event.
 */
import { useCallback, useSyncExternalStore } from "react";

const INDEX_KEY = "patchpot.patches.v1";
// Free-tier upper bound. Paid users get PAID_PATCH_LIMIT (25, set on the
// server). usePatches() accepts a runtime `limit` arg from each caller —
// see PatchSwitcher / PatchTabStrip which read it from usePaywall().
export const FREE_PATCH_LIMIT = 5;
export const PAID_PATCH_LIMIT = 25;
// Kept exported under the old name so existing imports compiling against
// `MAX_PATCHES` keep working — it now reflects the free-tier cap only.
export const MAX_PATCHES = FREE_PATCH_LIMIT;

const LEGACY_KEYS = {
  region: "patchpot.region.v1",
  garden: "patchpot.garden.v1",
  tasks: "patchpot.tasks.v1",
};

function patchRegionKey(id) { return `patchpot.patch.${id}.region.v1`; }
function patchGardenKey(id) { return `patchpot.patch.${id}.garden.v1`; }
function patchTasksKey(id) { return `patchpot.patch.${id}.tasks.v1`; }

// Exported so other hooks (useRegion / useMyGarden / useCompletedTasks)
// can resolve the active patch's namespaced localStorage key.
export const PATCH_KEYS = {
  region: patchRegionKey,
  garden: patchGardenKey,
  tasks: patchTasksKey,
};

// Read a specific patch's stored region directly from localStorage. Used
// by the Compare view, which renders two patches side by side and needs
// regions for each one (not just the currently active patch's).
export function readPatchRegion(patchId) {
  if (!patchId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PATCH_KEYS.region(patchId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function newId() {
  // Short, sortable-ish, collision-safe enough for client-only IDs.
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("usePatches: persist failed for", key, e);
  }
}

function safeRemove(key) {
  try { localStorage.removeItem(key); }
  catch (e) { console.warn("usePatches: remove failed for", key, e); }
}

function migrateLegacy() {
  // Returns the freshly-built index, or null if nothing legacy to migrate.
  const legacyRegion = safeRead(LEGACY_KEYS.region);
  const legacyGarden = safeRead(LEGACY_KEYS.garden);
  const legacyTasks = safeRead(LEGACY_KEYS.tasks);

  if (!legacyRegion && !legacyGarden && !legacyTasks) return null;

  const id = newId();
  const name = (legacyRegion && legacyRegion.name) || "Home";
  const created_at = new Date().toISOString();

  if (legacyRegion) safeWrite(patchRegionKey(id), legacyRegion);
  if (legacyGarden) safeWrite(patchGardenKey(id), legacyGarden);
  if (legacyTasks) safeWrite(patchTasksKey(id), legacyTasks);

  // Delete legacy global keys so we never accidentally double-read.
  safeRemove(LEGACY_KEYS.region);
  safeRemove(LEGACY_KEYS.garden);
  safeRemove(LEGACY_KEYS.tasks);

  const index = {
    version: 1,
    active_id: id,
    patches: [{ id, name, created_at }],
  };
  safeWrite(INDEX_KEY, index);
  return index;
}

function bootstrapEmpty() {
  // No patches at all — create a default "Home" patch so the UI always has
  // an active patch. (Region within it is initially null and the first
  // RegionPicker pick fills it in.)
  const id = newId();
  const index = {
    version: 1,
    active_id: id,
    patches: [{ id, name: "Home", created_at: new Date().toISOString() }],
  };
  safeWrite(INDEX_KEY, index);
  return index;
}

function loadIndex() {
  const existing = safeRead(INDEX_KEY);
  if (existing && Array.isArray(existing.patches) && existing.patches.length > 0) {
    // Repair: active_id might point at a deleted patch (corruption / hand-edit).
    if (!existing.patches.find((p) => p.id === existing.active_id)) {
      existing.active_id = existing.patches[0].id;
      safeWrite(INDEX_KEY, existing);
    }
    return existing;
  }
  const migrated = migrateLegacy();
  if (migrated) return migrated;
  return bootstrapEmpty();
}

// ── Module-level singleton store ────────────────────────────────────────
let current = (typeof window !== "undefined") ? loadIndex() : { version: 1, active_id: "", patches: [] };
const listeners = new Set();
function emit() { listeners.forEach((l) => l()); }
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot() { return current; }
function getServerSnapshot() { return { version: 1, active_id: "", patches: [] }; }

// Public read-only helper used by sibling hooks to resolve the active id
// without having to bind useSyncExternalStore in non-React code paths.
export function getActivePatchId() {
  return current.active_id || "";
}

// Notifier callback every time the active patch changes (consumed by
// sibling hooks so they can re-emit their own state).
const activeChangeListeners = new Set();
export function onActiveChange(fn) {
  activeChangeListeners.add(fn);
  return () => activeChangeListeners.delete(fn);
}

function update(nextIndex) {
  const prevActive = current.active_id;
  current = nextIndex;
  safeWrite(INDEX_KEY, current);
  emit();
  if (prevActive !== current.active_id) {
    activeChangeListeners.forEach((f) => { try { f(); } catch (e) { console.warn(e); } });
  }
}

export function usePatches(limit = FREE_PATCH_LIMIT) {
  const index = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setActivePatch = useCallback((id) => {
    if (!current.patches.find((p) => p.id === id)) return;
    if (current.active_id === id) return;
    update({ ...current, active_id: id });
  }, []);

  const addPatch = useCallback((name) => {
    if (current.patches.length >= limit) return null;
    const id = newId();
    // Sanitise + dedupe against existing names. If the user picks "Home"
    // a second time we silently rename it to "Home (2)" (then 3, 4, …)
    // so the dropdown / tab strip never shows two patches with the
    // identical label, which is otherwise impossible to disambiguate.
    const baseRaw = (name || "").trim().slice(0, 30) || "New patch";
    const existing = new Set(current.patches.map((p) => p.name));
    let safeName = baseRaw;
    let suffix = 2;
    while (existing.has(safeName)) {
      const tail = ` (${suffix})`;
      safeName = baseRaw.slice(0, 30 - tail.length) + tail;
      suffix += 1;
    }
    const next = {
      ...current,
      active_id: id,
      patches: [...current.patches, { id, name: safeName, created_at: new Date().toISOString() }],
    };
    update(next);
    return id;
  }, [limit]);

  const renamePatch = useCallback((id, name) => {
    const safeName = (name || "").trim().slice(0, 30);
    if (!safeName) return;
    const next = {
      ...current,
      patches: current.patches.map((p) => (p.id === id ? { ...p, name: safeName } : p)),
    };
    update(next);
  }, []);

  const removePatch = useCallback((id) => {
    if (current.patches.length <= 1) return; // refuse to delete the last
    const remaining = current.patches.filter((p) => p.id !== id);
    const next = {
      ...current,
      patches: remaining,
      active_id: current.active_id === id ? remaining[0].id : current.active_id,
    };
    // Free the patch's storage slots.
    safeRemove(patchRegionKey(id));
    safeRemove(patchGardenKey(id));
    safeRemove(patchTasksKey(id));
    update(next);
  }, []);

  const activePatch = index.patches.find((p) => p.id === index.active_id) || null;

  return {
    patches: index.patches,
    activePatchId: index.active_id,
    activePatch,
    setActivePatch,
    addPatch,
    renamePatch,
    removePatch,
    canAdd: index.patches.length < limit,
    limit,
    MAX_PATCHES: limit, // back-compat alias for legacy callers
  };
}

// Cross-tab sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== INDEX_KEY) return;
    try {
      const next = e.newValue ? JSON.parse(e.newValue) : null;
      if (next && Array.isArray(next.patches)) {
        const prevActive = current.active_id;
        current = next;
        emit();
        if (prevActive !== next.active_id) {
          activeChangeListeners.forEach((f) => { try { f(); } catch (err) { console.warn(err); } });
        }
      }
    } catch {
      /* ignore corrupt write from another tab */
    }
  });
}
