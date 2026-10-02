import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRegion } from "@/hooks/useRegion";
import MonthSelector from "@/components/MonthSelector";
import GuidanceView from "@/components/GuidanceView";
import RegionPicker from "@/components/RegionPicker";
import PaywallModal from "@/components/PaywallModal";
import RecommendedRail from "@/components/RecommendedRail";
import PageHero from "@/components/PageHero";
import { MapPin, Download, Lock, Loader2, Columns2 } from "lucide-react";
import { SeasonsMotif } from "@/components/illustrations/VibrantMotifs";
import { useI18n } from "@/i18n";
import { useMyGarden } from "@/hooks/useMyGarden";
import { usePaywall, getStoredAccessToken } from "@/hooks/usePaywall";
import { seasonalPdfUrl, fetchPlants } from "@/lib/api";

export default function CalendarPage() {
  const { region } = useRegion();
  const { t, lang } = useI18n();
  const { paid } = usePaywall();
  const { plants: myGarden } = useMyGarden();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [pickerOpen, setPickerOpen] = useState(!region);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  // Plants catalogue powers the Recommended-for-you rail (re-used /api/plants
  // cache from the Plants page if it's already been visited).
  const [allPlants, setAllPlants] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetchPlants(lang)
      .then((data) => { if (!cancelled) setAllPlants(Array.isArray(data) ? data : []); })
      .catch(() => { /* rail is non-essential; hide silently */ });
    return () => { cancelled = true; };
  }, [lang]);

  async function downloadSeasonalPdf() {
    if (!region) { setPickerOpen(true); return; }
    if (!paid) { setPaywallOpen(true); return; }
    setPdfBusy(true);
    setPdfError("");
    try {
      const res = await fetch(seasonalPdfUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          month,
          language: lang,
          orientation: "portrait",
          my_garden: (myGarden || []).map((p) => p.name || p),
          
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Open in a new tab for inline view; user can save from there.
      window.open(url, "_blank", "noopener,noreferrer");
      // Free the blob URL after a moment so the new tab has time to read it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error("seasonal pdf failed", e);
      setPdfError(t("calendar.pdf_error"));
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHero
        variant="forest"
        eyebrow={t("calendar.eyebrow")}
        title={t("calendar.title")}
        blurb={t("calendar.subtitle")}
        Motif={SeasonsMotif}
        actions={
          <>
            <Link
              to="/calendar/compare"
              data-testid="calendar-compare-link"
              className="inline-flex items-center gap-2 py-2.5 px-4 bg-sand text-forest hover:bg-butter transition-colors text-sm font-medium"
              style={{ borderRadius: "9999px" }}
            >
              <Columns2 className="w-4 h-4" strokeWidth={1.5} />
              {t("compare.calendar_link")}
            </Link>
            <button
              type="button"
              onClick={downloadSeasonalPdf}
              disabled={pdfBusy}
              data-testid="download-seasonal-pdf"
              className="inline-flex items-center gap-2 py-2.5 px-4 bg-terracotta text-sand hover:bg-coral transition-colors text-sm font-medium disabled:opacity-60"
              style={{ borderRadius: "9999px" }}
            >
              {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                : paid ? <Download className="w-4 h-4" strokeWidth={1.5} />
                : <Lock className="w-4 h-4" strokeWidth={1.5} />}
              {t("calendar.seasonal_pdf")}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              data-testid="calendar-region-btn"
              className="inline-flex items-center gap-2 py-2.5 px-4 border border-sand/40 text-sand hover:bg-sand/10 transition-colors text-sm"
              style={{ borderRadius: "9999px" }}
            >
              <MapPin className="w-4 h-4" strokeWidth={1.5} />
              {region ? `${region.name}${region.country ? `, ${region.country}` : ""}` : t("region.set")}
            </button>
          </>
        }
      />

      <div className="container-narrow py-10 md:py-14">
        {pdfError && <p className="text-sm text-terracotta mb-6">{pdfError}</p>}

        <div className="mb-10">
          <MonthSelector month={month} onChange={setMonth} />
        </div>

        <RecommendedRail
          plants={allPlants}
          region={region}
          month={month}
          excludeIds={(myGarden || []).map((p) => p?.id).filter(Boolean)}
        />

        <GuidanceView region={region} month={month} />
      </div>

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      {paywallOpen && (
        <PaywallModal
          onClose={() => setPaywallOpen(false)}
          onUnlocked={() => { setPaywallOpen(false); downloadSeasonalPdf(); }}
        />
      )}
    </div>
  );
}
