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
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setPhase("idle");
    const myGarden = (plants || []).map((p) => p.name);
    fetchGuidance(activeRegion, month, lang, myGarden.length ? myGarden : null, {
      onPhase: (p) => { if (!cancelled) setPhase(p); },
    })
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
     
  }, [activeRegion?.name, month, lang, gardenIds]);

  if (error) {
    return (
      <section
        className="bg-forest text-sand"
        data-testid="home-thismonth-card"
      >
        <div className="container-narrow py-14 md:py-16">
          <p className="overline text-terracotta">{t("home.thismonth.eyebrow")}</p>
          <h2 className="font-serif text-3xl md:text-4xl text-sand mt-3 leading-tight">
            {t("home.thismonth.title", { month: monthName })}
          </h2>
          <p className="mt-4 text-sm text-sand/80 max-w-xl">
            {t("guidance.error")}
          </p>
          <Link
            to="/calendar"
            data-testid="home-thismonth-cta"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-terracotta hover:bg-[#B04A36] text-sand px-6 py-3 font-medium tracking-wide transition-colors"
          >
            {t("home.thismonth.cta", { month: monthName })}
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
      </section>
    );
  }

  const plantNow = (data?.plant_now || []).slice(0, 2);
  const tasks = (data?.tasks || []).slice(0, 2);
  const pests = (data?.pests || []).slice(0, 1);

  return (
    <section
      className="bg-forest text-sand relative overflow-hidden"
      data-testid="home-thismonth-card"
    >
      {/* Subtle terracotta wash in the top-right so the dark forest
          section doesn't feel like a slab — a warm sunrise glow. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 100% 0%, rgba(198,93,71,0.18), transparent 60%)",
        }}
      />
      <div className="relative container-narrow py-14 md:py-16">
        <div className="grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-4">
            <p className="overline text-terracotta">{t("home.thismonth.eyebrow")}</p>
            <h2 className="font-serif text-4xl md:text-5xl text-sand mt-3 leading-tight">
              {t("home.thismonth.title", { month: monthName })}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-sm text-sand/75">
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
                className="mt-4 py-2 -my-2 text-sm text-terracotta underline underline-offset-4 decoration-terracotta/50 hover:decoration-terracotta text-left"
              >
                {t("home.thismonth.set_region")}
              </button>
            )}
            <Link
              to="/calendar"
              data-testid="home-thismonth-cta"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-terracotta hover:bg-[#B04A36] text-sand px-6 py-3 font-medium tracking-wide transition-colors"
            >
              {t("home.thismonth.cta", { month: monthName })}
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>

          <div className="md:col-span-8 grid sm:grid-cols-3 gap-4">
            <PreviewColumn
              icon={Sprout}
              label={t("home.thismonth.plant")}
              loading={loading}
              testid="home-thismonth-plant"
              variant="moss"
              items={plantNow.map((p) => ({ title: p.name, sub: p.why }))}
            />
            <PreviewColumn
              icon={ListTodo}
              label={t("home.thismonth.do")}
              loading={loading}
              testid="home-thismonth-tasks"
              variant="terracotta"
              items={tasks.map((tk) => ({ title: tk.title, sub: tk.detail }))}
            />
            <PreviewColumn
              icon={Bug}
              label={t("home.thismonth.watch")}
              loading={loading}
              testid="home-thismonth-pests"
              variant="moss"
              items={pests.map((p) => ({ title: p.name, sub: p.signs }))}
            />
            {loading && (phase === "generating" || phase === "almost") && (
              <p
                className="sm:col-span-3 text-xs text-sand/70 italic"
                data-testid="home-thismonth-cold-note"
              >
                {t("guidance.loading.cold_note")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewColumn({ icon: Icon, label, items, loading, testid, variant }) {
  // Two card variants: moss (sage green) for planting/pest columns and
  // terracotta for the action-oriented "Do" column. Both use sand text
  // so they read cleanly against the dark forest section behind.
  const isTerra = variant === "terracotta";
  const bg = isTerra ? "bg-terracotta" : "bg-moss";
  const divider = isTerra ? "border-sand/25" : "border-sand/20";
  return (
    <div className={`${bg} text-sand rounded-2xl p-5`} data-testid={testid}>
      <div className="flex items-center gap-2 mb-4">
        <Icon strokeWidth={1.5} className="w-4 h-4 text-sand/90" />
        <span className="overline text-sand/85">{label}</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sand/80 text-sm py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
          <span>…</span>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-sand/70">—</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.title} className={`border-b ${divider} last:border-b-0 pb-3 last:pb-0`}>
              <p className="font-serif text-lg text-sand leading-snug">{it.title}</p>
              {it.sub && <p className="text-xs text-sand/80 mt-1 leading-relaxed line-clamp-2">{it.sub}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
