import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// English is the canonical fallback — always bundled in the main chunk so
// the UI never renders raw `i18n.key.foo` placeholders while the active
// locale is mid-download. Every other locale is dynamically imported only
// when first selected, which keeps the initial JS payload tiny (~35 KB
// for English instead of ~2 MB for all 58 languages).
import en from "@/i18n/locales/en";

// In-memory cache of locales we've already fetched in this session.
const LOADED = { en };

// Promise cache so concurrent t() calls during an in-flight load don't
// each trigger a duplicate fetch.
const PENDING = {};

function loadLocale(code) {
  if (LOADED[code]) return Promise.resolve(LOADED[code]);
  if (PENDING[code]) return PENDING[code];
  // Vite/webpack code-splits each dynamic import into its own chunk.
  // Locale codes are validated against the LANGUAGES list upstream, so
  // we never reach this function with an attacker-controlled string.
  PENDING[code] = import(
    /* webpackChunkName: "i18n-[request]" */
    `@/i18n/locales/${code}.js`
  )
    .then((mod) => {
      LOADED[code] = mod.default || mod;
      delete PENDING[code];
      return LOADED[code];
    })
    .catch((err) => {
      console.warn(`i18n: failed to load locale "${code}" — falling back to English.`, err);
      delete PENDING[code];
      // Cache English under the failed code so we don't retry endlessly.
      LOADED[code] = en;
      return en;
    });
  return PENDING[code];
}

export const LANGUAGES = [
  { code: "en", label: "English",     flag: "🇬🇧" },
  { code: "de", label: "Deutsch",     flag: "🇩🇪" },
  { code: "es", label: "Español",     flag: "🇪🇸" },
  { code: "fr", label: "Français",    flag: "🇫🇷" },
  { code: "ga", label: "Gaeilge",     flag: "🇮🇪" },
  { code: "gd", label: "Gàidhlig",    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { code: "cy", label: "Cymraeg",     flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { code: "da", label: "Dansk",       flag: "🇩🇰" },
  { code: "nb", label: "Norsk",       flag: "🇳🇴" },
  { code: "sv", label: "Svenska",     flag: "🇸🇪" },
  { code: "is", label: "Íslenska",    flag: "🇮🇸" },
  { code: "fi", label: "Suomi",       flag: "🇫🇮" },
  { code: "nl", label: "Nederlands",  flag: "🇳🇱" },
  { code: "pt", label: "Português",   flag: "🇵🇹" },
  { code: "it", label: "Italiano",    flag: "🇮🇹" },
  { code: "el", label: "Ελληνικά",   flag: "🇬🇷" },
  { code: "pl", label: "Polski",      flag: "🇵🇱" },
  { code: "cs", label: "Čeština",     flag: "🇨🇿" },
  { code: "sk", label: "Slovenčina",  flag: "🇸🇰" },
  { code: "sl", label: "Slovenščina", flag: "🇸🇮" },
  { code: "hr", label: "Hrvatski",    flag: "🇭🇷" },
  { code: "bg", label: "Български",   flag: "🇧🇬" },
  { code: "ro", label: "Română",      flag: "🇷🇴" },
  { code: "hu", label: "Magyar",      flag: "🇭🇺" },
  { code: "et", label: "Eesti",       flag: "🇪🇪" },
  { code: "lv", label: "Latviešu",    flag: "🇱🇻" },
  { code: "lt", label: "Lietuvių",    flag: "🇱🇹" },
  { code: "mt", label: "Malti",       flag: "🇲🇹" },
  { code: "uk", label: "Українська",  flag: "🇺🇦" },
  { code: "ja", label: "日本語",       flag: "🇯🇵" },
  { code: "zh", label: "中文",         flag: "🇨🇳" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "bn", label: "বাংলা", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
  { code: "mr", label: "मराठी", flag: "🇮🇳" },
  { code: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { code: "gu", label: "ગુજરાતી", flag: "🇮🇳" },
  { code: "ur", label: "اردو", flag: "🇵🇰" },
  { code: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml", label: "മലയാളം", flag: "🇮🇳" },
  { code: "pa", label: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "tl", label: "Filipino", flag: "🇵🇭" },
  { code: "mi", label: "Māori", flag: "🇳🇿" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "be", label: "Беларуская", flag: "🇧🇾" },
  { code: "kk", label: "Қазақша", flag: "🇰🇿" },
  { code: "uz", label: "Oʻzbekcha", flag: "🇺🇿" },
  { code: "az", label: "Azərbaycanca", flag: "🇦🇿" },
  { code: "ky", label: "Кыргызча", flag: "🇰🇬" },
  { code: "hy", label: "Հայերեն", flag: "🇦🇲" },
  { code: "ka", label: "ქართული", flag: "🇬🇪" },
];

const KEY = "patchpot.lang.v1";
const AUTO_KEY = "patchpot.lang.auto_detected.v1";
const I18nContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
  autoDetected: false,
  dismissAutoDetectedBanner: () => {},
});

// Set of all valid locale codes derived from the LANGUAGES metadata above.
// We use this for quick "is this code real?" guards without having to load
// every locale's strings upfront.
const VALID_CODES = new Set(LANGUAGES.map((l) => l.code));

// Persistent first-time auto-detect. Strict Mode runs initialisers twice; we
// use localStorage as the source of truth for "did we auto-detect on this
// user's first visit?" so the second init pass keeps the flag rather than
// clearing it.
function readInitialLang() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && VALID_CODES.has(stored)) {
      return { lang: stored, autoDetected: localStorage.getItem(AUTO_KEY) === "1" };
    }
  } catch (e) {
    console.warn("i18n: localStorage read failed", e);
  }
  if (typeof navigator !== "undefined") {
    const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (VALID_CODES.has(browser) && browser !== "en") {
      try {
        localStorage.setItem(KEY, browser);
        localStorage.setItem(AUTO_KEY, "1");
      } catch (e) {
        console.warn("i18n: localStorage write failed", e);
      }
      return { lang: browser, autoDetected: true };
    }
  }
  return { lang: "en", autoDetected: false };
}

// Languages written right-to-left.
const RTL_LANGS = new Set(["ar", "ur", "he", "fa"]);

export function I18nProvider({ children }) {
  const [{ lang, autoDetected }, setLangAndAuto] = useState(readInitialLang);

  // The active dictionary — starts as English (statically imported), then
  // gets swapped to the lazy-loaded one once the user's language finishes
  // downloading. The English fallback in t() means the UI never flashes raw
  // i18n keys while a locale chunk is en-route.
  const [dict, setDict] = useState(() => (lang === "en" ? en : en));
  const dictLangRef = useRef("en");

  useEffect(() => {
    let cancelled = false;
    if (lang === "en") {
      setDict(en);
      dictLangRef.current = "en";
      return;
    }
    loadLocale(lang).then((d) => {
      if (!cancelled) {
        setDict(d);
        dictLangRef.current = lang;
      }
    });
    return () => { cancelled = true; };
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, lang);
    } catch (e) {
      console.warn("i18n: persist failed", e);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
    }
  }, [lang]);

  const setLang = useCallback((code) => {
    if (VALID_CODES.has(code)) {
      try {
        localStorage.removeItem(AUTO_KEY);
      } catch (e) {
        console.warn("i18n: clear auto-flag failed", e);
      }
      setLangAndAuto({ lang: code, autoDetected: false });
    }
  }, []);

  const dismissAutoDetectedBanner = useCallback(() => {
    try {
      localStorage.removeItem(AUTO_KEY);
    } catch (e) {
      console.warn("i18n: dismiss banner persist failed", e);
    }
    setLangAndAuto((prev) => ({ ...prev, autoDetected: false }));
  }, []);

  const t = useCallback(
    (key, vars) => {
      // Three-tier fallback: active dict → English → the key itself. If the
      // active locale is still loading, dictLangRef !== lang and dict is
      // still EN, so we transparently render English until the chunk
      // arrives — the same UX every previous version of this provider had.
      let s = (dict && dict[key]) || en[key] || key;
      if (vars) {
        Object.keys(vars).forEach((k) => {
          s = s.replace(`{${k}}`, vars[k]);
        });
      }
      return s;
    },
    [dict]
  );

  return (
    <I18nContext.Provider
      value={{ lang, setLang, t, autoDetected, dismissAutoDetectedBanner }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function monthLabel(month, t) {
  const keys = [
    "month.january", "month.february", "month.march", "month.april",
    "month.may", "month.june", "month.july", "month.august",
    "month.september", "month.october", "month.november", "month.december",
  ];
  return t(keys[month - 1]);
}
