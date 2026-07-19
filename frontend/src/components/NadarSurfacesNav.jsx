/**
 * Small horizontal chip nav that ties together the four Nàdar surfaces —
 * Ask (member chat), Common questions (public FAQ), Topics (curated
 * clusters), Journal (member history). Rendered at the top of each
 * page in the set. `active` prop dims the current one so users always
 * see the rest of the set at a glance.
 */
import { Link } from "react-router-dom";
import { MessageCircle, HelpCircle, Layers, BookOpen } from "lucide-react";
import { useI18n } from "@/i18n";

const ITEMS = [
  { to: "/ask",          key: "ask",     labelKey: "nav.ask",     Icon: MessageCircle, testId: "nadar-nav-ask" },
  { to: "/ask/popular",  key: "popular", labelKey: "nav.popular", Icon: HelpCircle,    testId: "nadar-nav-popular" },
  { to: "/topics",       key: "topics",  labelKey: "nav.topics",  Icon: Layers,        testId: "nadar-nav-topics" },
  { to: "/journal",      key: "journal", labelKey: "nav.journal", Icon: BookOpen,      testId: "nadar-nav-journal" },
];

export default function NadarSurfacesNav({ active }) {
  const { t } = useI18n();
  return (
    <nav
      data-testid="nadar-surfaces-nav"
      className="flex flex-wrap gap-2 mb-6 text-xs"
    >
      {ITEMS.map(({ to, key, labelKey, Icon, testId }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            to={to}
            data-testid={testId}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full transition-colors ${
              isActive
                ? "border-forest/60 bg-forest/10 text-forest cursor-default"
                : "border-border/70 text-moss hover:border-forest/50 hover:text-forest bg-white"
            }`}
          >
            <Icon strokeWidth={1.6} className="w-3.5 h-3.5" />
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
