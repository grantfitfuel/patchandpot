import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sprout, ListTodo, Bug, ArrowRight, MapPin, Loader2 } from "lucide-react";
import { fetchGuidance } from "@/lib/api";
import { useRegion } from "@/hooks/useRegion";
import { useMyGarden } from "@/hooks/useMyGarden";
import { useI18n, monthLabel } from "@/i18n";

/**
 * Home-page preview card: surfaces the 2 most relevant items from each of
 * (plant_now, tasks, pests) for the current month and region. Falls back to
 * the default London region if the user hasn't set one yet, so the card
 * always has content on first visit.
 */
export default function ThisMonthCard({ onSetRegion }) {
  const { t, lang } = useI18n();
  const { region, defaultRegion } = useRegion();
  const { plants } = useMyGarden();

  const month = new Date().getMonth() + 1;
  const monthName = monthLabel(month, t);

  // Use the user's region if set; otherwise quietly preview against London so
  // the card is never empty. The CTA still nudges them to set their region.
  const activeRegion = region || defaultRegion;
  const usingDefault = !region;

  const gardenIds = useMemo(
    () => (plants || []).map((p) => p.id).sort().join(","),
    [plants]
  );

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const myGarden = (plants || []).map((p) => p.name);
    fetchGuidance(activeRegion, month, lang, myGarden.length ? myGarden : null)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegion?.name, month, lang, gardenIds]);

  if (error) return null;

  const plantNow = (data?.plant_now || []).slice(0, 2);
  const tasks = (data?.tasks || []).slice(0, 2);
  const pests = (data?.pests || []).slice(0, 1);

  return (
    <section
      className="border-y border-border bg-surface/60"
      data-testid="home-thismonth-card"
    >
      <div className="container-narrow py-16 md:py-20">
        <div className="grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-4">
            <p className="overline">{t("home.thismonth.eyebrow")}</p>
            <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 leading-tight">
              {t("home.thismonth.title", { month: monthName })}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-sm text-moss">
              <MapPin strokeWidth={1.5} className="w-4 h-4" />
              <span data-testid="home-thismonth-region">
                {activeRegion.name}
                {activeRegion.country ? `, ${activeRegion.country}` : ""}
              </span>
            </div>
            {usingDefault && (
              <button
                type="button"
                onClick={onSetRegion}
                data-testid="home-thismonth-set-region"
                className="mt-4 text-sm text-terracotta underline underline-offset-4 decoration-terracotta/40 hover:decoration-terracotta text-left"
              >
                {t("home.thismonth.set_region")}
              </button>
            )}
            <Link
              to="/calendar"
              data-testid="home-thismonth-cta"
              className="mt-6 btn-terracotta inline-flex items-center gap-2"
            >
              {t("home.thismonth.cta", { month: monthName })}
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>

          <div className="md:col-span-8 grid sm:grid-cols-3 gap-5">
            <PreviewColumn
              icon={Sprout}
              label={t("home.thismonth.plant")}
              loading={loading}
              testid="home-thismonth-plant"
              items={plantNow.map((p) => ({ title: p.name, sub: p.why }))}
            />
            <PreviewColumn
              icon={ListTodo}
              label={t("home.thismonth.do")}
              loading={loading}
              testid="home-thismonth-tasks"
              items={tasks.map((tk) => ({ title: tk.title, sub: tk.detail }))}
            />
            <PreviewColumn
              icon={Bug}
              label={t("home.thismonth.watch")}
              loading={loading}
              testid="home-thismonth-pests"
              items={pests.map((p) => ({ title: p.name, sub: p.signs }))}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewColumn({ icon: Icon, label, items, loading, testid }) {
  return (
    <div className="card-flat p-5" data-testid={testid}>
      <div className="flex items-center gap-2 mb-4">
        <Icon strokeWidth={1.5} className="w-4 h-4 text-terracotta" />
        <span className="overline">{label}</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-moss text-sm py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
          <span>…</span>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-moss">—</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.title} className="border-b border-border last:border-b-0 pb-3 last:pb-0">
              <p className="font-serif text-lg text-forest leading-snug">{it.title}</p>
              {it.sub && <p className="text-xs text-moss mt-1 leading-relaxed line-clamp-2">{it.sub}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
