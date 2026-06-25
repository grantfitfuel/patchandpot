import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { useI18n } from "@/i18n";
import { TERMS_SECTIONS, LAST_UPDATED, TERMS_INTRO_HTML } from "@/data/legal-content";

/**
 * Terms of Service. UK consumer-law-aware (14-day digital-content cooling-off
 * + 30-day refund), AI-advice disclaimer, governed by Scots law. The English
 * version is the authoritative one; translated views show a banner saying so.
 */
export default function TermsPage() {
  const { t, lang, setLang } = useI18n();
  const isEnglish = (lang || "en").toLowerCase().startsWith("en");

  return (
    <div className="container-narrow py-14 md:py-20 max-w-3xl" data-testid="terms-page">
      <Helmet>
        <title>{t("legal.terms.page_title")}</title>
        <meta name="description" content={t("legal.terms.page_description")} />
        <link rel="canonical" href="/terms" />
      </Helmet>

      <p className="overline">{t("legal.eyebrow")}</p>
      <h1 className="font-serif text-5xl text-forest mt-2 tracking-tight">{t("legal.terms.heading")}</h1>
      <p className="text-sm text-moss mt-3">
        {t("legal.last_updated", { date: LAST_UPDATED })}
      </p>

      {!isEnglish && (
        <div className="mt-6 p-4 bg-sand/70 border-l-2 border-terracotta text-sm text-ink/80 leading-relaxed" data-testid="legal-translation-banner">
          <p className="flex gap-2.5">
            <Info strokeWidth={1.5} className="w-4 h-4 mt-0.5 text-terracotta flex-shrink-0" />
            <span>
              {t("legal.banner.notice")}{" "}
              <button
                type="button"
                onClick={() => setLang("en")}
                className="link underline"
                data-testid="legal-banner-en-link"
              >
                {t("legal.banner.read_en")}
              </button>
              .
            </span>
          </p>
        </div>
      )}

      <p
        className="mt-8 text-ink/80 leading-relaxed text-lg legal-body"
        dangerouslySetInnerHTML={{ __html: t("legal.terms.intro_html") }}
      />

      {TERMS_SECTIONS.map((s) => (
        <Section key={s.titleKey} title={t(s.titleKey)} html={t(s.htmlKey)} slug={s.titleKey} />
      ))}

      <div className="mt-14 pt-8 border-t border-border text-sm text-moss">
        <Link to="/privacy" className="link" data-testid="terms-to-privacy">{t("legal.terms.read_privacy")}</Link>
      </div>
    </div>
  );
}

function Section({ title, html, slug }) {
  // Convert "legal.terms.affiliates.title" -> "affiliates" so anchor links like
  // /terms#affiliates jump to the relevant section (e.g. footer Disclosure link).
  const anchor = slug ? slug.split(".").slice(-2, -1)[0] : undefined;
  return (
    <section className="mt-10" id={anchor}>
      <h2 className="font-serif text-2xl text-forest mb-3">{title}</h2>
      <div
        className="text-ink/80 leading-relaxed legal-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
