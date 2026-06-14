import { Sprout } from "lucide-react";
import { useI18n } from "@/i18n";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-surface mt-auto print:hidden">
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
    </footer>
  );
}
