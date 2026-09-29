import { useState } from "react";
import { Edit3, Trash2, Check, X, Plus, MapPin, AlertCircle, Lock } from "lucide-react";
import { usePatches, FREE_PATCH_LIMIT } from "@/hooks/usePatches";
import { useRegion } from "@/hooks/useRegion";
import { usePaywall } from "@/hooks/usePaywall";
import RegionPicker from "@/components/RegionPicker";
import PaywallModal from "@/components/PaywallModal";
import { useI18n } from "@/i18n";

/**
 * Tab strip + management bar for the user's gardening "patches".
 *
 * Rendered at the top of /garden. Each tab switches the active patch
 * (causing useRegion + useMyGarden + useCompletedTasks to swap to that
 * patch's stored data). Inline rename + a guarded delete sit alongside.
 */
export default function PatchTabStrip() {
  const { paid, patchLimit, refresh: refreshPaywall } = usePaywall();
  const { t } = useI18n();
  const {
    patches, activePatchId, activePatch, setActivePatch,
    addPatch, renamePatch, removePatch, canAdd, limit,
  } = usePatches(patchLimit);
  const { region, setRegion } = useRegion();

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState("set_active");
  const [paywallOpen, setPaywallOpen] = useState(false);

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
    if (!canAdd) {
      if (!paid && patches.length >= FREE_PATCH_LIMIT) {
        setPaywallOpen(true);
        return;
      }
      return;
    }
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
        {canAdd ? (
          <button
            type="button"
            onClick={openAddPatch}
            data-testid="patch-tab-add"
            className="px-3 py-2.5 text-sm text-forest hover:bg-sand/60 border-b-2 border-transparent inline-flex items-center gap-1.5"
          >
            <Plus strokeWidth={1.7} className="w-4 h-4 text-terracotta" />
            {t("patch.add")}
          </button>
        ) : !paid ? (
          <button
            type="button"
            onClick={openAddPatch}
            data-testid="patch-tab-upgrade"
            className="px-3 py-2.5 text-sm text-forest hover:bg-sand/60 border-b-2 border-transparent inline-flex items-center gap-1.5 font-medium"
          >
            <Lock strokeWidth={1.6} className="w-4 h-4 text-terracotta" />
            {t("patch.unlock_short")}
          </button>
        ) : null}
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
            {t("patch.rename")}
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
              aria-label={t("patch.save")}
            >
              <Check strokeWidth={1.8} className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={cancelRename}
              className="text-ink/60 hover:text-forest"
              aria-label={t("patch.cancel")}
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
          {region ? t("patch.region_label", { name: region.name }) : t("patch.set_region")}
        </button>

        {patches.length > 1 && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            data-testid="patch-delete-btn"
            className="text-xs text-terracotta hover:text-terracotta/80 underline-offset-4 hover:underline inline-flex items-center gap-1.5 ml-auto"
          >
            <Trash2 strokeWidth={1.5} className="w-3.5 h-3.5" />
            {t("patch.delete")}
          </button>
        )}
        {confirmDelete && (
          <div
            className="ml-auto inline-flex items-center gap-2 text-xs text-terracotta bg-terracotta/10 border border-terracotta/30 px-3 py-1.5"
            data-testid="patch-delete-confirm"
          >
            <AlertCircle strokeWidth={1.5} className="w-3.5 h-3.5" />
            {t("patch.delete_confirm", { name: activePatch?.name || "" })}
            <button
              type="button"
              onClick={doDelete}
              data-testid="patch-delete-confirm-yes"
              className="font-medium underline-offset-4 hover:underline"
            >
              {t("patch.delete_yes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              data-testid="patch-delete-confirm-no"
              className="text-ink/60 hover:text-forest"
            >
              {t("patch.cancel")}
            </button>
          </div>
        )}

        {!canAdd && !paid && (
          <p className="text-[11px] text-moss leading-relaxed w-full" data-testid="patch-limit-note">
            {t("patch.limit_free_prefix", { limit: FREE_PATCH_LIMIT })}
            <button
              type="button"
              onClick={() => setPaywallOpen(true)}
              data-testid="patch-limit-upgrade-link"
              className="ml-1 underline-offset-4 underline text-forest hover:text-terracotta"
            >
              {t("patch.limit_free_link")}
            </button>
          </p>
        )}
        {!canAdd && paid && (
          <p className="text-[11px] text-moss leading-relaxed w-full" data-testid="patch-limit-note">
            {t("patch.limit_paid", { limit, email: "gcanth@gmail.com" })}
          </p>
        )}
      </div>

      <RegionPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={pickerMode === "add_patch" ? onRegionPicked : undefined}
      />
      {paywallOpen && (
        <PaywallModal
          onClose={() => setPaywallOpen(false)}
          onUnlocked={() => {
            setPaywallOpen(false);
            refreshPaywall();
          }}
        />
      )}
    </div>
  );
}
