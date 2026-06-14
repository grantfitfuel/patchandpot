import { Link, NavLink } from "react-router-dom";
import { Sprout, MapPin } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import RegionPicker from "@/components/RegionPicker";
import LanguageSelector from "@/components/LanguageSelector";
import { useState } from "react";
import { useI18n } from "@/i18n";

export default function Header() {
  const { region } = useRegion();
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  const NAV = [
    { to: "/", label: t("nav.home"), key: "home" },
    { to: "/calendar", label: t("nav.calendar"), key: "calendar" },
    { to: "/plants", label: t("nav.plants"), key: "plants" },
    { to: "/pests", label: t("nav.pests"), key: "pests" },
    { to: "/garden", label: t("nav.garden"), key: "garden" },
    { to: "/guides", label: t("nav.guides"), key: "guides" },
  ];

  return (
    <header
      data-testid="app-header"
      className="border-b border-border bg-sand relative z-20 print:hidden"
    >
      <div className="container-narrow flex items-center justify-between py-5 gap-6">
        <Link to="/" data-testid="logo-link" className="flex items-center gap-2 text-forest">
          <Sprout strokeWidth={1.5} className="w-6 h-6" />
          <span className="font-serif text-2xl tracking-tight">Patch &amp; Pot</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-ink">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={`nav-${n.key}`}
              className={({ isActive }) =>
                `text-sm tracking-wide transition-colors ${
                  isActive ? "text-forest font-medium" : "text-ink/75 hover:text-forest"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector compact />
          <button
            type="button"
            data-testid="region-picker-trigger"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 text-sm text-forest border border-forest/30 px-3 py-2 hover:bg-forest/5 transition-colors"
          >
            <MapPin strokeWidth={1.5} className="w-4 h-4" />
            <span className="hidden sm:inline">{region ? region.name : t("region.set")}</span>
            <span className="sm:hidden">{t("region.region")}</span>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden border-t border-border overflow-x-auto">
        <div className="flex gap-5 px-6 py-3 text-sm whitespace-nowrap">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={`nav-mobile-${n.key}`}
              className={({ isActive }) =>
                isActive ? "text-forest font-medium" : "text-ink/70"
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </header>
  );
}
