import { ChevronLeft, ChevronRight } from "lucide-react";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MonthSelector({ month, onChange }) {
  const prev = () => onChange(month === 1 ? 12 : month - 1);
  const next = () => onChange(month === 12 ? 1 : month + 1);

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="month-selector">
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
          {MONTHS[month - 1]}
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
        {MONTHS.map((m, i) => (
          <button
            key={m}
            data-testid={`month-chip-${i + 1}`}
            onClick={() => onChange(i + 1)}
            className={`text-xs px-3 py-1.5 border transition-colors ${
              month === i + 1
                ? "bg-forest text-sand border-forest"
                : "bg-sand text-ink/70 border-border hover:border-forest/50"
            }`}
          >
            {m.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}
