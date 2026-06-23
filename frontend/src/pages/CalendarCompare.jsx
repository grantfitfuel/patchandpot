import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Lock, MapPin } from "lucide-react";
import { usePatches, readPatchRegion } from "@/hooks/usePatches";
import { usePaywall } from "@/hooks/usePaywall";
import GuidanceView from "@/components/GuidanceView";
import MonthSelector from "@/components/MonthSelector";
import PaywallModal from "@/components/PaywallModal";
import { useI18n } from "@/i18n";

/**
 * Side-by-side comparison of two patches' monthly guidance.
 *
 * Free users:    column A is fully rendered; column B's data is fetched and
 *                rendered but the panel is blurred + overlaid with an
 *                "Unlock to compare patches" CTA. We deliberately render
 *                the real data underneath so the blur is honest social
 *                proof, not a decoy — the second the paywall lifts the
 *                blur drops with no extra request.
 * Paid users:    both columns picked freely from their patches (up to 25).
 *
 * On mobile the columns stack with a swap button between them.
 */
export default function CalendarComparePage() {
  const { paid, refresh: refreshPaywall } = usePaywall();
  const { patches, activePatchId } = usePatches();
  const { t } = useI18n();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Default selections: A = active patch; B = the next patch in the list,
  // or — if the user only has one patch — null (we render an empty-state).
  const initialA = activePatchId || (patches[0]?.id ?? "");
  const initialB = useMemo(() => {
    const others = patches.filter((p) => p.id !== initialA);
    return others[0]?.id ?? "";
  }, [patches, initialA]);

  const [aId, setAId] = useState(initialA);
  const [bId, setBId] = useState(initialB);

  const swap = () => { setAId(bId); setBId(aId); };

  const a = patches.find((p) => p.id === aId);
  const b = patches.find((p) => p.id === bId);
  const aRegion = a ? readPatchRegion(a.id) : null;
  const bRegion = b ? readPatchRegion(b.id) : null;

  // The empty-state is the only scenario where we don't render the dual
  // grid: 0 or 1 patch means there's literally nothing to compare yet.
  if (patches.length < 2) {
    return (
      <div className="container-narrow py-12 md:py-16 animate-fade-up">
        <Header month={month} setMonth={setMonth} t={t} />
        <div className="card-flat p-10 text-center" data-testid="compare-empty">
          <p className="text-moss">
            You only have one patch right now. Add a second patch — say a holiday
            cottage or an allotment — and come back here to see this month side
            by side.
          </p>
          <Link
            to="/garden"
            data-testid="compare-empty-cta"
            className="mt-6 inline-flex items-center gap-2 btn-terracotta"
          >
            Add another patch
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <Header month={month} setMonth={setMonth} t={t} />

      <div className="grid md:grid-cols-2 gap-8 relative" data-testid="compare-grid">
        <Column
          label="A"
          patches={patches}
          selectedId={aId}
          onSelect={setAId}
          region={aRegion}
          month={month}
          excludeId={bId}
        />

        {/* Swap pill — sits on the divider on desktop, between the columns
            on mobile. Tucked below the column headers so it doesn't fight
            with the per-column patch dropdowns. */}
        <button
          type="button"
          onClick={swap}
          data-testid="compare-swap"
          className="md:absolute md:left-1/2 md:top-20 md:-translate-x-1/2 mx-auto md:mx-0 inline-flex items-center gap-1.5 text-xs text-forest border border-forest/30 bg-sand px-3 py-1.5 hover:bg-forest/5 z-10"
          aria-label="Swap patches"
        >
          <ArrowLeftRight strokeWidth={1.5} className="w-3.5 h-3.5" />
          Swap
        </button>

        <div className="relative">
          <Column
            label="B"
            patches={patches}
            selectedId={bId}
            onSelect={setBId}
            region={bRegion}
            month={month}
            excludeId={aId}
          />
          {!paid && (
            <UpgradeOverlay onClick={() => setPaywallOpen(true)} />
          )}
        </div>
      </div>

      {paywallOpen && (
        <PaywallModal
          onClose={() => setPaywallOpen(false)}
          onUnlocked={() => { setPaywallOpen(false); refreshPaywall(); }}
        />
      )}
    </div>
  );
}

function Header({ month, setMonth, t }) {
  return (
    <>
      <div className="mb-10">
        <p className="overline">{t("calendar.eyebrow")} · Compare</p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
          Two patches, one month.
        </h1>
        <p className="mt-3 text-ink/75 max-w-xl">
          See exactly how each garden differs this month — what to sow, what to
          harvest, which pests to watch for — at a glance.
        </p>
      </div>
      <div className="mb-10">
        <MonthSelector month={month} onChange={setMonth} />
      </div>
    </>
  );
}

function Column({ label, patches, selectedId, onSelect, region, month, excludeId }) {
  return (
    <div className="space-y-6" data-testid={`compare-col-${label}`}>
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border">
        <span className="overline">Patch {label}</span>
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          data-testid={`compare-select-${label}`}
          className="text-sm bg-surface border border-border px-3 py-1.5 focus:border-terracotta focus:outline-none"
        >
          {patches
            .filter((p) => p.id === selectedId || p.id !== excludeId)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
      </div>

      {region ? (
        <>
          <p className="flex items-center gap-2 text-sm text-moss">
            <MapPin strokeWidth={1.5} className="w-4 h-4" />
            {region.name}{region.country ? `, ${region.country}` : ""}
          </p>
          <GuidanceView region={region} month={month} readOnly />
        </>
      ) : (
        <div className="card-flat p-10 text-center" data-testid={`compare-no-region-${label}`}>
          <p className="text-moss">
            This patch doesn&apos;t have a region yet.{" "}
            <Link to="/garden" className="underline-offset-4 underline text-forest">
              Set one
            </Link>{" "}to compare it here.
          </p>
        </div>
      )}
    </div>
  );
}

function UpgradeOverlay({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="compare-upgrade-overlay"
      className="absolute inset-0 backdrop-blur-md bg-sand/85 cursor-pointer transition-colors hover:bg-sand/80 group flex flex-col items-center pt-12 px-6"
    >
      {/* Compact CTA card sits at the top of the column so it's always
          visible above the fold. The blurred guidance underneath remains
          a hint of what's there without competing for the user's eye. */}
      <div className="flex flex-col items-center gap-3 text-center bg-surface/95 border border-border px-6 py-7 max-w-xs shadow-sm">
        <Lock strokeWidth={1.5} className="w-7 h-7 text-terracotta" />
        <p className="font-serif text-xl text-forest leading-snug">
          Unlock side-by-side compare
        </p>
        <p className="text-sm text-ink/70 leading-relaxed">
          Pick any two of your patches and see exactly what differs this month.
          Included with any Patch &amp; Pot membership.
        </p>
        <span className="mt-1 btn-terracotta inline-flex items-center gap-2 pointer-events-none group-hover:bg-forest transition-colors">
          Unlock to compare
        </span>
      </div>
    </button>
  );
}
