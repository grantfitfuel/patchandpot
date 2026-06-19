import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import { useI18n } from "@/i18n";

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

      {/* Legal strip — required for UK consumer / GDPR compliance */}
      <div className="border-t border-border">
        <div className="container-narrow py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-moss">
          <p data-testid="footer-copyright">
            © {COPYRIGHT_RANGE} Patch &amp; Pot. All rights reserved.
          </p>
          <nav className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-terracotta transition-colors" data-testid="footer-privacy-link">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-terracotta transition-colors" data-testid="footer-terms-link">
              Terms
            </Link>
            <a
              href="mailto:hello@patchandpot.app"
              className="hover:text-terracotta transition-colors"
              data-testid="footer-contact-link"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
