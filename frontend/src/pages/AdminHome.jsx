/**
 * /admin — Central admin hub. Lists every internal dashboard behind one
 * gated entry point so the operator can jump anywhere without remembering
 * separate URLs. Uses the same token gate as the individual pages, so if
 * you've already signed in here you're signed in everywhere.
 */
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Globe2, BarChart3, Sparkles, GitBranch, DollarSign, LogOut, ExternalLink, ShieldCheck, LineChart, Instagram,
} from "lucide-react";
import AdminTokenGate, { useAdminToken } from "@/components/AdminTokenGate";

const CARDS = [
  { to: "/admin/analytics",   icon: LineChart,  title: "Analytics & CTR",
    blurb: "Page views + CTA click-through rates by capability. First-party events, no third-party." },
  { to: "/admin/revenue",     icon: DollarSign, title: "Revenue & margin",
    blurb: "Stripe payouts, affiliate top-countries, gross vs. net profit." },
  { to: "/admin/ai-usage",    icon: BarChart3,  title: "AI usage & budget",
    blurb: "Sonnet / Haiku / Nano Banana spend, daily cap, budget guardrails." },
  { to: "/admin/geo",         icon: Globe2,     title: "Geographic breakdown",
    blurb: "First-party visitor map by country. No third-party analytics." },
  { to: "/admin/ai-searches", icon: Sparkles,   title: "Promote AI searches",
    blurb: "Turn popular AI-generated plant guides into permanent curated ones." },
  { to: "/admin/referrals",   icon: GitBranch,  title: "Referral attribution",
    blurb: "Which embeds, blogs and deep links actually convert to paid checkouts." },
  { to: "/admin/ask-review",  icon: ShieldCheck, title: "Ask Nàdar review queue",
    blurb: "Approve or permanent-hide answers flagged by refusal filters or down-votes." },
  { to: "/admin/calm",  icon: Sparkles, title: "2-Minute Calm content",
    blurb: "Author scripts (Claude) and render audio (ElevenLabs) for the 12 monthly variants." },
  { to: "/admin/instagram",  icon: Instagram, title: "Instagram publisher",
    blurb: "Automated 3x/week posts (Mon/Wed/Fri 09:00 UK). Connect, preview and publish." },
];

export default function AdminHomePage() {
  const { token, signIn, signOut } = useAdminToken();

  if (!token) {
    return (
      <AdminTokenGate
        title="Admin hub"
        blurb="Sign in once here and every admin dashboard unlocks in the same browser."
        onSubmit={signIn}
      />
    );
  }

  return (
    <div className="container-narrow py-12" data-testid="admin-home-page">
      <Helmet>
        <title>Admin hub · Patch & Pot</title>
      </Helmet>

      <div className="flex items-baseline justify-between mb-10">
        <div>
          <p className="overline">Admin · Internal</p>
          <h1 className="font-serif text-4xl md:text-5xl text-forest mt-2">Admin hub</h1>
          <p className="text-sm text-moss mt-2 max-w-2xl">
            Everything internal lives here. Click a card to open the dashboard.
          </p>
        </div>
        <button
          onClick={signOut}
          data-testid="admin-home-signout"
          className="text-xs uppercase tracking-wider text-moss hover:text-forest flex items-center gap-1"
        >
          <LogOut strokeWidth={1.5} className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              data-testid={`admin-card-${c.to.split("/").pop()}`}
              className="card-flat p-6 group hover:border-forest transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon strokeWidth={1.4} className="w-6 h-6 text-terracotta" />
                <h2 className="font-serif text-xl text-forest">{c.title}</h2>
              </div>
              <p className="text-sm text-ink/75 leading-relaxed">{c.blurb}</p>
              <p className="mt-4 text-[0.6rem] uppercase tracking-widest text-moss group-hover:text-forest flex items-center gap-1">
                Open
                <ExternalLink strokeWidth={1.5} className="w-3 h-3" />
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
