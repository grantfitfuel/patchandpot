import { useEffect, useState } from "react";
import { Sprout, Scissors, ListTodo, Bug, Quote, Loader2 } from "lucide-react";
import { fetchGuidance } from "@/lib/api";
import { useCompletedTasks } from "@/hooks/useMyGarden";
import { useI18n, monthLabel } from "@/i18n";
import PestImage from "@/components/PestImage";
import { formatApiError } from "@/lib/formatApiError";

function Section({ icon: Icon, eyebrow, title, children }) {
  return (
    <section className="card-flat p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <Icon strokeWidth={1.5} className="w-5 h-5 text-terracotta" />
        <span className="overline">{eyebrow}</span>
      </div>
      <h3 className="font-serif text-3xl text-forest mb-5">{title}</h3>
      {children}
    </section>
  );
}

export default function GuidanceView({ region, month, view = "all", onData, myGarden = null, readOnly = false }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("idle");  // idle | pending | generating | almost
  const [error, setError] = useState("");

  // Normalise myGarden to a clean list of lower-cased plant-name strings.
  // Historically callers passed `plants.map(p => p.name)` but older
  // localStorage snapshots can yield `undefined` (older schema had
  // `name_en` instead of `name`) or even raw object entries. Without
  // this guard, `p.toLowerCase()` crashes the whole component and the
  // ErrorBoundary blanks the /garden page.
  const gardenNames = (myGarden || [])
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object") return p.name || p.name_en || p.id || "";
      return "";
    })
    .filter(Boolean);
  const gardenKey = gardenNames.map((s) => s.toLowerCase()).sort().join(",");
  const monthKey = `${region?.name || "x"}-${month}-${lang}-${gardenKey}`;
  const { completed, toggle } = useCompletedTasks(monthKey);

  useEffect(() => {
    if (!region) return;
    setLoading(true);
    setError("");
    setData(null);
    setPhase("idle");
    fetchGuidance(region, month, lang, gardenNames.length ? gardenNames : null, {
      onPhase: setPhase,
    })
      .then((d) => { setData(d); if (onData) onData(d); })
      .catch((e) => setError(formatApiError(e, t("guidance.error"))))
      .finally(() => setLoading(false));
     
  }, [region, month, lang, gardenKey]);

  if (!region) {
    return (
      <div className="card-flat p-10 text-center" data-testid="guidance-no-region">
        <p className="text-moss">{t("guidance.no_region")}</p>
      </div>
    );
  }

  if (loading) {
    const monthName = monthLabel(month, t);
    // Phase-aware stage copy. Cache hits resolve before phase ever leaves
    // "idle", so the user only sees the cold-cache reassurance when they
    // actually have to wait.
    const stageKey =
      phase === "almost" ? "guidance.loading.almost"
      : phase === "generating" ? "guidance.loading.generating"
      : phase === "pending" ? "guidance.loading.starting"
      : "guidance.loading";
    const stageText = t(stageKey, { region: region.name, month: monthName });
    const showColdNote = phase === "generating" || phase === "almost";
    return (
      <div className="card-flat p-10 flex flex-col items-center justify-center gap-3 text-moss text-center" data-testid="guidance-loading">
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span data-testid="guidance-loading-stage">
            {phase === "idle" ? <>{stageText} {region.name}…</> : stageText}
          </span>
        </div>
        {showColdNote && (
          <p className="text-xs text-moss/70 max-w-sm" data-testid="guidance-loading-note">
            {t("guidance.loading.cold_note")}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return <div className="card-flat p-10 text-terracotta" data-testid="guidance-error">{error}</div>;
  }

  if (!data) return null;

  const showAll = view === "all";

  return (
    <div className="space-y-8" data-testid="guidance-content">
      <div className="border-l-2 border-terracotta pl-5">
        <p className="overline">{data.season_label}</p>
        <p className="font-serif text-2xl md:text-3xl text-forest mt-2 leading-snug">{data.summary}</p>
      </div>

      <div className={`grid gap-6 ${showAll ? "lg:grid-cols-2" : ""}`}>
        {(showAll || view === "plant") && (
          <Section icon={Sprout} eyebrow={t("guidance.plant_now.eyebrow")} title={t("guidance.plant_now")}>
            <ul className="space-y-4" data-testid="plant-now-list">
              {(data.plant_now || []).map((p) => (
                <li key={p.name} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-serif text-xl text-forest">{p.name}</p>
                    {p.kind && (
                      <span className={`text-[10px] tracking-[0.18em] uppercase px-2 py-1 border ${
                        p.kind === "flower"
                          ? "border-terracotta/40 text-terracotta"
                          : "border-forest/30 text-forest"
                      }`}>
                        {p.kind}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink/80 mt-1">{p.why}</p>
                  <p className="text-sm text-moss mt-1">{p.how}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(showAll || view === "harvest") && (
          <Section icon={Scissors} eyebrow={t("guidance.harvest_now.eyebrow")} title={t("guidance.harvest_now")}>
            <ul className="space-y-3" data-testid="harvest-list">
              {(data.harvest_now || []).map((p) => (
                <li key={p.name} className="flex gap-3">
                  <span className="text-terracotta">—</span>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-ink">{p.name}</p>
                      {p.kind && (
                        <span className={`text-[10px] tracking-[0.18em] uppercase ${
                          p.kind === "flower" ? "text-terracotta" : "text-forest"
                        }`}>
                          {p.kind}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-moss">{p.tip}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(showAll || view === "tasks") && (
          <Section icon={ListTodo} eyebrow={t("guidance.tasks.eyebrow")} title={t("guidance.tasks")}>
            <ul className="space-y-3" data-testid="tasks-list">
              {(data.tasks || []).map((task, i) => {
                const id = `task:${task.title}`;
                const done = !!completed[id];
                if (readOnly) {
                  // Compare-view (or any other read-only consumer) — render
                  // tasks as a static list so toggling here doesn't bleed
                  // into the active patch's task state.
                  return (
                    <li key={id} className="flex items-start gap-3">
                      <span className="mt-1 w-5 h-5 border border-forest/30 flex-shrink-0" aria-hidden />
                      <div>
                        <p className="font-medium text-ink">{task.title}</p>
                        <p className="text-sm text-moss">{task.detail}</p>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={id} className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      data-testid={`task-toggle-${i}`}
                      aria-pressed={done}
                      className={`mt-1 w-5 h-5 border flex-shrink-0 transition-colors ${
                        done ? "bg-forest border-forest" : "border-forest/40 hover:border-forest"
                      }`}
                    >
                      {done && <span className="block text-sand text-xs leading-5 text-center">✓</span>}
                    </button>
                    <div className={done ? "opacity-50 line-through" : ""}>
                      <p className="font-medium text-ink">{task.title}</p>
                      <p className="text-sm text-moss">{task.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {(showAll || view === "pests") && (
          <Section icon={Bug} eyebrow={t("guidance.pests.eyebrow")} title={t("guidance.pests")}>
            <ul className="space-y-4" data-testid="pests-list">
              {(data.pests || []).map((p) => (
                <li key={p.name} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
                  <p className="font-serif text-xl text-forest">{p.name}</p>
                  <p className="text-sm text-ink/80 mt-1"><span className="text-moss">{t("guidance.signs")} · </span>{p.signs}</p>
                  <p className="text-sm text-ink/80 mt-1"><span className="text-moss">{t("guidance.control")} · </span>{p.control}</p>
                  <PestImage name={p.name} />
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {data.tip && showAll && (
        <div className="border-t border-border pt-8 flex items-start gap-4 max-w-3xl">
          <Quote strokeWidth={1.2} className="w-6 h-6 text-terracotta flex-shrink-0" />
          <p className="font-serif text-xl md:text-2xl text-forest italic leading-relaxed">{data.tip}</p>
        </div>
      )}
    </div>
  );
}
