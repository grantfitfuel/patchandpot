import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, MapPin, Sparkles, Sprout } from "lucide-react";
import { fetchSharedPatch } from "@/lib/api";
import GuidanceView from "@/components/GuidanceView";
import MonthSelector from "@/components/MonthSelector";
import PlantImage from "@/components/PlantImage";
import { useI18n, monthLabel } from "@/i18n";

/**
 * Public, read-only preview of a shared patch (URL: /p/:shareId).
 *
 * This is intentionally SEO-friendly:
 *   - dynamic <title> and <meta name="description"> set per snapshot
 *   - real plant names + region in the page body so search engines have
 *     real text to index for the long-tail evergreen
 *   - "Create your own patch" CTAs at top + bottom drive viral signups
 *
 * No localStorage writes happen here — viewing a shared patch must never
 * touch the viewer's own patches / region / tasks.
 */
export default function SharedPatchPage() {
  const { shareId } = useParams();
  const { t, lang } = useI18n();
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (!shareId) return;
    let cancelled = false;
    setState({ status: "loading", data: null, error: "" });
    fetchSharedPatch(shareId)
      .then((d) => { if (!cancelled) setState({ status: "ok", data: d, error: "" }); })
      .catch((e) => {
        if (cancelled) return;
        const code = e?.response?.status === 404 ? "not_found" : "error";
        setState({ status: code, data: null, error: e?.response?.data?.detail || "" });
      });
    return () => { cancelled = true; };
  }, [shareId]);

  // SEO: set <title> and description.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const d = state.data;
    if (d) {
      const monthName = monthLabel(month, t);
      document.title = `${d.patch_name} · ${d.region?.name || ""} — Patch & Pot`;
      const desc = t("share_view.meta_description", {
        name: d.patch_name,
        region: d.region?.name || "",
        n: (d.plants || []).length,
        month: monthName,
      });
      ensureMetaTag("description", desc);
      ensureMetaTag("og:title", document.title, "property");
      ensureMetaTag("og:description", desc, "property");
      ensureMetaTag("og:type", "article", "property");
      // og:image — points at the same backend-rendered card the social
      // crawler picks up from /api/share/preview/{id}. Crawlers that DO
      // execute JS (modern Slack, Discord, Telegram) will now also unfurl
      // the card from this SPA URL itself.
      if (shareId) {
        const origin = window.location.origin;
        const imgUrl = `${origin}/api/share/patch/${shareId}/og.png`;
        ensureMetaTag("og:image", imgUrl, "property");
        ensureMetaTag("og:image:width", "1200", "property");
        ensureMetaTag("og:image:height", "630", "property");
        ensureMetaTag("twitter:card", "summary_large_image");
        ensureMetaTag("twitter:image", imgUrl);
      }
    }
  }, [state.data, month, t, shareId]);

  // Restore a sane default on unmount only — kept separate from the effect
  // above so changing `month` doesn't briefly flash the default title.
  useEffect(() => () => {
    if (typeof document !== "undefined") document.title = "Patch & Pot";
  }, []);

  const plants = useMemo(() => state.data?.plants || [], [state.data]);
  const region = state.data?.region || null;
  const monthName = monthLabel(month, t);

  if (state.status === "loading") {
    return (
      <div className="container-narrow py-24 flex flex-col items-center justify-center gap-4 text-moss" data-testid="share-view-loading">
        <Loader2 strokeWidth={1.5} className="w-7 h-7 animate-spin" />
        <p className="text-sm tracking-wider uppercase">{t("share_view.loading")}</p>
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="container-narrow py-24 text-center animate-fade-up" data-testid="share-view-missing">
        <Sprout strokeWidth={1.2} className="w-9 h-9 text-terracotta mx-auto mb-5" />
        <h1 className="font-serif text-5xl text-forest tracking-tight">{t("share_view.missing.title")}</h1>
        <p className="text-moss mt-4 max-w-md mx-auto leading-relaxed">{t("share_view.missing.body")}</p>
        <Link to="/" className="btn-terracotta inline-flex mt-8" data-testid="share-view-missing-cta">
          {t("share_view.missing.cta")}
        </Link>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="container-narrow py-24 text-center" data-testid="share-view-error">
        <p className="text-terracotta">{state.error || t("share_view.error_generic")}</p>
        <Link to="/" className="btn-ghost inline-flex mt-6">{t("share_view.missing.cta")}</Link>
      </div>
    );
  }

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid="share-view">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="overline" data-testid="share-view-eyebrow">
            {t("share_view.eyebrow")}
          </p>
          <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight" data-testid="share-view-name">
            {state.data.patch_name}
          </h1>
          {region && (
            <p className="mt-3 text-ink/80 inline-flex items-center gap-2" data-testid="share-view-region">
              <MapPin strokeWidth={1.5} className="w-4 h-4 text-moss" />
              <span>{region.name}{region.country ? `, ${region.country}` : ""}</span>
            </p>
          )}
        </div>
        <Link to="/" className="btn-terracotta inline-flex items-center gap-2" data-testid="share-view-cta-top">
          <Sparkles strokeWidth={1.5} className="w-4 h-4" /> {t("share_view.cta_create")}
        </Link>
      </div>

      {/* Plant grid */}
      {plants.length > 0 ? (
        <section className="mb-16" data-testid="share-view-plants">
          <h2 className="font-serif text-3xl md:text-4xl text-forest mb-6">
            {t("share_view.plants_title", { n: plants.length })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plants.map((p) => {
              const linkTo = p.id.startsWith("ai-") ? `/plants/ai/${p.id}` : `/plants/${p.id}`;
              return (
                <Link key={p.id} to={linkTo} className="card-flat overflow-hidden hover:border-forest/40 transition-colors">
                  <div className="aspect-[4/3] bg-surface">
                    <PlantImage plant={p} />
                  </div>
                  <div className="p-5">
                    <p className="overline">
                      {p.category || "Plant"}{p.ai_generated ? " · AI" : ""}
                    </p>
                    <h3 className="font-serif text-2xl text-forest mt-1">{p.name}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="card-flat p-8 mb-16 text-center text-moss" data-testid="share-view-no-plants">
          {t("share_view.no_plants")}
        </div>
      )}

      {/* This-month forecast */}
      {region && (
        <section className="border-t border-border pt-12 mb-16" data-testid="share-view-forecast">
          <p className="overline">{t("share_view.forecast.eyebrow")}</p>
          <h2 className="font-serif text-3xl md:text-4xl text-forest mt-3 mb-6">
            {t("share_view.forecast.title", { region: region.name, month: monthName })}
          </h2>
          <div className="mb-8">
            <MonthSelector month={month} onChange={setMonth} />
          </div>
          <GuidanceView
            region={region}
            month={month}
            view="all"
            myGarden={plants.map((p) => p.name)}
            readOnly
          />
        </section>
      )}

      {/* Bottom CTA band */}
      <section className="bg-forest text-sand px-8 py-14 md:py-16 text-center" data-testid="share-view-cta-band">
        <p className="overline text-sand/70">{t("share_view.cta_band.eyebrow")}</p>
        <h2 className="font-serif text-4xl md:text-5xl mt-3 tracking-tight">
          {t("share_view.cta_band.title")}
        </h2>
        <p className="mt-4 max-w-xl mx-auto text-sand/85 leading-relaxed">
          {t("share_view.cta_band.body")}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 mt-7 bg-sand text-forest px-7 py-3 hover:bg-sand/90 transition-colors"
          data-testid="share-view-cta-bottom"
        >
          <Sparkles strokeWidth={1.5} className="w-4 h-4" /> {t("share_view.cta_band.button")}
        </Link>
      </section>
    </div>
  );
}

function ensureMetaTag(name, content, attr = "name") {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
