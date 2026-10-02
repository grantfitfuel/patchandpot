import { useState } from "react";
import { useRegion } from "@/hooks/useRegion";
import MonthSelector from "@/components/MonthSelector";
import GuidanceView from "@/components/GuidanceView";
import RegionPicker from "@/components/RegionPicker";
import PageHero from "@/components/PageHero";
import { BeeMotif } from "@/components/illustrations/VibrantMotifs";
import { MapPin } from "lucide-react";
import { useI18n } from "@/i18n";

export default function PestControlPage() {
  const { region } = useRegion();
  const { t } = useI18n();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [pickerOpen, setPickerOpen] = useState(!region);

  return (
    <div className="animate-fade-up">
      <PageHero
        variant="moss"
        eyebrow={t("pest.eyebrow")}
        title={t("pest.title")}
        blurb={t("pest.subtitle")}
        Motif={BeeMotif}
        actions={
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            data-testid="pest-region-btn"
            className="inline-flex items-center gap-2 py-2.5 px-4 border border-sand/40 text-sand hover:bg-sand/10 transition-colors text-sm"
            style={{ borderRadius: "9999px" }}
          >
            <MapPin className="w-4 h-4" strokeWidth={1.5} />
            {region ? `${region.name}` : t("region.set")}
          </button>
        }
      />

      <div className="container-narrow py-10 md:py-14">
        <div className="mb-10">
          <MonthSelector month={month} onChange={setMonth} />
        </div>

        <GuidanceView region={region} month={month} view="pests" />
      </div>

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
