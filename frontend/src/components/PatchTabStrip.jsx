import { useState } from "react";
import { Edit3, Trash2, Check, X, Plus, MapPin, AlertCircle } from "lucide-react";
import { usePatches } from "@/hooks/usePatches";
import { useRegion } from "@/hooks/useRegion";
import RegionPicker from "@/components/RegionPicker";

/**
 * Tab strip + management bar for the user's gardening "patches".
 *
 * Rendered at the top of /garden. Each tab switches the active patch
 * (causing useRegion + useMyGarden + useCompletedTasks to swap to that
 * patch's stored data). Inline rename + a guarded delete sit alongside.
 */
export default function PatchTabStrip() {
  const {
    patches, activePatchId, activePatch, setActivePatch,
    addPatch, renamePatch, removePatch, canAdd, MAX_PATCHES,
  } = usePatches();
  const { region, setRegion } = useRegion();

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState("set_active");

  function startRename() {
    setDraftName(activePatch?.name || "");
    setRenaming(true);
  }
  function commitRename(e) {
    e?.preventDefault();
    if (draftName.trim()) renamePatch(activePatchId, draftName.trim());
    setRenaming(false);
  }
  function cancelRename() {
    setRenaming(false);
    setDraftName("");
  }

  function openSetRegion() {
    setPickerMode("set_active");
    setPickerOpen(true);
  }
  function openAddPatch() {
    if (!canAdd) return;
    setPickerMode("add_patch");
    setPickerOpen(true);
  }
  function onRegionPicked(next) {
    if (pickerMode === "add_patch") {
      const id = addPatch(next?.name || "New patch");
      if (id) setRegion(next);
    }
  }

  function doDelete() {
    if (patches.length <= 1) return;
    removePatch(activePatchId);
    setConfirmDelete(false);
  }

  return (
    <div className="mb-10 border-b border-border" data-testid="patch-tabstrip">
      <div className="flex items-end gap-1 overflow-x-auto -mb-px">
        {patches.map((p) => {
          const active = p.id === activePatchId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => { setActivePatch(p.id); setRenaming(false); setConfirmDelete(false); }}
              data-testid={`patch-tab-${p.id}`}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? "border-terracotta text-forest font-medium"
                  : "border-transparent text-ink/65 hover:text-forest"
              }`}
            >
              {p.name}
            </button>
          );
        })}
        {canAdd && (
          <button
            type="button"
            onClick={openAddPatch}
            data-testid="patch-tab-add"
            className="px-3 py-2.5 text-sm text-forest hover:bg-sand/60 border-b-2 border-transparent inline-flex items-center gap-1.5"
          >
            <Plus strokeWidth={1.7} className="w-4 h-4 text-terracotta" />
            Add patch
          </button>
        )}
      </div>

      {/* Per-patch toolbar */}
      <div className="pt-3 pb-4 flex flex-wrap items-center gap-3">
        {!renaming ? (
          <button
            type="button"
            onClick={startRename}
            data-testid="patch-rename-btn"
            className="text-xs text-moss hover:text-forest underline-offset-4 hover:underline inline-flex items-center gap-1.5"
          >
            <Edit3 strokeWidth={1.5} className="w-3.5 h-3.5" />
            Rename
          </button>
        ) : (
          <form onSubmit={commitRename} className="inline-flex items-center gap-2" data-testid="patch-rename-form">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={30}
              autoFocus
              data-testid="patch-rename-input"
              className="px-2 py-1 text-sm bg-surface border border-border focus:border-terracotta focus:outline-none"
            />
            <button
              type="submit"
              data-testid="patch-rename-save"
              className="text-forest hover:text-terracotta"
              aria-label="Save"
            >
              <Check strokeWidth={1.8} className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={cancelRename}
              className="text-ink/60 hover:text-forest"
              aria-label="Cancel"
            >
              <X strokeWidth={1.5} className="w-4 h-4" />
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={openSetRegion}
          data-testid="patch-region-btn"
          className="text-xs text-moss hover:text-forest underline-offset-4 hover:underline inline-flex items-center gap-1.5"
        >
          <MapPin strokeWidth={1.5} className="w-3.5 h-3.5" />
          {region ? `Region: ${region.name}` : "Set region"}
        </button>

        {patches.length > 1 && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            data-testid="patch-delete-btn"
            className="text-xs text-terracotta hover:text-terracotta/80 underline-offset-4 hover:underline inline-flex items-center gap-1.5 ml-auto"
          >
            <Trash2 strokeWidth={1.5} className="w-3.5 h-3.5" />
            Delete this patch
          </button>
        )}
        {confirmDelete && (
          <div
            className="ml-auto inline-flex items-center gap-2 text-xs text-terracotta bg-terracotta/10 border border-terracotta/30 px-3 py-1.5"
            data-testid="patch-delete-confirm"
          >
            <AlertCircle strokeWidth={1.5} className="w-3.5 h-3.5" />
            Delete &ldquo;{activePatch?.name}&rdquo; and its plants/tasks?
            <button
              type="button"
              onClick={doDelete}
              data-testid="patch-delete-confirm-yes"
              className="font-medium underline-offset-4 hover:underline"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              data-testid="patch-delete-confirm-no"
              className="text-ink/60 hover:text-forest"
            >
              Cancel
            </button>
          </div>
        )}

        {!canAdd && (
          <p className="text-[11px] text-moss leading-relaxed w-full" data-testid="patch-limit-note">
            You&apos;ve reached the {MAX_PATCHES}-patch limit. Unlimited patches will be
            available later as part of the paid tier.
          </p>
        )}
      </div>

      <RegionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={pickerMode === "add_patch" ? onRegionPicked : undefined}
      />
    </div>
  );
}
