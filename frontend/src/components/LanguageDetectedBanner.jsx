import { X } from "lucide-react";
import { useI18n, LANGUAGES } from "@/i18n";

/**
 * Small, polite banner shown ONLY on a user's first visit when their browser language
 * differs from English and we've auto-switched the UI on their behalf. Lets them keep
 * the detected language or switch back to English in one tap. Persists dismissal in
 * localStorage so it never reappears.
 */
export default function LanguageDetectedBanner() {
  const { lang, setLang, autoDetected, dismissAutoDetectedBanner, t } = useI18n();

  if (!autoDetected) return null;

  const entry = LANGUAGES.find((l) => l.code === lang);
  const langName = entry?.label || lang;
  const flag = entry?.flag || "";

  return (
    <div
      role="status"
      data-testid="lang-detected-banner"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-2rem)]
                 bg-forest text-sand shadow-lg border border-forest/70
                 animate-fade-up"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-xl leading-none mt-0.5 flex-shrink-0" aria-hidden="true">{flag}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug">
            {t("lang.detected", { name: langName })}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              data-testid="lang-detected-keep"
              onClick={dismissAutoDetectedBanner}
              className="text-xs uppercase tracking-wider underline underline-offset-4 hover:text-white"
            >
              {t("lang.detected.keep", { name: langName })}
            </button>
            <button
              type="button"
              data-testid="lang-detected-switch-en"
              onClick={() => {
                setLang("en");
                dismissAutoDetectedBanner();
              }}
              className="text-xs uppercase tracking-wider text-sand/70 hover:text-white"
            >
              {t("lang.detected.action")}
            </button>
          </div>
        </div>
        <button
          type="button"
          data-testid="lang-detected-close"
          aria-label={t("share.close")}
          onClick={dismissAutoDetectedBanner}
          className="p-1 text-sand/70 hover:text-white"
        >
          <X strokeWidth={1.5} className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
