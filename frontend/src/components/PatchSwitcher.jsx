import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, ChevronDown, Plus, Check, Settings, Lock } from "lucide-react";
import { usePatches, FREE_PATCH_LIMIT } from "@/hooks/usePatches";
import { useRegion } from "@/hooks/useRegion";
import { usePaywall } from "@/hooks/usePaywall";
import RegionPicker from "@/components/RegionPicker";
import PaywallModal from "@/components/PaywallModal";
import { useI18n } from "@/i18n";

/**
 * Header pill that shows the active patch + its region and exposes a
 * dropdown for switching between patches, adding a new one, or jumping
 * to /garden for full management. Replaces the old single-region pill.
 *
 * Behaviour summary:
 *  - Click the pill → dropdown opens; pick a patch to switch to it.
 *  - "Set / change region" → opens the region picker, writes into the
 *    currently active patch (so the existing single-patch flow still works).
 *  - "Add another patch" → opens the region picker in onPick mode, then
 *    creates a brand-new patch with the chosen region's name and switches
 *    to it. Hidden / replaced with paywall CTA when the free cap is hit.
 *  - "Manage patches" → /garden, which renders the tab strip + rename /
 *    remove controls.
 */
export default function PatchSwitcher() {
  const { paid, patchLimit, refresh: refreshPaywall } = usePaywall();
  // `patchLimit` is server-authoritative (5 free / 25 paid); fall back to the
  // free cap on first paint before /api/access/check returns.
  const { patches, activePatchId, activePatch, setActivePatch, addPatch, canAdd, limit } =
    usePatches(patchLimit);
  const { region, setRegion } = useRegion();
  const { t } = useI18n();

  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  // pickerMode = "set_active" → write region to current active patch
  // pickerMode = "add_patch"  → create a new patch with the chosen region
  const [pickerMode, setPickerMode] = useState("set_active");
  const dropdownRef = useRef(null);

  // Close menu on outside click. We only attach the listener while open so
  // the rest of the app doesn't pay for an idle global handler.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDoc(e) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKey(e) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function openSetActiveRegion() {
    setPickerMode("set_active");
    setPickerOpen(true);
    setMenuOpen(false);
  }

  function openAddPatch() {
    if (!canAdd) {
      // Free tier cap reached → invite to upgrade instead of silently
      // dropping the click. Paid users hitting the 25 cap fall through to
      // the disabled-button copy.
      if (!paid && patches.length >= FREE_PATCH_LIMIT) {
        setPaywallOpen(true);
        setMenuOpen(false);
        return;
      }
      return;
    }
    setPickerMode("add_patch");
    setPickerOpen(true);
    setMenuOpen(false);
  }

  function onRegionPicked(nextRegion) {
    if (pickerMode === "add_patch") {
      // Auto-name from the region; the My Garden page lets users rename later.
      const id = addPatch(nextRegion?.name || "New patch");
      if (id) {
        // addPatch() already flips active_id; that change cascades to
        // useRegion via onActiveChange. Now write the picked region into
        // the freshly active patch.
        // setRegion writes to whatever is currently active, which is now
        // the new patch (post-active swap), so this is correct.
        setRegion(nextRegion);
      }
    }
    // For "set_active", RegionPicker has already called setRegion via its
    // default path (no onPick override). Nothing else to do here.
  }

  const triggerLabel =
    activePatch ? activePatch.name : t("region.set");
  const triggerSubLabel = region ? region.name : t("region.set");

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        data-testid="patch-switcher-trigger"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex items-center gap-2 text-sm text-forest border border-forest/30 px-3 py-2 hover:bg-forest/5 transition-colors"
      >
        <MapPin strokeWidth={1.5} className="w-4 h-4" />
        <span className="hidden sm:flex flex-col items-start leading-tight text-left">
          <span className="font-medium">{triggerLabel}</span>
          {region && triggerSubLabel !== triggerLabel && (
            <span className="text-[10px] text-moss">{triggerSubLabel}</span>
          )}
        </span>
        <span className="sm:hidden">{triggerLabel}</span>
        <ChevronDown strokeWidth={1.5} className={`w-3.5 h-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          data-testid="patch-switcher-menu"
          className="absolute right-0 mt-2 w-72 bg-surface border border-border shadow-xl z-50"
        >
          <div className="px-4 pt-4 pb-2">
            <p className="overline">Your patches · {patches.length} of {limit}</p>
          </div>
          <ul className="py-1">
            {patches.map((p) => {
              const isActive = p.id === activePatchId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setActivePatch(p.id); setMenuOpen(false); }}
                    data-testid={`patch-switcher-item-${p.id}`}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm hover:bg-sand/60 transition-colors ${
                      isActive ? "bg-sand/40 text-forest font-medium" : "text-ink/80"
                    }`}
                  >
                    {isActive ? (
                      <Check strokeWidth={2} className="w-4 h-4 text-terracotta flex-shrink-0" />
                    ) : (
                      <span className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{p.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border my-1" />
          <button
            type="button"
            onClick={openSetActiveRegion}
            data-testid="patch-switcher-change-region"
            className="w-full text-left px-4 py-2.5 text-sm text-ink/80 hover:bg-sand/60 flex items-center gap-2"
          >
            <MapPin strokeWidth={1.5} className="w-4 h-4 text-moss" />
            {region ? `Change region for "${activePatch?.name}"` : "Set this patch's region"}
          </button>
          {canAdd ? (
            <button
              type="button"
              onClick={openAddPatch}
              data-testid="patch-switcher-add"
              className="w-full text-left px-4 py-2.5 text-sm text-forest hover:bg-sand/60 flex items-center gap-2 font-medium"
            >
              <Plus strokeWidth={1.7} className="w-4 h-4 text-terracotta" />
              Add another patch
            </button>
          ) : !paid ? (
            <button
              type="button"
              onClick={openAddPatch}
              data-testid="patch-switcher-upgrade"
              className="w-full text-left px-4 py-3 text-sm text-forest hover:bg-sand/60 flex items-start gap-2 font-medium bg-sand/40 border-y border-border"
            >
              <Lock strokeWidth={1.6} className="w-4 h-4 text-terracotta mt-0.5 flex-shrink-0" />
              <span className="leading-snug">
                Unlock up to 25 patches
                <span className="block text-[11px] text-moss font-normal mt-0.5">
                  Included with any Patch &amp; Pot membership
                </span>
              </span>
            </button>
          ) : (
            <div
              data-testid="patch-switcher-limit"
              className="px-4 py-2.5 text-xs text-moss leading-relaxed"
            >
              You&apos;ve reached the {limit}-patch limit. Email
              {" "}<a href="mailto:hello@patchandpot.com" className="underline-offset-4 hover:underline text-forest">hello@patchandpot.com</a>
              {" "}if you need more.
            </div>
          )}
          <Link
            to="/garden"
            onClick={() => setMenuOpen(false)}
            data-testid="patch-switcher-manage"
            className="block px-4 py-2.5 text-xs text-moss hover:bg-sand/60 border-t border-border"
          >
            <span className="inline-flex items-center gap-1.5">
              <Settings strokeWidth={1.4} className="w-3.5 h-3.5" />
              Manage patches (rename, delete)
            </span>
          </Link>
        </div>
      )}

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
            // Pull the new patchLimit from /api/access/check so the cap
            // lifts immediately without a page reload.
            refreshPaywall();
          }}
        />
      )}
    </div>
  );
}
