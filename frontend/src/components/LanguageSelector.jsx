import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { LANGUAGES, useI18n } from "@/i18n";

export default function LanguageSelector({ compact = false }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="language-selector-trigger"
        aria-label={t("lang.label")}
        className="flex items-center gap-2 text-sm text-forest border border-forest/30 px-3 py-2 hover:bg-forest/5 transition-colors"
      >
        <Globe strokeWidth={1.5} className="w-4 h-4" />
        {!compact && <span>{current.label}</span>}
        {compact && <span>{current.code.toUpperCase()}</span>}
      </button>
      {open && (
        <ul
          data-testid="language-selector-menu"
          className="absolute right-0 mt-1 w-44 bg-sand border border-border shadow-md z-30"
        >
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => { setLang(l.code); setOpen(false); }}
                data-testid={`language-option-${l.code}`}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-surface ${
                  l.code === lang ? "text-forest font-medium" : "text-ink/80"
                }`}
              >
                <span>{l.label}</span>
                {l.code === lang && <Check strokeWidth={1.5} className="w-4 h-4 text-forest" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
