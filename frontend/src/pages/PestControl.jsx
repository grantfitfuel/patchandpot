import { useState } from "react";
import { useRegion } from "@/hooks/useRegion";
import MonthSelector from "@/components/MonthSelector";
import GuidanceView from "@/components/GuidanceView";
import RegionPicker from "@/components/RegionPicker";
import { MapPin } from "lucide-react";

export default function PestControlPage() {
  const { region } = useRegion();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [pickerOpen, setPickerOpen] = useState(!region);

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="overline">Pest &amp; disease watch</p>
          <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
            What to watch for this month
          </h1>
          <p className="mt-3 text-ink/75 max-w-xl">
            Common pests and diseases that show up in your climate &amp; month — with organic-first
            controls.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          data-testid="pest-region-btn"
          className="btn-ghost inline-flex items-center gap-2"
        >
          <MapPin className="w-4 h-4" strokeWidth={1.5} />
          {region ? `${region.name}` : "Set your region"}
        </button>
      </div>

      <div className="mb-10">
        <MonthSelector month={month} onChange={setMonth} />
      </div>

      <GuidanceView region={region} month={month} view="pests" />

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
