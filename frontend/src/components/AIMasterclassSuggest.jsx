import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Loader2, BookOpen, ArrowRight } from "lucide-react";
import {
  generateMasterclass, pollMasterclassJob, fetchPopularMasterclasses, fetchMyMasterclassLibrary,
} from "@/lib/api";
import { getStoredAccessToken } from "@/hooks/usePaywall";
import { useI18n } from "@/i18n";
import PaywallModal from "@/components/PaywallModal";
import { FEATURED_DEEP_DIVE_SLUGS } from "@/components/DeepDiveSection";

const FEATURED_SET = new Set(FEATURED_DEEP_DIVE_SLUGS);
const POLL_MS = 4000;
const POLL_MAX = 45;  // ~3 minutes hard ceiling

/**
 * Suggest-a-topic input + popular/library list, embedded above the
 * hand-authored "Foundations" section on the Masterclasses index.
 */
export default function AIMasterclassSuggest() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [popular, setPopular] = useState([]);
  const [mine, setMine] = useState([]);
  const fetchedOnce = useRef(false);

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    fetchPopularMasterclasses(20).then((d) =>
      setPopular((d.items || []).filter((m) => !FEATURED_SET.has(m.slug)).slice(0, 12))
    ).catch(() => {});
    const tok = getStoredAccessToken();
    if (tok) {
      fetchMyMasterclassLibrary(tok, lang).then((d) =>
        setMine((d.items || []).filter((m) => !FEATURED_SET.has(m.slug)))
      ).catch(() => {});
    }
  }, [lang]);

  async function pollUntilDone(jobId, slug) {
    for (let i = 0; i < POLL_MAX; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let status;
      try {
        const j = await pollMasterclassJob(jobId);
        status = j.status;
        if (j.error) throw new Error(j.error);
      } catch (err) {
        throw err;
      }
      if (status === "done") return slug;
      if (status === "error") throw new Error("Generation failed.");
      setPhase(`Authoring lessons${".".repeat((i % 4) + 1)}`);
    }
    throw new Error("Generation took longer than expected — try again or look in your library shortly.");
  }

  async function generate() {
    const cleaned = topic.trim();
    if (cleaned.length < 3) {
      setError("Please describe the topic in at least 3 characters.");
      return;
    }
    const tok = getStoredAccessToken();
    if (!tok) {
      setPaywallOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    setPhase("Reaching the editor…");
    try {
      const res = await generateMasterclass(cleaned, lang, tok);
      if (res.status === "done" && res.slug) {
        navigate(`/masterclasses/custom/${res.slug}`);
        return;
      }
      if (res.status === "pending" && res.job_id) {
        setPhase("Researching cultivars…");
        const slug = await pollUntilDone(res.job_id, res.slug);
        navigate(`/masterclasses/custom/${slug}`);
        return;
      }
      throw new Error("Unexpected response from server.");
    } catch (e) {
      console.error("masterclass generation failed", e);
      setError(
        e?.response?.status === 402
          ? "Pay £5 once to unlock AI masterclass generation."
          : (e?.message || "Generation failed — please try again.")
      );
    } finally {
      setBusy(false);
      setPhase("");
    }
  }

  return (
    <section className="mt-12" data-testid="ai-masterclass-suggest">
      <div className="border-2 border-dashed border-terracotta/40 bg-sand/30 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
          <span className="overline">AI masterclass on demand</span>
        </div>
        <h2 className="font-serif text-2xl md:text-3xl text-forest mt-1">
          Suggest any topic — get a full masterclass in 90 seconds
        </h2>
        <p className="text-ink/75 mt-2 max-w-2xl">
          Type any gardening topic — &ldquo;heritage tomatoes&rdquo;, &ldquo;balcony herbs in
          deep shade&rdquo;, &ldquo;preserving the autumn harvest&rdquo; — and we&rsquo;ll author a
          5–6 lesson course at the same depth as our staff-written ones.
        </p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) generate(); }}
            placeholder="e.g. Heirloom tomatoes & San Marzano paste varieties"
            data-testid="ai-mc-topic-input"
            disabled={busy}
            maxLength={120}
            className="flex-1 px-4 py-3 bg-sand border border-forest/30 text-forest placeholder-moss/60 focus:outline-none focus:border-terracotta disabled:opacity-60"
          />
          <button
            type="button"
            data-testid="ai-mc-generate-btn"
            onClick={generate}
            disabled={busy}
            className="btn-terracotta px-5 py-3 inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" /> : <Sparkles strokeWidth={1.5} className="w-4 h-4" />}
            {busy ? (phase || "Authoring…") : "Generate masterclass"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-terracotta" data-testid="ai-mc-error">{error}</p>
        )}
        {!error && (
          <p className="mt-3 text-xs text-moss">
            ~ 60–120 seconds per topic. Cached forever — anyone searching the same topic later sees it instantly.
          </p>
        )}
      </div>

      {mine.length > 0 && (
        <div className="mt-10" data-testid="ai-mc-my-library">
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <h3 className="font-serif text-2xl text-forest inline-flex items-center gap-2">
              <BookOpen strokeWidth={1.4} className="w-5 h-5 text-terracotta" /> Your library
            </h3>
            <p className="text-xs text-moss">{mine.length} {mine.length === 1 ? "topic" : "topics"}</p>
          </div>
          <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mine.map((m) => (
              <li key={m.slug}>
                <Link
                  to={`/masterclasses/custom/${m.slug}`}
                  data-testid={`ai-mc-library-${m.slug}`}
                  className="block p-4 bg-sand border border-border hover:border-terracotta group transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-serif text-forest text-lg leading-tight group-hover:text-terracotta transition-colors">{m.title || m.topic}</p>
                    <ArrowRight strokeWidth={1.5} className="w-4 h-4 text-forest/60 group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-1" />
                  </div>
                  {m.tagline && <p className="text-xs text-ink/70 mt-1.5 line-clamp-2">{m.tagline}</p>}
                  {m.mine && <span className="inline-block text-[10px] uppercase tracking-wider text-terracotta mt-2">yours</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {popular.length > 0 && (
        <div className="mt-10" data-testid="ai-mc-popular">
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <h3 className="font-serif text-2xl text-forest">Popular community topics</h3>
            <p className="text-xs text-moss">{popular.length} recent</p>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {popular.map((m) => (
              <li key={m.slug}>
                <Link
                  to={`/masterclasses/custom/${m.slug}`}
                  data-testid={`ai-mc-popular-${m.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sand border border-forest/30 text-sm text-forest hover:bg-forest hover:text-sand transition-colors"
                >
                  {m.title || m.topic}
                  <span className="text-[10px] opacity-60">· {m.views}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {paywallOpen && (
        <PaywallModal
          onClose={() => setPaywallOpen(false)}
          onUnlocked={() => { setPaywallOpen(false); generate(); }}
        />
      )}
    </section>
  );
}
