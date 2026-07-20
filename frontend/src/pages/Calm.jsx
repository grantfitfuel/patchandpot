/**
 * /calm — 2-Minute Calm: weekly-rotating, seasonally-scripted mindful
 * breathing audio for gardeners.
 *
 * The default surface auto-picks the current month + hemisphere via
 * /api/calm/current. Members hear the whole thing; free visitors get
 * the March "First Green Light" preview and a locked-state prompt for
 * every other month.
 *
 * Layout: hero + native <audio> player + transcript (always shown for
 * accessibility/SEO) + a grid of all 12 monthly variants to jump to.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import axios from "axios";
import { Download, Lock, Sparkles, Wind, PlayCircle } from "lucide-react";
import { API } from "@/lib/api";
import { useRegion } from "@/hooks/useRegion";
import { usePaywall, getStoredAccessToken } from "@/hooks/usePaywall";

export default function CalmPage() {
  const { region } = useRegion();
  const hemisphere = region?.hemisphere === "southern" ? "sh" : "nh";
  const { paid } = usePaywall();

  const [current, setCurrent] = useState(null);
  const [list, setList] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [loading, setLoading] = useState(true);

  const [userPicked, setUserPicked] = useState(false);
  // Ref mirror so the async fetch closure below always reads the latest
  // value, not the stale one from when the effect was scheduled.
  const userPickedRef = useRef(false);
  useEffect(() => { userPickedRef.current = userPicked; }, [userPicked]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const t = getStoredAccessToken() || "";
        const [curr, all] = await Promise.all([
          axios.get(`${API}/calm/current`, { params: { hemisphere, access_token: t } }),
          axios.get(`${API}/calm/list`, { params: { hemisphere } }),
        ]);
        if (!alive) return;
        setList(all.data?.items || []);
        if (!userPickedRef.current) {
          setCurrent(curr.data);
          setActiveSlug(curr.data?.slug || null);
        }
      } catch (e) {
        console.warn("calm load failed", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [hemisphere]);

  const active = useMemo(() => {
    if (!activeSlug) return null;
    if (current && current.slug === activeSlug) return current;
    return null;
  }, [activeSlug, current]);

  const selectSlug = async (slug) => {
    if (slug === activeSlug) return;
    setUserPicked(true);
    setActiveSlug(slug);
    setCurrent(null);
    try {
      const t = getStoredAccessToken() || "";
      const r = await axios.get(`${API}/calm/${slug}`, { params: { access_token: t } });
      setCurrent(r.data);
    } catch (e) {
      console.warn("calm variant load failed", e);
    }
  };

  const locked = !!active?.locked;
  const audioUrl = active && active.audio_generated
    ? `${API}/calm/${active.slug}/audio.mp3${paid && getStoredAccessToken() ? `?access_token=${encodeURIComponent(getStoredAccessToken())}` : ""}`
    : null;

  return (
    <div className="container-narrow py-12 md:py-16 max-w-3xl animate-fade-up" data-testid="calm-page">
      <Helmet>
        <title>2-Minute Calm · Patch & Pot</title>
        <meta name="description" content="A gentle, seasonal mindful pause. Two minutes to breathe, notice and grow alongside your patch." />
      </Helmet>

      {/* Hero */}
      <header className="mb-10">
        <p className="overline inline-flex items-center gap-1.5">
          <Wind strokeWidth={1.5} className="w-3.5 h-3.5 text-terracotta" />
          Wellbeing · Weekly
        </p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
          2-Minute Calm
        </h1>
        <p className="mt-4 text-ink/75 leading-relaxed max-w-2xl">
          A gentle, seasonal mindful pause. Two minutes to breathe, notice
          and grow alongside your patch — a new track each month, tuned
          to what&apos;s happening outside your door right now.
        </p>
      </header>

      {/* Active variant */}
      {loading && <div className="text-sm text-moss" data-testid="calm-loading">Loading…</div>}

      {!loading && active && (
        <section className="mb-14" data-testid={`calm-active-${active.slug}`}>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-[0.65rem] uppercase tracking-widest text-moss">
              {active.season_label}
            </span>
            {active.is_free_preview && (
              <span
                className="text-[0.65rem] uppercase tracking-widest text-terracotta bg-terracotta/10 px-1.5 py-0.5"
                data-testid="calm-free-badge"
              >
                Free preview
              </span>
            )}
          </div>
          <h2 className="font-serif text-3xl md:text-4xl text-forest tracking-tight mb-6">
            {active.title}
          </h2>

          {locked ? (
            <LockedBlock />
          ) : audioUrl ? (
            <div className="card-flat p-5 mb-8">
              <audio
                controls
                preload="metadata"
                src={audioUrl}
                data-testid="calm-audio-player"
                className="w-full"
              >
                Your browser doesn&apos;t support HTML5 audio.
              </audio>
              <div className="mt-3 flex justify-between items-center text-[0.65rem] uppercase tracking-widest text-moss">
                <span>{formatDuration(active.duration_s)}</span>
                <a
                  href={audioUrl}
                  download={`patch-and-pot-calm-${active.slug}.mp3`}
                  data-testid="calm-download-mp3"
                  className="inline-flex items-center gap-1 hover:text-terracotta"
                >
                  <Download strokeWidth={1.6} className="w-3 h-3" />
                  Download MP3
                </a>
              </div>
            </div>
          ) : (
            <div className="card-flat p-5 mb-8 text-sm text-moss" data-testid="calm-not-rendered">
              This week&apos;s audio is still being prepared — check back shortly.
            </div>
          )}

          {/* Transcript */}
          {active.transcript_display && !locked && (
            <details className="border border-border/60 p-4" data-testid="calm-transcript">
              <summary className="cursor-pointer text-sm text-forest hover:text-terracotta">
                Show transcript
              </summary>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-ink/80 leading-relaxed">
                {active.transcript_display}
              </pre>
            </details>
          )}
        </section>
      )}

      {/* Monthly grid */}
      {list.length > 0 && (
        <section className="border-t border-border pt-10">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-serif text-2xl text-forest">All seasons</h3>
            <p className="text-[0.65rem] uppercase tracking-widest text-moss">
              {hemisphere === "sh" ? "Southern hemisphere" : "Northern hemisphere"} rotation
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="calm-month-grid">
            {list.map((v) => {
              const isActive = v.slug === activeSlug;
              const isFree = v.is_free_preview;
              const isReady = v.audio_generated;
              return (
                <button
                  key={v.slug}
                  type="button"
                  onClick={() => selectSlug(v.slug)}
                  data-testid={`calm-month-${v.slug}`}
                  disabled={!isReady}
                  className={`text-left p-3 border transition-colors ${
                    isActive
                      ? "border-forest bg-forest/5"
                      : "border-border/70 hover:border-forest/40"
                  } ${!isReady ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[0.6rem] uppercase tracking-widest text-moss">
                    {isFree && <span className="text-terracotta">Free</span>}
                    {!isFree && !paid && <Lock strokeWidth={1.6} className="w-3 h-3" />}
                    {isReady && <PlayCircle strokeWidth={1.6} className="w-3 h-3 text-forest ml-auto" />}
                  </div>
                  <p className="font-serif text-lg text-forest leading-tight">{v.title}</p>
                  <p className="text-[0.65rem] uppercase tracking-widest text-moss/80 mt-1">
                    {v.season_label}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Bottom CTA — cross-link to Wellbeing Journal */}
      <section className="mt-14 pt-8 border-t border-border">
        <div className="flex items-start gap-3">
          <Sparkles strokeWidth={1.4} className="w-6 h-6 text-terracotta flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-serif text-xl text-forest tracking-tight">
              Pair with your Wellbeing Journal
            </h4>
            <p className="text-sm text-moss leading-relaxed mt-1 mb-3">
              Try a two-minute pause before or after logging how the garden
              made you feel today.
            </p>
            <Link
              to="/wellbeing"
              data-testid="calm-wellbeing-link"
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              Open Wellbeing Journal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function LockedBlock() {
  return (
    <div className="card-flat p-6 mb-6" data-testid="calm-locked-block">
      <div className="flex items-start gap-3">
        <Lock strokeWidth={1.4} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-serif text-xl text-forest leading-snug mb-1">
            This one is for members.
          </p>
          <p className="text-sm text-moss leading-relaxed mb-4">
            The full 2-minute audio and transcript unlock with a Patch & Pot
            membership. You can preview the free Early Spring track any time.
          </p>
          <div className="flex gap-3 flex-wrap">
            <a href="/#pricing" className="btn-primary text-sm" data-testid="calm-paywall-cta">
              Become a member
            </a>
            <Link
              to="/calm?preview=1"
              onClick={() => { /* handled at grid level */ }}
              className="text-sm text-forest underline underline-offset-2 hover:text-terracotta self-center"
              data-testid="calm-try-free"
            >
              Or hear the free preview →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}
