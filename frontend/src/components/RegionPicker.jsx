import { useEffect, useMemo, useState } from "react";
import { Crosshair, Search, X, Loader2 } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { searchRegions, reverseGeocode, ipDetectRegion } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function RegionPicker({ open, onClose }) {
  const { region, setRegion, defaultRegion } = useRegion();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t2 = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchRegions(query);
        setResults(data.results || []);
      } catch (e) {
        setError(t("region.search_failed"));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t2);
  }, [query]);

  const hemisphereFor = (lat) => (lat < 0 ? "southern" : "northern");
  const climateFor = (lat) => {
    const a = Math.abs(lat);
    if (a < 23.5) return t("climate.tropical");
    if (a < 35) return t("climate.subtropical");
    if (a < 55) return t("climate.temperate");
    if (a < 66.5) return t("climate.cool_temperate");
    return t("climate.polar");
  };

  const pick = (r) => {
    setRegion({
      name: r.name,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
      hemisphere: hemisphereFor(r.latitude),
      climate_zone: climateFor(r.latitude),
    });
    onClose();
  };

  const detect = () => {
    setLocating(true);
    setError("");

    // Fallback path: hit the backend's IP-detect endpoint when the browser
    // Geolocation API isn't available, is denied, or times out. This is
    // what makes geo-detect actually work for desktops without GPS, users
    // who once dismissed the permission prompt, and shared-IP networks.
    const ipFallback = async () => {
      try {
        const data = await ipDetectRegion();
        setRegion(data);
        onClose();
      } catch (e) {
        setError(t("region.detect_failed"));
      } finally {
        setLocating(false);
      }
    };

    if (!("geolocation" in navigator)) {
      ipFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          setRegion(data);
          onClose();
        } catch (e) {
          // Reverse-geocode failed even though GPS worked — try IP route.
          await ipFallback();
          return;
        }
        setLocating(false);
      },
      async () => {
        // GPS denied / timed out / unavailable — silently try IP-based.
        await ipFallback();
      },
      // enableHighAccuracy=false + a 10-minute maximumAge make this *much*
      // faster on mobile (no GPS warm-up) and tolerate slower networks.
      { timeout: 15000, maximumAge: 600000, enableHighAccuracy: false },
    );
  };

  const useDefault = () => {
    setRegion(defaultRegion);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      data-testid="region-picker-modal"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 bg-ink/40 backdrop-blur-sm animate-fade-up"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-sand w-full max-w-xl border border-border shadow-xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="overline">{t("region.subtitle")}</p>
            <h2 className="font-serif text-2xl text-forest mt-1">{t("region.title")}</h2>
          </div>
          <button onClick={onClose} data-testid="region-picker-close" aria-label="Close" className="text-moss hover:text-forest">
            <X strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <button
            type="button"
            data-testid="region-detect-btn"
            onClick={detect}
            disabled={locating}
            className="w-full flex items-center justify-center gap-2 btn-forest"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" strokeWidth={1.5} />}
            {locating ? t("region.detecting") : t("region.detect")}
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-moss" strokeWidth={1.5} />
            <input
              data-testid="region-search-input"
              type="text"
              placeholder={t("region.search_placeholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-3 bg-surface border border-border focus:border-forest outline-none text-ink"
            />
          </div>

          {loading && <p className="text-sm text-moss">{t("region.searching")}</p>}
          {error && <p className="text-sm text-terracotta" data-testid="region-error">{error}</p>}

          {results.length > 0 && (
            <ul data-testid="region-results" className="divide-y divide-border border border-border max-h-72 overflow-y-auto">
              {results.map((r, i) => {
                const subtitle = [r.admin, r.country].filter(Boolean).join(", ");
                return (
                  <li key={`${r.name}-${i}`}>
                    <button
                      type="button"
                      data-testid={`region-result-${i}`}
                      onClick={() => pick(r)}
                      className="w-full text-left px-4 py-3 hover:bg-surface transition-colors"
                    >
                      <div className="font-medium text-ink">{r.name}</div>
                      <div className="text-xs text-moss">{subtitle}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!region && (
            <button onClick={useDefault} data-testid="region-default-btn" className="btn-ghost w-full">
              {t("region.use_default")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
