import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { useI18n } from "@/i18n";
import { PRIVACY_SECTIONS, LAST_UPDATED, PRIVACY_INTRO_HTML } from "@/data/legal-content";

/**
 * UK-GDPR / ICO-compliant privacy notice. Renders from `legal-content.js` so
 * the same sections can be cleanly translated via i18n while preserving the
 * inline <strong>, <a>, <ul> markup. The English version is the
 * legally-authoritative one — a banner makes that explicit on translated views.
 */
export default function PrivacyPage() {
  const { t, lang, setLang } = useI18n();
  const isEnglish = (lang || "en").toLowerCase().startsWith("en");

  return (
    <div className="container-narrow py-14 md:py-20 max-w-3xl" data-testid="privacy-page">
      <Helmet>
        <title>{t("legal.privacy.page_title")}</title>
        <meta name="description" content={t("legal.privacy.page_description")} />
        <link rel="canonical" href="/privacy" />
      </Helmet>

      <p className="overline">{t("legal.eyebrow")}</p>
      <h1 className="font-serif text-5xl text-forest mt-2 tracking-tight">{t("legal.privacy.heading")}</h1>
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
        dangerouslySetInnerHTML={{ __html: t("legal.privacy.intro_html") }}
      />

      {PRIVACY_SECTIONS.map((s) => {
        // Prefer translated copy; fall back to the canonical English `title`/`html`
        // already defined alongside the key so missing translations never render
        // as raw i18n keys.
        const title = (() => {
          const v = t(s.titleKey);
          return v === s.titleKey ? s.title : v;
        })();
        const html = (() => {
          const v = t(s.htmlKey);
          return v === s.htmlKey ? s.html : v;
        })();
        return <Section key={s.titleKey} title={title} html={html} />;
      })}

      <div className="mt-14 pt-8 border-t border-border text-sm text-moss">
        <Link to="/terms" className="link" data-testid="privacy-to-terms">{t("legal.privacy.read_terms")}</Link>
      </div>
    </div>
  );
}

function Section({ title, html }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-forest mb-3">{title}</h2>
      <div
        className="text-ink/80 leading-relaxed legal-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
