import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n, monthLabel } from "@/i18n";

export default function MonthSelector({ month, onChange }) {
  const { t, lang } = useI18n();
  const [, force] = useState(0);
  useEffect(() => { force((n) => n + 1); }, [lang]);

  const prev = () => onChange(month === 1 ? 12 : month - 1);
  const next = () => onChange(month === 12 ? 1 : month + 1);

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden" data-testid="month-selector">
      <div className="flex items-center border border-border bg-sand">
        <button
          type="button"
          data-testid="month-prev"
          onClick={prev}
          className="px-3 py-2 hover:bg-surface text-forest"
          aria-label="Previous month"
        >
          <ChevronLeft strokeWidth={1.5} className="w-4 h-4" />
        </button>
        <div className="px-5 font-serif text-xl text-forest" data-testid="current-month-label">
          {monthLabel(month, t)}
        </div>
        <button
          type="button"
          data-testid="month-next"
          onClick={next}
          className="px-3 py-2 hover:bg-surface text-forest"
          aria-label="Next month"
        >
          <ChevronRight strokeWidth={1.5} className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
          <button
            key={i}
            data-testid={`month-chip-${i}`}
            onClick={() => onChange(i)}
            className={`text-xs px-3 py-1.5 border transition-colors ${
              month === i
                ? "bg-forest text-sand border-forest"
                : "bg-sand text-ink/70 border-border hover:border-forest/50"
            }`}
          >
            {monthLabel(i, t).slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}
