import { useState } from "react";
import { Link } from "react-router-dom";
import { Flower2, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { fetchArrangementSuggestion } from "@/lib/api";
import { useI18n } from "@/i18n";

const ROLE_STYLES = {
  focal: "bg-terracotta/10 text-terracotta border-terracotta/30",
  filler: "bg-moss/10 text-moss border-moss/30",
  line: "bg-forest/10 text-forest border-forest/30",
  accent: "bg-ink/5 text-ink/75 border-ink/15",
  foliage: "bg-forest/5 text-forest/80 border-forest/20",
};

/**
 * "What's in your garden right now" — an AI-generated seasonal arrangement
 * recipe using ONLY the plants in the user's My Garden list. Pairs with the
 * Flower Arranging masterclass principles (4-role rule, mechanics, conditioning).
 */
export default function ArrangementSuggester({ region, month, myGardenNames, lang }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tooFew = !Array.isArray(myGardenNames) || myGardenNames.length === 0;

  async function generate(regenerate = false) {
    if (!region || tooFew) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchArrangementSuggestion(
        {
          region,
          month,
          language: lang || "en",
          my_garden: myGardenNames,
        },
        regenerate,
      );
      setData(result);
    } catch (e) {
      setError(e?.response?.data?.detail || t("arr.error_default"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-t border-border pt-12 mt-12" data-testid="arrangement-suggester">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="overline">{t("arr.eyebrow")}</p>
          <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 tracking-tight">
            {t("arr.title")}
          </h2>
          <p className="mt-3 text-ink/75 max-w-2xl leading-relaxed">
            {t("arr.subtitle_prefix")}{" "}
            <Link to="/learn/flower-arranging" className="link">
              {t("mc.title.flower-arranging")}
            </Link>
            .
          </p>
        </div>
      </div>

      {/* CTA / States */}
      {!data && !loading && (
        <div className="card-flat p-8 md:p-10 text-center">
          {tooFew ? (
            <>
              <Flower2 strokeWidth={1.3} className="w-7 h-7 text-moss mx-auto mb-3" />
              <p className="text-ink/75">{t("arr.empty")}</p>
            </>
          ) : !region ? (
            <p className="text-ink/75">{t("arr.no_region")}</p>
          ) : (
            <>
              <Sparkles strokeWidth={1.4} className="w-7 h-7 text-terracotta mx-auto mb-4" />
              <p className="text-ink/75 mb-6 max-w-md mx-auto">
                {t("arr.cta_intro", { count: myGardenNames.length })}
              </p>
              <button
                type="button"
                onClick={() => generate(false)}
                data-testid="arrangement-generate"
                className="btn-terracotta inline-flex items-center gap-2"
              >
                <Sparkles strokeWidth={1.5} className="w-4 h-4" />
                {t("arr.cta_button")}
              </button>
            </>
          )}
        </div>
      )}

      {loading && (
        <div className="card-flat p-8 text-center" data-testid="arrangement-loading">
          <Loader2 strokeWidth={1.5} className="w-6 h-6 text-terracotta animate-spin mx-auto mb-3" />
          <p className="text-moss">{t("arr.loading")}</p>
        </div>
      )}

      {error && !loading && (
        <div className="card-flat p-6 text-center border-terracotta/30" data-testid="arrangement-error">
          <p className="text-terracotta">{error}</p>
          <button type="button" onClick={() => generate(false)} className="btn-ghost mt-4">{t("arr.try_again")}</button>
        </div>
      )}

      {data && !loading && (
        <article className="card-flat p-8 md:p-10" data-testid="arrangement-result">
          <h3 className="font-serif text-3xl md:text-4xl text-forest tracking-tight" data-testid="arrangement-title">
            {data.title}
          </h3>
          <p className="mt-4 text-ink/80 leading-relaxed text-lg">{data.intro}</p>

          {(data.vase || data.mechanic) && (
            <div className="mt-7 grid sm:grid-cols-2 gap-5">
              {data.vase && (
                <div className="border-l-2 border-terracotta/40 pl-4">
                  <p className="overline mb-1">{t("arr.label_vase")}</p>
                  <p className="text-ink/80 leading-relaxed">{data.vase}</p>
                </div>
              )}
              {data.mechanic && (
                <div className="border-l-2 border-moss/40 pl-4">
                  <p className="overline mb-1">{t("arr.label_mechanic")}</p>
                  <p className="text-ink/80 leading-relaxed">{data.mechanic}</p>
                </div>
              )}
            </div>
          )}

          {Array.isArray(data.stems) && data.stems.length > 0 && (
            <div className="mt-8" data-testid="arrangement-stems">
              <p className="overline mb-3">{t("arr.label_stems")}</p>
              <ul className="space-y-3">
                {data.stems.map((s, i) => (
                  <li key={`${s.plant || "stem"}-${i}`} className="flex flex-wrap items-start gap-3">
                    <span
                      className={`overline px-2 py-0.5 border rounded-full text-[10px] ${
                        ROLE_STYLES[(s.role || "").toLowerCase()] || ROLE_STYLES.accent
                      }`}
                    >
                      {s.role}
                    </span>
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-medium text-forest">
                        {s.plant}{" "}
                        <span className="text-moss font-normal text-sm">· {s.count}</span>
                      </p>
                      {s.cutting_tip && (
                        <p className="text-sm text-ink/70 mt-0.5 leading-relaxed">{s.cutting_tip}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(data.build_steps) && data.build_steps.length > 0 && (
            <div className="mt-8" data-testid="arrangement-steps">
              <p className="overline mb-3">{t("arr.label_build")}</p>
              <ol className="space-y-2.5 list-decimal pl-5 marker:text-terracotta marker:font-semibold">
                {data.build_steps.map((s, i) => (
                  <li key={`step-${i}-${(s || "").slice(0, 30)}`} className="text-ink/80 leading-relaxed pl-1">{s}</li>
                ))}
              </ol>
            </div>
          )}

          {data.tip && (
            <div className="mt-8 p-5 bg-sand/60 border-l-2 border-terracotta">
              <p className="overline text-terracotta mb-1.5">{t("arr.label_tip")}</p>
              <p className="text-ink/80 italic leading-relaxed">{data.tip}</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => generate(true)}
              data-testid="arrangement-regenerate"
              className="btn-ghost inline-flex items-center gap-2 text-sm"
            >
              <RefreshCw strokeWidth={1.5} className="w-3.5 h-3.5" />
              {t("arr.regenerate")}
            </button>
            <Link to="/learn/flower-arranging" className="text-sm text-moss hover:text-terracotta">
              {t("arr.read_masterclass")}
            </Link>
          </div>
        </article>
      )}
    </section>
  );
}
