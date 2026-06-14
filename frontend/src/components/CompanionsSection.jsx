import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HandHelping } from "lucide-react";
import { fetchCompanions } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function CompanionsSection({ plantId }) {
  const { t } = useI18n();
  const [companions, setCompanions] = useState(null);

  useEffect(() => {
    fetchCompanions(plantId).then((d) => setCompanions(d.companions)).catch(() => setCompanions([]));
  }, [plantId]);

  if (companions === null) return null;

  return (
    <section className="mt-14 border-t border-border pt-10" data-testid="companions-section">
      <div className="flex items-center gap-3 mb-5">
        <HandHelping strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{t("companions.title")}</span>
      </div>

      {companions.length === 0 ? (
        <p className="text-moss text-sm" data-testid="companions-empty">{t("companions.empty")}</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4" data-testid="companions-list">
          {companions.map((c) => (
            <li key={c.id} className="card-flat p-5">
              <Link to={`/plants/${c.id}`} className="block" data-testid={`companion-${c.id}`}>
                <p className="overline">{c.category}</p>
                <h3 className="font-serif text-2xl text-forest mt-1">{c.name}</h3>
                {c.reason && <p className="text-sm text-ink/80 mt-3 leading-relaxed">{c.reason}</p>}
                {!c.reason && <p className="text-sm text-moss mt-3 leading-relaxed">{c.summary}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
