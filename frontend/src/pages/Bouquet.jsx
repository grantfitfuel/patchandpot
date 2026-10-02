/**
 * /bouquet — "Bouquet from your patch".
 *
 * The one thing that separates this from every other flower-arrangement
 * app: we DO NOT guess what's in bloom from month + region. The user
 * has to confirm. So the flow is:
 *
 *   1. PICK       — user checks off plants they can actually cut today
 *   2. ARRANGE    — Claude Sonnet builds a real, small-batch arrangement
 *                   using ONLY the confirmed picks (via the existing
 *                   /api/arrangement/suggest endpoint)
 *   3. SHARE      — Nano-Banana paints a watercolour of the bouquet
 *                   using the same plant list, delivered as a share card
 *
 * The picker seeds itself from three sources, in priority order:
 *   a) plants already in the user's My Garden marked as cut_flower / flower
 *   b) the full cut-flower catalogue from /api/plants (fallback for new users)
 *   c) a freeform "Add another…" input so they can add foraged / weed / herb-flower
 *      stems that aren't in the catalogue at all
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Flower2, Check, Plus, RefreshCcw, Loader2, Sparkles,
  ArrowLeft, Share2, X,
} from "lucide-react";
import { fetchPlants, fetchArrangementSuggestion, fetchBouquetImage } from "@/lib/api";
import { useI18n } from "@/i18n";
import { useRegion } from "@/hooks/useRegion";
import { useMyGarden } from "@/hooks/useMyGarden";
import PageHero from "@/components/PageHero";
import { PoppyMotif } from "@/components/illustrations/VibrantMotifs";
import { formatApiError } from "@/lib/formatApiError";

const STEP_PICK = "pick";
const STEP_RESULT = "result";

export default function BouquetPage() {
  const { t, lang } = useI18n();
  const { region } = useRegion();
  const { plants: myGarden } = useMyGarden();

  const [step, setStep] = useState(STEP_PICK);
  const [catalogue, setCatalogue] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [customEntries, setCustomEntries] = useState([]); // array of {id, name}
  const [customInput, setCustomInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [arrangement, setArrangement] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Bouquet From Your Patch — Patch & Pot";
    ensureMeta(
      "description",
      "Tell us what's actually blooming right now and we'll build a small-batch bouquet from just those stems — and a watercolour share card to go with it.",
    );
  }, []);

  useEffect(() => {
    // Pull the full plant catalogue once so we can offer picker candidates
    // even to users who haven't touched My Garden yet.
    fetchPlants(lang).then(setCatalogue).catch(() => setCatalogue([]));
  }, [lang]);

  // Candidate pool: prefer My Garden intersecting cut-flower/flower plants,
  // else the whole cut-flower + flower catalogue.
  const candidates = useMemo(() => {
    const byId = new Map(catalogue.map((p) => [p.id, p]));
    const gardenIds = new Set(myGarden.map((p) => p.id));
    const gardenPicks = catalogue.filter(
      (p) =>
        gardenIds.has(p.id) &&
        (p.cut_flower || p.category === "Flower" || (p.tags || []).some((t) => ["cut-flower", "flower", "edible-flower", "pollinator"].includes(t))),
    );
    if (gardenPicks.length >= 3) return gardenPicks;
    // Fallback / supplement: cut-flower catalogue
    const cutFlowerPool = catalogue.filter(
      (p) => p.cut_flower || p.category === "Cut flower" || p.category === "Flower",
    );
    // Merge, gardenPicks first, then rest without duplicates.
    const seen = new Set(gardenPicks.map((p) => p.id));
    for (const p of cutFlowerPool) if (!seen.has(p.id)) { seen.add(p.id); gardenPicks.push(byId.get(p.id) || p); }
    return gardenPicks;
  }, [catalogue, myGarden]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustom = () => {
    const raw = customInput.trim();
    if (!raw) return;
    const slug = "custom-" + raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    if (customEntries.some((e) => e.id === slug) || catalogue.some((p) => p.id === slug)) return;
    setCustomEntries((prev) => [...prev, { id: slug, name: raw }]);
    setSelected((prev) => new Set(prev).add(slug));
    setCustomInput("");
  };

  const removeCustom = (id) => {
    setCustomEntries((prev) => prev.filter((e) => e.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const confirmedNames = useMemo(() => {
    const byId = new Map(catalogue.map((p) => [p.id, p.name]));
    const customById = new Map(customEntries.map((e) => [e.id, e.name]));
    return Array.from(selected).map((id) => byId.get(id) || customById.get(id) || id);
  }, [selected, catalogue, customEntries]);

  const canArrange = selected.size >= 2;

  const arrange = async () => {
    if (!canArrange) return;
    setBusy(true);
    setError(null);
    setImageSrc(null);
    setArrangement(null);
    try {
      const payload = {
        region: region || { name: "Global", country: "" },
        month: new Date().getMonth() + 1,
        my_garden: confirmedNames,
        language: lang,
      };
      const data = await fetchArrangementSuggestion(payload, false);
      setArrangement(data);
      setStep(STEP_RESULT);
      // kick off the watercolour in parallel
      setImageLoading(true);
      fetchBouquetImage(confirmedNames)
        .then((r) => setImageSrc(r.image))
        .catch(() => {}) // silent — user still gets the copy
        .finally(() => setImageLoading(false));
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        region: region || { name: "Global", country: "" },
        month: new Date().getMonth() + 1,
        my_garden: confirmedNames,
        language: lang,
      };
      const data = await fetchArrangementSuggestion(payload, true);
      setArrangement(data);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setStep(STEP_PICK);
    setArrangement(null);
    setImageSrc(null);
  };

  return (
    <div className="animate-fade-up">
      {step === STEP_PICK && (
        <PageHero
          variant="terracotta"
          eyebrow={t("bouquet.eyebrow")}
          title={t("bouquet.pick.title")}
          blurb={t("bouquet.pick.intro")}
          Motif={PoppyMotif}
        />
      )}
      <div className="container-narrow py-10 md:py-14">
      {step === STEP_PICK && (
        <PickStep
          t={t}
          candidates={candidates}
          selected={selected}
          toggle={toggle}
          customEntries={customEntries}
          customInput={customInput}
          setCustomInput={setCustomInput}
          addCustom={addCustom}
          removeCustom={removeCustom}
          canArrange={canArrange}
          onArrange={arrange}
          busy={busy}
          error={error}
        />
      )}
      {step === STEP_RESULT && arrangement && (
        <ResultStep
          t={t}
          arrangement={arrangement}
          imageSrc={imageSrc}
          imageLoading={imageLoading}
          confirmedNames={confirmedNames}
          onRegenerate={regenerate}
          onStartOver={startOver}
          busy={busy}
          error={error}
        />
      )}
      </div>
    </div>
  );
}

function PickStep({
  t, candidates, selected, toggle, customEntries, customInput,
  setCustomInput, addCustom, removeCustom, canArrange, onArrange, busy, error,
}) {
  return (
    <>
      <div className="mb-6 text-xs text-moss uppercase tracking-widest flex items-center gap-2">
        <Flower2 className="w-3.5 h-3.5" strokeWidth={1.6} />
        <span data-testid="bouquet-selected-count">
          {t("bouquet.pick.selected_count", { n: selected.size })}
        </span>
      </div>

      {candidates.length === 0 ? (
        <div className="card-flat p-6 mb-8 text-sm text-moss">
          {t("bouquet.pick.empty")}
        </div>
      ) : (
        <div
          data-testid="bouquet-candidate-grid"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-10"
        >
          {candidates.map((p) => {
            const active = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                data-testid={`bouquet-candidate-${p.id}`}
                className={`card-flat p-3 text-left flex items-start gap-2 transition-colors ${
                  active
                    ? "border-terracotta/70 bg-terracotta/5"
                    : "hover:border-forest/40"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border flex-shrink-0 mt-0.5 flex items-center justify-center ${
                    active
                      ? "bg-terracotta border-terracotta text-white"
                      : "border-border/70"
                  }`}
                >
                  {active && <Check className="w-3.5 h-3.5" strokeWidth={2.4} />}
                </span>
                <span className="text-sm text-ink leading-tight">
                  {p.name}
                </span>
              </button>
            );
          })}
          {customEntries.map((e) => (
            <div
              key={e.id}
              data-testid={`bouquet-custom-${e.id}`}
              className="card-flat p-3 flex items-start gap-2 border-terracotta/70 bg-terracotta/5"
            >
              <span className="w-5 h-5 rounded-full bg-terracotta border-terracotta text-white flex-shrink-0 mt-0.5 flex items-center justify-center">
                <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
              </span>
              <span className="text-sm text-ink leading-tight flex-1">{e.name}</span>
              <button
                type="button"
                onClick={() => removeCustom(e.id)}
                data-testid={`bouquet-custom-remove-${e.id}`}
                className="text-moss hover:text-terracotta"
                aria-label="Remove"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-10 flex items-center gap-2 max-w-md">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addCustom(); }
          }}
          placeholder={t("bouquet.pick.add_placeholder")}
          data-testid="bouquet-add-input"
          className="flex-1 border border-border/70 rounded px-3 py-2 text-sm focus:outline-none focus:border-forest/50"
        />
        <button
          type="button"
          onClick={addCustom}
          data-testid="bouquet-add-btn"
          className="btn-ghost inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" strokeWidth={1.6} />
          {t("bouquet.pick.add_btn")}
        </button>
      </div>

      {error && (
        <div className="mb-6 text-sm text-terracotta" data-testid="bouquet-error">
          {error}
        </div>
      )}

      <div className="border-t border-border pt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!canArrange || busy}
          onClick={onArrange}
          data-testid="bouquet-arrange-btn"
          className={`btn-primary inline-flex items-center gap-2 ${
            !canArrange || busy ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
              {t("bouquet.pick.arranging")}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" strokeWidth={1.6} />
              {t("bouquet.pick.arrange_btn")}
            </>
          )}
        </button>
        {!canArrange && (
          <span className="text-xs text-moss">
            {t("bouquet.pick.need_two")}
          </span>
        )}
      </div>
    </>
  );
}

function ResultStep({
  t, arrangement, imageSrc, imageLoading, confirmedNames, onRegenerate, onStartOver, busy, error,
}) {
  return (
    <>
      <button
        type="button"
        onClick={onStartOver}
        data-testid="bouquet-back-btn"
        className="text-sm text-moss hover:text-forest inline-flex items-center gap-1.5 mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} />
        {t("bouquet.result.back")}
      </button>

      <div className="mb-8 max-w-2xl">
        <h2
          className="font-serif text-4xl md:text-5xl text-forest tracking-tight"
          data-testid="bouquet-title"
        >
          {arrangement.title}
        </h2>
        <p className="mt-4 text-ink/75 leading-relaxed">{arrangement.intro}</p>
      </div>

      <div
        className="aspect-[4/3] bg-surface/60 border border-border overflow-hidden mb-10"
        data-testid="bouquet-image-wrap"
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt="Watercolour bouquet"
            data-testid="bouquet-image"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-moss">
            <Flower2
              strokeWidth={1.2}
              className={`w-10 h-10 ${imageLoading ? "animate-pulse opacity-70" : "opacity-50"}`}
            />
            {imageLoading && (
              <span className="text-[11px] tracking-wider uppercase mt-3">
                {t("bouquet.result.painting")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-10">
        <div className="md:col-span-1 card-flat p-5">
          <p className="overline mb-2">{t("bouquet.result.vase")}</p>
          <p className="text-sm text-ink/85 leading-relaxed">{arrangement.vase}</p>
        </div>
        <div className="md:col-span-2 card-flat p-5">
          <p className="overline mb-2">{t("bouquet.result.mechanic")}</p>
          <p className="text-sm text-ink/85 leading-relaxed">{arrangement.mechanic}</p>
        </div>
      </div>

      {arrangement.stems && arrangement.stems.length > 0 && (
        <section className="mb-12" data-testid="bouquet-stems">
          <h2 className="font-serif text-2xl text-forest tracking-tight mb-6">
            {t("bouquet.result.stems")}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {arrangement.stems.map((s, i) => (
              <div
                key={`${s.plant}-${i}`}
                data-testid={`bouquet-stem-${i}`}
                className="card-flat p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-serif text-lg text-forest leading-tight">
                      {s.plant}
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-widest text-moss mt-1">
                      {s.role} · {s.count}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-ink/75 mt-2 leading-relaxed">
                  {s.cutting_tip}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {arrangement.build_steps && arrangement.build_steps.length > 0 && (
        <section className="mb-12">
          <h2 className="font-serif text-2xl text-forest tracking-tight mb-6">
            {t("bouquet.result.build")}
          </h2>
          <ol className="space-y-3 text-sm text-ink/85 leading-relaxed max-w-2xl">
            {arrangement.build_steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-serif text-lg text-terracotta flex-shrink-0 w-6">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {arrangement.tip && (
        <p
          className="text-sm text-moss italic mb-12 max-w-2xl border-l-2 border-terracotta/40 pl-4"
          data-testid="bouquet-tip"
        >
          {arrangement.tip}
        </p>
      )}

      {error && (
        <div className="mb-6 text-sm text-terracotta" data-testid="bouquet-error">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border pt-8">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          data-testid="bouquet-regenerate-btn"
          className={`btn-ghost inline-flex items-center gap-2 ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} /> : <RefreshCcw className="w-4 h-4" strokeWidth={1.6} />}
          {t("bouquet.result.regenerate")}
        </button>
        <button
          type="button"
          onClick={() => shareBouquet(arrangement, imageSrc)}
          data-testid="bouquet-share-btn"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Share2 className="w-4 h-4" strokeWidth={1.6} />
          {t("bouquet.result.share")}
        </button>
        <Link
          to="/plants?special=cut-flower"
          data-testid="bouquet-explore-cut-flowers"
          className="btn-ghost inline-flex items-center gap-2"
        >
          {t("bouquet.result.explore_cut_flowers")}
        </Link>
      </div>
    </>
  );
}

/**
 * Opportunistic share: uses the Web Share API on mobile, otherwise falls
 * back to copying the URL to clipboard. The image itself is only
 * attached to Web Share when the browser reports File support.
 */
async function shareBouquet(arrangement, imageSrc) {
  const url = window.location.href;
  const title = arrangement?.title || "My bouquet";
  const text = arrangement?.intro || "";

  try {
    if (navigator.share) {
      const shareData = { title, text, url };
      if (imageSrc && navigator.canShare) {
        try {
          const blob = dataURLtoBlob(imageSrc);
          if (blob) {
            const file = new File([blob], "bouquet.png", { type: blob.type || "image/png" });
            if (navigator.canShare({ files: [file] })) {
              shareData.files = [file];
            }
          }
        } catch (_e) { /* ignore image attach failures */ }
      }
      await navigator.share(shareData);
      return;
    }
  } catch (_e) { /* fall through */ }

  try {
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard");
  } catch (_e) { /* nothing more we can do */ }
}

function dataURLtoBlob(dataUrl) {
  const match = /^data:(.+?);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, b64] = match;
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function ensureMeta(name, content) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
