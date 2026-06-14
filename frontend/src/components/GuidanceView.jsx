import { useEffect, useState } from "react";
import { Sprout, Scissors, ListTodo, Bug, Quote, Loader2 } from "lucide-react";
import { fetchGuidance } from "@/lib/api";
import { useCompletedTasks } from "@/hooks/useMyGarden";

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

export default function GuidanceView({ region, month, view = "all" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const monthKey = `${region?.name || "x"}-${month}`;
  const { completed, toggle } = useCompletedTasks(monthKey);

  useEffect(() => {
    if (!region) return;
    setLoading(true);
    setError("");
    setData(null);
    fetchGuidance(region, month)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.detail || "Could not load guidance"))
      .finally(() => setLoading(false));
  }, [region, month]);

  if (!region) {
    return (
      <div className="card-flat p-10 text-center" data-testid="guidance-no-region">
        <p className="text-moss">Pick your region to see what to grow this month.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-flat p-10 flex items-center justify-center gap-3 text-moss" data-testid="guidance-loading">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Growing your monthly guide for {region.name}…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-flat p-10 text-terracotta" data-testid="guidance-error">{error}</div>
    );
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
          <Section icon={Sprout} eyebrow="Plant now" title="What to sow & plant">
            <ul className="space-y-4" data-testid="plant-now-list">
              {(data.plant_now || []).map((p, i) => (
                <li key={i} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
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
          <Section icon={Scissors} eyebrow="Harvest now" title="Ready to pick">
            <ul className="space-y-3" data-testid="harvest-list">
              {(data.harvest_now || []).map((p, i) => (
                <li key={i} className="flex gap-3">
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
          <Section icon={ListTodo} eyebrow="This month" title="Tasks & to-do">
            <ul className="space-y-3" data-testid="tasks-list">
              {(data.tasks || []).map((t, i) => {
                const id = `t-${i}`;
                const done = !!completed[id];
                return (
                  <li key={i} className="flex items-start gap-3">
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
                      <p className="font-medium text-ink">{t.title}</p>
                      <p className="text-sm text-moss">{t.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {(showAll || view === "pests") && (
          <Section icon={Bug} eyebrow="Watch out" title="Pests & diseases">
            <ul className="space-y-4" data-testid="pests-list">
              {(data.pests || []).map((p, i) => (
                <li key={i} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
                  <p className="font-serif text-xl text-forest">{p.name}</p>
                  <p className="text-sm text-ink/80 mt-1"><span className="text-moss">Signs · </span>{p.signs}</p>
                  <p className="text-sm text-ink/80 mt-1"><span className="text-moss">Control · </span>{p.control}</p>
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
