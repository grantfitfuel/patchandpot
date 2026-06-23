import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Heart, Sparkles, ArrowRight, Users } from "lucide-react";
import { fetchPatrons } from "@/lib/api";
import { useI18n } from "@/i18n";

/**
 * Public Patrons page — opt-in display of supporters grouped by tier.
 *
 * No PII surfaces here: only display names that each supporter actively
 * submitted on /checkout/success. Empty groups are hidden, and an empty
 * page (zero patrons) shows a soft "be the first" call-to-action that
 * links back to the Founding offer instead of a depressing void.
 *
 * The tier ordering and labels live server-side so the page stays in sync
 * if we ever rename a package_id.
 */
export default function PatronsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    fetchPatrons()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const total = data?.total ?? 0;
  const groups = data?.groups ?? [];

  return (
    <div className="container-narrow py-16 md:py-24" data-testid="patrons-page">
      <Helmet>
        <title>Our Patrons — Patch &amp; Pot</title>
        <meta
          name="description"
          content="The people whose support keeps Patch & Pot independent, affordable and ad-free. Listed with their permission — first names, no emails, no amounts."
        />
      </Helmet>

      <header className="mb-12 md:mb-16 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <Heart strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
          <span className="overline">Our Patrons</span>
        </div>
        <h1 className="font-serif text-4xl md:text-6xl text-forest leading-tight">
          The people who keep this growing.
        </h1>
        <p
          className="mt-5 max-w-2xl mx-auto text-ink/75 leading-relaxed text-lg"
          data-testid="patrons-intro"
        >
          Patch &amp; Pot is small, independent, and ad-free. These supporters
          chose to chip in so it stays that way — and chose to be listed here
          with their permission. We&apos;re grateful to every one of them.
        </p>
        {total > 0 && (
          <p
            className="mt-6 inline-flex items-center gap-2 text-sm text-moss"
            data-testid="patrons-total"
          >
            <Users strokeWidth={1.5} className="w-4 h-4" />
            {total} {total === 1 ? "patron" : "patrons"} listed
          </p>
        )}
      </header>

      {error && (
        <p className="text-sm text-terracotta text-center" data-testid="patrons-error">
          Couldn&apos;t load the patrons list right now. Please try again in a moment.
        </p>
      )}

      {!error && data && total === 0 && (
        <div className="text-center max-w-md mx-auto" data-testid="patrons-empty">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-terracotta/10 mb-5">
            <Sparkles strokeWidth={1.5} className="w-7 h-7 text-terracotta" />
          </div>
          <h2 className="font-serif text-2xl text-forest">Be the first.</h2>
          <p className="mt-3 text-ink/70 leading-relaxed">
            Nobody has been listed yet — which means whoever joins next gets
            top billing on this page, forever. Founding Member spots are still
            open at £35 for lifetime access.
          </p>
          <Link
            to="/?founding=1"
            data-testid="patrons-empty-cta"
            className="mt-6 btn-terracotta inline-flex items-center gap-2"
          >
            See the Founding offer
            <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
          </Link>
        </div>
      )}

      {!error && data && total > 0 && (
        <div className="space-y-14">
          {groups.map((g) => (
            <section
              key={g.tier}
              data-testid={`patrons-group-${g.tier}`}
              className="border-t border-border pt-8"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
                <h2 className="font-serif text-2xl md:text-3xl text-forest">{g.label}</h2>
                <span className="text-xs uppercase tracking-wider text-moss">
                  {g.count} {g.count === 1 ? "supporter" : "supporters"}
                </span>
              </div>
              <ul
                className={`grid gap-x-6 gap-y-3 ${
                  g.tier === "lifetime_founding"
                    ? "grid-cols-1 sm:grid-cols-2"   // Founding gets more breathing room
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                }`}
              >
                {g.names.map((n) => (
                  <li
                    key={n}
                    className={`${
                      g.tier === "lifetime_founding"
                        ? "font-serif text-xl text-forest"
                        : "text-base text-ink/85"
                    }`}
                  >
                    {n}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section
        className="mt-16 border-y border-border bg-sand/40 py-8 px-6 text-center"
        data-testid="patrons-retro-cta"
      >
        <p className="overline">{t("patrons.retro.eyebrow")}</p>
        <h2 className="font-serif text-2xl text-forest mt-2">{t("patrons.retro.title")}</h2>
        <p className="mt-2 text-sm text-ink/70 max-w-md mx-auto leading-relaxed">
          {t("patrons.retro.body")}
        </p>
        <Link
          to="/patrons/manage"
          data-testid="patrons-retro-cta-link"
          className="mt-5 btn-terracotta inline-flex items-center gap-2"
        >
          {t("patrons.retro.cta")}
          <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
        </Link>
      </section>

      <footer className="mt-12 pt-8 border-t border-border text-center">
        <p className="text-xs text-moss leading-relaxed max-w-xl mx-auto">
          {t("patrons.footer.prefix")}{" "}
          <Link
            to="/patrons/manage"
            className="underline-offset-4 hover:underline text-forest"
            data-testid="patrons-page-manage-link"
          >
            {t("patrons.footer.link")}
          </Link>
          {" "}{t("patrons.footer.suffix")}{" "}
          <a href="mailto:hello@patchandpot.com" className="underline-offset-4 hover:underline text-forest">
            hello@patchandpot.com
          </a>
          {" "}{t("patrons.footer.email_suffix")}
        </p>
      </footer>
    </div>
  );
}
