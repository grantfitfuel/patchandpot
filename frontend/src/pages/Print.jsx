import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer, ArrowLeft, Sprout, Scissors, ListTodo, Bug, Quote } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { fetchGuidance } from "@/lib/api";
import { useI18n, monthLabel } from "@/i18n";

export default function PrintPage() {
  const { region } = useRegion();
  const { t, lang } = useI18n();
  const { month: monthParam } = useParams();
  const month = Math.max(1, Math.min(12, parseInt(monthParam || "1", 10)));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!region) return;
    fetchGuidance(region, month, lang)
      .then(setData)
      .catch(() => setError(t("guidance.error")));
  }, [region, month, lang]); // eslint-disable-line

  if (!region) {
    return (
      <div className="container-narrow py-16">
        <p className="text-moss">{t("guidance.no_region")}</p>
        <Link to="/calendar" className="btn-ghost mt-4 inline-flex">{t("print.action.back")}</Link>
      </div>
    );
  }

  return (
    <div className="container-narrow py-10 max-w-4xl print-area">
      {/* Action toolbar — hidden in print */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8 print:hidden">
        <Link to="/calendar" data-testid="print-back" className="inline-flex items-center gap-2 text-moss hover:text-forest">
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> {t("print.action.back")}
        </Link>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            data-testid="print-btn"
            className="btn-terracotta inline-flex items-center gap-2"
          >
            <Printer className="w-4 h-4" strokeWidth={1.5} /> {t("print.action.print")}
          </button>
        </div>
      </div>

      <p className="overline">Patch &amp; Pot · {region.name}{region.country ? `, ${region.country}` : ""}</p>
      <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
        {monthLabel(month, t)}
      </h1>
      <p className="mt-3 text-ink/75">{t("print.intro")}</p>

      {error && <p className="mt-6 text-terracotta">{error}</p>}
      {!data && !error && <p className="mt-6 text-moss">{t("guidance.loading")} {region.name}…</p>}

      {data && (
        <div className="mt-10 space-y-10">
          <div className="border-l-2 border-terracotta pl-5">
            <p className="overline">{t("print.season")} · {data.season_label}</p>
            <p className="font-serif text-2xl text-forest mt-2 leading-snug">{data.summary}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            <PrintSection icon={Sprout} eyebrow={t("guidance.plant_now.eyebrow")} title={t("guidance.plant_now")}>
              {(data.plant_now || []).map((p, i) => (
                <div key={i} className="break-inside-avoid">
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-lg text-forest">{p.name}</span>
                    {p.kind && (
                      <span className={`text-[9px] tracking-[0.18em] uppercase ${
                        p.kind === "flower" ? "text-terracotta" : "text-moss"
                      }`}>{p.kind}</span>
                    )}
                  </div>
                  <p className="text-sm text-ink/80">{p.why}</p>
                  <p className="text-sm text-moss">{p.how}</p>
                </div>
              ))}
            </PrintSection>

            <PrintSection icon={Scissors} eyebrow={t("guidance.harvest_now.eyebrow")} title={t("guidance.harvest_now")}>
              {(data.harvest_now || []).map((p, i) => (
                <div key={i}>
                  <span className="font-medium text-ink">{p.name}</span>
                  <p className="text-sm text-moss">{p.tip}</p>
                </div>
              ))}
            </PrintSection>

            <PrintSection icon={ListTodo} eyebrow={t("guidance.tasks.eyebrow")} title={t("guidance.tasks")}>
              {(data.tasks || []).map((task, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-4 h-4 border border-forest/50 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-ink">{task.title}</p>
                    <p className="text-sm text-moss">{task.detail}</p>
                  </div>
                </div>
              ))}
            </PrintSection>

            <PrintSection icon={Bug} eyebrow={t("guidance.pests.eyebrow")} title={t("guidance.pests")}>
              {(data.pests || []).map((p, i) => (
                <div key={i} className="break-inside-avoid">
                  <span className="font-serif text-lg text-forest">{p.name}</span>
                  <p className="text-sm"><span className="text-moss">{t("guidance.signs")}: </span>{p.signs}</p>
                  <p className="text-sm"><span className="text-moss">{t("guidance.control")}: </span>{p.control}</p>
                </div>
              ))}
            </PrintSection>
          </div>

          {data.tip && (
            <div className="border-t border-border pt-6 flex items-start gap-3">
              <Quote strokeWidth={1.2} className="w-5 h-5 text-terracotta flex-shrink-0" />
              <p className="font-serif text-xl text-forest italic leading-relaxed">{data.tip}</p>
            </div>
          )}

          <p className="text-xs text-moss border-t border-border pt-4">
            Patch &amp; Pot · {region.name}{region.country ? `, ${region.country}` : ""} · {monthLabel(month, t)} · {region.hemisphere} hemisphere · {region.climate_zone}
          </p>
        </div>
      )}
    </div>
  );
}

function PrintSection({ icon: Icon, eyebrow, title, children }) {
  return (
    <section className="break-inside-avoid">
      <div className="flex items-center gap-2 mb-2">
        <Icon strokeWidth={1.5} className="w-4 h-4 text-terracotta" />
        <span className="overline">{eyebrow}</span>
      </div>
      <h2 className="font-serif text-2xl text-forest mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
