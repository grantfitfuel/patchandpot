import { useState } from "react";
import { Link } from "react-router-dom";
import { useRegion } from "@/hooks/useRegion";
import MonthSelector from "@/components/MonthSelector";
import GuidanceView from "@/components/GuidanceView";
import RegionPicker from "@/components/RegionPicker";
import { MapPin, Download } from "lucide-react";
import { useI18n } from "@/i18n";

export default function CalendarPage() {
  const { region } = useRegion();
  const { t } = useI18n();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [pickerOpen, setPickerOpen] = useState(!region);

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="overline">{t("calendar.eyebrow")}</p>
          <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
            {t("calendar.title")}
          </h1>
          <p className="mt-3 text-ink/75 max-w-xl">{t("calendar.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={region ? `/print/${month}` : "/calendar"}
            data-testid="download-month-btn"
            aria-disabled={!region}
            onClick={(e) => { if (!region) { e.preventDefault(); setPickerOpen(true); } }}
            className="btn-terracotta inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            {t("download.button")}
          </Link>
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

      <div className="mb-10">
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <GuidanceView region={region} month={month} />

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
