/**
 * Was-this-helpful feedback widget for public Ask-Nàdar Q&A pages.
 *
 * Anonymous thumbs up / thumbs down. LocalStorage guards against a
 * single browser voting more than once on the same slug. Backend
 * auto-flag threshold on down-votes (see routers/ask.py::vote_popular)
 * means quality curates itself over time.
 */
import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import axios from "axios";
import { API } from "@/lib/api";
import { useI18n } from "@/i18n";

const LS_KEY = "askpop_votes_v1";
function readVotes() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function recordVote(slug, vote) {
  const map = readVotes();
  map[slug] = vote;
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch (_e) { /* ignore */ }
}

export default function AskFeedbackWidget({ slug }) {
  const { t } = useI18n();
  const [voted, setVoted] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const map = readVotes();
    if (map[slug]) setVoted(map[slug]);
  }, [slug]);

  const vote = async (choice) => {
    if (voted || busy) return;
    setBusy(true);
    try {
      await axios.post(`${API}/ask/popular/${slug}/vote`, { vote: choice });
      setVoted(choice);
      recordVote(slug, choice);
    } catch (_e) {
      // silent
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-border" data-testid={`feedback-${slug}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-moss/80">
          {voted ? t("feedback.thanks") : t("feedback.prompt")}
        </span>
        {!voted && (
          <>
            <button
              type="button"
              onClick={() => vote("up")}
              disabled={busy}
              data-testid={`feedback-up-${slug}`}
              aria-label={t("feedback.yes")}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border/70 rounded-full hover:border-forest/50 hover:text-forest transition-colors"
            >
              <ThumbsUp className="w-3.5 h-3.5" strokeWidth={1.6} />
              {t("feedback.yes")}
            </button>
            <button
              type="button"
              onClick={() => vote("down")}
              disabled={busy}
              data-testid={`feedback-down-${slug}`}
              aria-label={t("feedback.no")}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border/70 rounded-full hover:border-terracotta/50 hover:text-terracotta transition-colors"
            >
              <ThumbsDown className="w-3.5 h-3.5" strokeWidth={1.6} />
              {t("feedback.no")}
            </button>
          </>
        )}
        {voted && (
          <span className="inline-flex items-center gap-1.5 text-xs text-forest">
            <Check className="w-3.5 h-3.5" strokeWidth={1.8} />
            {voted === "up" ? t("feedback.recorded_up") : t("feedback.recorded_down")}
          </span>
        )}
      </div>
    </div>
  );
}
