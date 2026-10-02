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
import { Download, Lock, Sparkles, Wind, PlayCircle, Mic2, Play, Square } from "lucide-react";
import { API } from "@/lib/api";
import { useRegion } from "@/hooks/useRegion";
import { usePaywall, getStoredAccessToken } from "@/hooks/usePaywall";
import { useCalmPill } from "@/hooks/useCalmPill";
import PageHero from "@/components/PageHero";
import { SunriseMotif } from "@/components/illustrations/VibrantMotifs";

const VOICE_PREF_KEY = "patchpot.calm.voice.v1";

function readVoicePref() {
  try {
    return window.localStorage.getItem(VOICE_PREF_KEY) || "lily";
  } catch { return "lily"; }
}
function writeVoicePref(v) {
  try { window.localStorage.setItem(VOICE_PREF_KEY, v); } catch { /* private mode */ }
}

export default function CalmPage() {
  const { region } = useRegion();
  const hemisphere = region?.hemisphere === "southern" ? "sh" : "nh";
  const { paid } = usePaywall();
  const { markPlayed } = useCalmPill();

  const [current, setCurrent] = useState(null);
  const [list, setList] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [loading, setLoading] = useState(true);
  // Voice options + user's persisted pick.
  const [voiceOptions, setVoiceOptions] = useState([]); // [{key,label,slugs_ready:[]}]
  const [voicePref, setVoicePref] = useState(readVoicePref);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/calm/voices`);
        setVoiceOptions(r.data?.voices || []);
      } catch { /* fail silent — picker just hides */ }
    })();
  }, []);

  const changeVoice = (v) => {
    setVoicePref(v);
    writeVoicePref(v);
  };

  // Voice-sample preview. One Audio element, shared across the picker,
  // so tapping preview on one voice stops the other. Auto-clears
  // `playingSample` when the sample finishes or errors.
  const [playingSample, setPlayingSample] = useState(null);
  const sampleAudioRef = useRef(null);
  useEffect(() => () => {
    // Cleanup on unmount so a sample doesn't keep playing after
    // navigating away from /calm.
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
    }
  }, []);
  const toggleSample = (voiceKey) => {
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
    }
    if (playingSample === voiceKey) {
      setPlayingSample(null);
      return;
    }
    const a = new Audio(`${API}/calm/voices/${voiceKey}/sample.mp3`);
    a.onended = () => setPlayingSample(null);
    a.onerror = () => setPlayingSample(null);
    sampleAudioRef.current = a;
    setPlayingSample(voiceKey);
    a.play().catch(() => setPlayingSample(null));
  };

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
          axios.get(`${API}/calm/current`, { params: { hemisphere} }),
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

  // Group the flat list into 12 monthly buckets each holding up to 4 weekly variants.
  const monthGroups = useMemo(() => {
    const byMonth = new Map();
    for (const v of list) {
      const arr = byMonth.get(v.month) || [];
      arr.push(v);
      byMonth.set(v.month, arr);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a - b)
      .map(([month, weeks]) => ({
        month,
        weeks: weeks.sort((a, b) => (a.week ?? 1) - (b.week ?? 1)),
      }));
  }, [list]);

  const selectSlug = async (slug) => {
    if (slug === activeSlug) return;
    setUserPicked(true);
    setActiveSlug(slug);
    setCurrent(null);
    try {
      const t = getStoredAccessToken() || "";
      const r = await axios.get(`${API}/calm/${slug}`);
      setCurrent(r.data);
    } catch (e) {
      console.warn("calm variant load failed", e);
    }
  };

  const locked = !!active?.locked;
  // Fall back to Lily if the picked voice isn't rendered for this slug.
  const voiceReady = useMemo(() => {
    const opt = voiceOptions.find((v) => v.key === voicePref);
    return opt ? opt.slugs_ready.includes(active?.slug) : false;
  }, [voiceOptions, voicePref, active?.slug]);
  const effectiveVoice = voiceReady ? voicePref : "lily";
  const audioUrl = active && active.audio_generated
    ? (() => {
        const params = new URLSearchParams();
        params.set("voice", effectiveVoice);
        if (paid && getStoredAccessToken()) params.set("access_token", getStoredAccessToken());
        const qs = params.toString();
        return `${API}/calm/${active.slug}/audio.mp3?${qs}`;
      })()
    : null;

  return (
    <div className="animate-fade-up" data-testid="calm-page">
      <Helmet>
        <title>2-Minute Calm · Patch & Pot</title>
        <meta name="description" content="A gentle, seasonal mindful pause. Two minutes to breathe, notice and grow alongside your patch." />
      </Helmet>

      <PageHero
        variant="moss"
        eyebrow="Wellbeing · Weekly"
        title="2-Minute Calm"
        blurb="A gentle, seasonal mindful pause. Two minutes to breathe, notice and grow alongside your patch — a new track each month, tuned to what's happening outside your door right now."
        Motif={SunriseMotif}
      />

      <div className="container-narrow py-10 md:py-14 max-w-3xl">

      {/* Active variant */}
      {loading && <div className="text-sm text-moss" data-testid="calm-loading">Loading…</div>}

      {!loading && active && (
        <section className="mb-14" data-testid={`calm-active-${active.slug}`}>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-[0.65rem] uppercase tracking-widest text-moss">
              {active.season_label}
              {active.week && <> · Week {active.week}</>}
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
              {voiceOptions.length > 1 && (
                <div className="mb-4 pb-4 border-b border-border/60" data-testid="calm-voice-picker">
                  <p className="text-[0.6rem] uppercase tracking-widest text-moss mb-3 flex items-center gap-1.5">
                    <Mic2 strokeWidth={1.6} className="w-3 h-3" />
                    Narrated by
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {voiceOptions.map((v) => {
                      const isReady = v.slugs_ready.includes(active.slug);
                      const isActive = v.key === voicePref;
                      const isPreviewing = playingSample === v.key;
                      return (
                        <div
                          key={v.key}
                          data-testid={`calm-voice-row-${v.key}`}
                          className={`flex items-start gap-2 border px-3 py-2.5 transition-colors ${
                            isActive && isReady
                              ? "border-forest bg-forest/10"
                              : isReady
                                ? "border-border/70 hover:border-forest/40"
                                : "border-border/40 opacity-70"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => changeVoice(v.key)}
                            disabled={!isReady}
                            data-testid={`calm-voice-${v.key}`}
                            aria-pressed={isActive}
                            className={`flex-1 text-left ${
                              isReady ? "cursor-pointer" : "cursor-not-allowed"
                            }`}
                          >
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span
                                className={`text-sm font-medium ${
                                  isActive && isReady
                                    ? "text-forest"
                                    : isReady
                                      ? "text-moss"
                                      : "text-moss/40"
                                }`}
                              >
                                {v.label}
                              </span>
                              {v.accent && (
                                <span
                                  className={`text-[0.55rem] uppercase tracking-widest ${
                                    isReady ? "text-moss/70" : "text-moss/40"
                                  }`}
                                >
                                  {v.accent}
                                </span>
                              )}
                              {!isReady && (
                                <span className="text-[0.55rem] uppercase tracking-widest text-moss/50">
                                  soon
                                </span>
                              )}
                            </div>
                            {v.tagline && (
                              <p
                                className={`mt-0.5 text-[0.7rem] leading-snug ${
                                  isReady ? "text-moss/80" : "text-moss/40"
                                }`}
                              >
                                {v.tagline}
                              </p>
                            )}
                          </button>
                          {v.sample_ready && (
                            <button
                              type="button"
                              onClick={() => toggleSample(v.key)}
                              data-testid={`calm-voice-sample-${v.key}`}
                              aria-label={isPreviewing ? `Stop ${v.label} sample` : `Play ${v.label} sample`}
                              className={`shrink-0 w-8 h-8 flex items-center justify-center border transition-colors ${
                                isPreviewing
                                  ? "border-terracotta bg-terracotta/10 text-terracotta"
                                  : "border-border/50 text-moss hover:text-terracotta hover:border-terracotta/50"
                              }`}
                            >
                              {isPreviewing ? (
                                <Square strokeWidth={1.6} className="w-3 h-3" fill="currentColor" />
                              ) : (
                                <Play strokeWidth={1.6} className="w-3 h-3" fill="currentColor" />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {!voiceReady && voicePref !== "lily" && (
                    <p className="mt-2 text-[0.65rem] text-moss/70" data-testid="calm-voice-fallback-notice">
                      This month is only available in Lily for now — playing Lily instead.
                    </p>
                  )}
                </div>
              )}
              <audio
                controls
                preload="metadata"
                src={audioUrl}
                data-testid="calm-audio-player"
                onPlay={() => markPlayed(active.slug)}
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
            {monthGroups.map(({ month, weeks }) => {
              const anyWeek = weeks[0]; // for the poster fields (season_label)
              const readyWeeks = weeks.filter((w) => w.audio_generated);
              const groupActive = weeks.some((w) => w.slug === activeSlug);
              const anyReady = readyWeeks.length > 0;
              // Pick the "poster" week — the one currently active in this
              // month (if any), else the current calendar week if that
              // month is the current month, else week 1.
              const posterWeek =
                weeks.find((w) => w.slug === activeSlug) || readyWeeks[0] || anyWeek;
              return (
                <div
                  key={month}
                  data-testid={`calm-month-group-${monthName(month)}`}
                  className={`border transition-colors ${
                    groupActive ? "border-forest bg-forest/5" : "border-border/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => posterWeek && selectSlug(posterWeek.slug)}
                    disabled={!anyReady}
                    data-testid={`calm-month-${monthName(month)}`}
                    className={`text-left w-full p-3 ${!anyReady ? "opacity-50 cursor-not-allowed" : "hover:bg-forest/[0.03]"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[0.6rem] uppercase tracking-widest text-moss">
                      {posterWeek.is_free_preview && <span className="text-terracotta">Free</span>}
                      {!posterWeek.is_free_preview && !paid && <Lock strokeWidth={1.6} className="w-3 h-3" />}
                      {anyReady && <PlayCircle strokeWidth={1.6} className="w-3 h-3 text-forest ml-auto" />}
                    </div>
                    <p className="font-serif text-lg text-forest leading-tight">{posterWeek.title || monthName(month)}</p>
                    <p className="text-[0.65rem] uppercase tracking-widest text-moss/80 mt-1">
                      {anyWeek.season_label}
                    </p>
                  </button>
                  {groupActive && weeks.length > 1 && (
                    <div
                      className="flex border-t border-border/50 divide-x divide-border/50"
                      data-testid={`calm-week-picker-${monthName(month)}`}
                    >
                      {weeks.map((w) => {
                        const wActive = w.slug === activeSlug;
                        const wReady = w.audio_generated;
                        return (
                          <button
                            key={w.slug}
                            type="button"
                            onClick={() => selectSlug(w.slug)}
                            disabled={!wReady}
                            data-testid={`calm-week-${w.slug}`}
                            className={`flex-1 text-[0.6rem] uppercase tracking-widest py-1.5 transition-colors ${
                              wActive
                                ? "text-forest font-medium bg-forest/10"
                                : wReady
                                  ? "text-moss hover:text-forest hover:bg-forest/5"
                                  : "text-moss/40 cursor-not-allowed"
                            }`}
                          >
                            W{w.week}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
function monthName(m) { return MONTH_NAMES[m - 1] || ""; }
