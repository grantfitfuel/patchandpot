import { useState } from "react";
import { Link } from "react-router-dom";
import { useRegion } from "@/hooks/useRegion";
import MonthSelector from "@/components/MonthSelector";
import GuidanceView from "@/components/GuidanceView";
import RegionPicker from "@/components/RegionPicker";
import PaywallModal from "@/components/PaywallModal";
import { MapPin, Download, Lock, Loader2, Columns2 } from "lucide-react";
import { monthlyIllustration } from "@/components/illustrations/MonthlyIllustrations";
import { useI18n } from "@/i18n";
import { useMyGarden } from "@/hooks/useMyGarden";
import { usePaywall, getStoredAccessToken } from "@/hooks/usePaywall";
import { seasonalPdfUrl } from "@/lib/api";

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
  const MonthlyIllo = monthlyIllustration(month);

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
          access_token: getStoredAccessToken(),
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
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div className="flex items-start gap-5 min-w-0">
          <div className="hidden sm:block w-16 h-16 md:w-20 md:h-20 text-terracotta flex-shrink-0 mt-1">
            <MonthlyIllo />
          </div>
          <div className="min-w-0">
            <p className="overline">{t("calendar.eyebrow")}</p>
            <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
              {t("calendar.title")}
            </h1>
            <p className="mt-3 text-ink/75 max-w-xl">{t("calendar.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/calendar/compare"
            data-testid="calendar-compare-link"
            className="btn-ghost inline-flex items-center gap-2"
          >
            <Columns2 className="w-4 h-4" strokeWidth={1.5} />
            {t("compare.calendar_link")}
          </Link>
          <button
            type="button"
            onClick={downloadSeasonalPdf}
            disabled={pdfBusy}
            data-testid="download-seasonal-pdf"
            className="btn-terracotta inline-flex items-center gap-2 disabled:opacity-60"
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
            className="btn-ghost inline-flex items-center gap-2"
          >
            <MapPin className="w-4 h-4" strokeWidth={1.5} />
            {region ? `${region.name}${region.country ? `, ${region.country}` : ""}` : t("region.set")}
          </button>
        </div>
      </div>

      {pdfError && <p className="text-sm text-terracotta -mt-6 mb-6">{pdfError}</p>}

      <div className="mb-10">
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <GuidanceView region={region} month={month} />

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
