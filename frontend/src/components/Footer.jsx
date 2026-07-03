import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import { useI18n } from "@/i18n";
import TipJar from "@/components/TipJar";

const CURRENT_YEAR = new Date().getFullYear();
const COPYRIGHT_RANGE = CURRENT_YEAR > 2025 ? `2025–${CURRENT_YEAR}` : "2025";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-surface mt-auto print:hidden" data-testid="site-footer">
      <div className="container-narrow py-12 grid md:grid-cols-3 gap-8 text-sm text-moss">
        <div>
          <div className="flex items-center gap-2 text-forest">
            <Sprout strokeWidth={1.5} className="w-5 h-5" />
            <span className="font-serif text-xl">Patch &amp; Pot</span>
          </div>
          <p className="mt-3 max-w-xs leading-relaxed">{t("footer.tagline")}</p>
        </div>
        <div>
          <p className="overline mb-3">{t("footer.explore")}</p>
          <ul className="space-y-2">
            <li>{t("nav.calendar")}</li>
            <li>{t("nav.plants")}</li>
            <li>{t("nav.pests")}</li>
            <li>{t("nav.garden")}</li>
          </ul>
        </div>
        <div>
          <p className="overline mb-3">{t("footer.note.title")}</p>
          <p className="leading-relaxed">{t("footer.note.body")}</p>
        </div>
      </div>

      {/* Legal strip — required for UK consumer / GDPR compliance. */}
      <div className="border-t border-border">
        <div className="container-narrow py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-moss">
          <p data-testid="footer-copyright">
            © {COPYRIGHT_RANGE} Grant Cameron Anthony, {t("footer.trading_as")} Patch &amp; Pot. {t("footer.rights")}
          </p>
          <nav className="flex flex-wrap items-center justify-start md:justify-end gap-x-5 gap-y-2">
            <TipJar />
            <Link to="/about" className="hover:text-terracotta transition-colors" data-testid="footer-about-link">
              {t("footer.legal.about")}
            </Link>
            <Link to="/patrons" className="hover:text-terracotta transition-colors" data-testid="footer-patrons-link">
              Patrons
            </Link>
            <Link to="/privacy" className="hover:text-terracotta transition-colors" data-testid="footer-privacy-link">
              {t("footer.legal.privacy")}
            </Link>
            <Link to="/terms" className="hover:text-terracotta transition-colors" data-testid="footer-terms-link">
              {t("footer.legal.terms")}
            </Link>
            <Link to="/terms#affiliates" className="hover:text-terracotta transition-colors" data-testid="footer-disclosure-link">
              {t("footer.legal.disclosure")}
            </Link>
            <a
              href="mailto:hello@patchandpot.com"
              className="hover:text-terracotta transition-colors"
              data-testid="footer-contact-link"
            >
              {t("footer.legal.contact")}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
