import { Link, NavLink } from "react-router-dom";
import { Sprout } from "lucide-react";
import PatchSwitcher from "@/components/PatchSwitcher";
import LanguageSelector from "@/components/LanguageSelector";
import { useI18n } from "@/i18n";

export default function Header() {
  const { t } = useI18n();

  const NAV = [
    { to: "/", label: t("nav.home"), key: "home" },
    { to: "/calendar", label: t("nav.calendar"), key: "calendar" },
    { to: "/plants", label: t("nav.plants"), key: "plants" },
    { to: "/masterclasses", label: t("nav.masterclasses"), key: "masterclasses" },
    { to: "/garden", label: t("nav.garden"), key: "garden" },
    { to: "/ask", label: t("nav.ask"), key: "ask" },
    { to: "/wellbeing", label: t("nav.wellbeing"), key: "wellbeing" },
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
          <PatchSwitcher />
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
    </header>
  );
}
