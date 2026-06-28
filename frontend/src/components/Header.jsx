import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Sprout, Menu } from "lucide-react";
import PatchSwitcher from "@/components/PatchSwitcher";
import LanguageSelector from "@/components/LanguageSelector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useI18n } from "@/i18n";

export default function Header() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

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
      <div className="container-narrow flex items-center justify-between py-5 gap-4">
        <Link to="/" data-testid="logo-link" className="flex items-center gap-2 text-forest">
          <Sprout strokeWidth={1.5} className="w-6 h-6" />
          <span className="font-serif text-2xl tracking-tight">Patch &amp; Pot</span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSelector compact />
          <PatchSwitcher />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                data-testid="nav-menu-trigger"
                className="inline-flex items-center justify-center w-10 h-10 rounded border border-border text-forest hover:bg-surface transition-colors"
              >
                <Menu className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-sand" data-testid="nav-menu-panel">
              <SheetHeader>
                <SheetTitle className="font-serif text-2xl text-forest text-left">
                  Patch &amp; Pot
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" data-testid="nav-menu-list">
                {NAV.map((n) => (
                  <SheetClose asChild key={n.to}>
                    <NavLink
                      to={n.to}
                      end={n.to === "/"}
                      data-testid={`nav-${n.key}`}
                      className={({ isActive }) =>
                        `px-3 py-3 rounded text-base tracking-wide transition-colors ${
                          isActive
                            ? "bg-surface text-forest font-medium"
                            : "text-ink/80 hover:bg-surface hover:text-forest"
                        }`
                      }
                    >
                      {n.label}
                    </NavLink>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
