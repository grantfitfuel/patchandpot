import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check, Loader2 } from "lucide-react";
import { submitFeedback } from "@/lib/api";
import { useI18n } from "@/i18n";

/**
 * Lightweight rate-and-comment widget for AI-generated content.
 * Stores feedback server-side (no auth). Persists "done" state in localStorage
 * so users don't see the prompt again for the same target.
 */
export default function FeedbackWidget({ targetType, targetId, label }) {
  const { t } = useI18n();
  const storageKey = `patchpot.feedback.v1.${targetType}.${targetId}`;
  const initial = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
  const [phase, setPhase] = useState(initial ? "thanks" : "ask"); // ask | comment | sending | thanks
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState("");

  const send = async (finalComment) => {
    setPhase("sending");
    try {
      await submitFeedback({ target_type: targetType, target_id: targetId, rating, comment: finalComment });
    } catch (e) {
      // Swallow — feedback is best-effort. Still thank the user.
      console.warn("feedback failed", e);
    }
    try { localStorage.setItem(storageKey, JSON.stringify({ rating, at: Date.now() })); } catch (e) { /* ignore */ }
    setPhase("thanks");
  };

  const pickThumb = (r) => {
    setRating(r);
    if (r === "up") {
      // Up votes go straight through — no need to nag for a comment.
      send("");
    } else {
      setPhase("comment");
    }
  };

  if (phase === "thanks") {
    return (
      <div data-testid="feedback-thanks" className="inline-flex items-center gap-2 text-sm text-moss mt-4">
        <Check strokeWidth={1.5} className="w-4 h-4 text-forest" />
        {t("feedback.thanks")}
      </div>
    );
  }

  if (phase === "comment") {
    return (
      <div className="mt-4 card-flat p-4 max-w-md" data-testid="feedback-comment">
        <p className="text-sm text-moss mb-2">{t("feedback.comment_prompt")}</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          data-testid="feedback-comment-input"
          className="w-full text-sm p-2 bg-sand border border-border outline-none focus:border-forest"
          placeholder={t("feedback.comment_placeholder")}
        />
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => send(comment)}
            data-testid="feedback-send"
            className="btn-forest text-sm inline-flex items-center gap-2">
            {t("feedback.send")}
          </button>
          <button type="button" onClick={() => send("")} className="btn-ghost text-sm">{t("feedback.skip")}</button>
        </div>
      </div>
    );
  }

  if (phase === "sending") {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-moss mt-4">
        <Loader2 strokeWidth={1.4} className="w-4 h-4 animate-spin" /> {t("feedback.sending")}
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-3" data-testid="feedback-ask">
      <span className="text-sm text-moss">{label || t("feedback.ask_default")}</span>
      <button type="button" onClick={() => pickThumb("up")}
        data-testid="feedback-up"
        aria-label={t("feedback.up_aria")}
        className="p-2 text-moss hover:text-forest border border-border hover:border-forest/40 transition-colors">
        <ThumbsUp strokeWidth={1.5} className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => pickThumb("down")}
        data-testid="feedback-down"
        aria-label={t("feedback.down_aria")}
        className="p-2 text-moss hover:text-terracotta border border-border hover:border-terracotta/40 transition-colors">
        <ThumbsDown strokeWidth={1.5} className="w-4 h-4" />
      </button>
    </div>
  );
}
