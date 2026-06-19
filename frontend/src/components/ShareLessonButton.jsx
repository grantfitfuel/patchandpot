import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useI18n } from "@/i18n";

/**
 * "Share this masterclass" link button. Resolves to the public,
 * OG-rich /learn/:topic landing page so the recipient gets a rich link
 * preview on Twitter/LinkedIn/Slack/Discord and lands on a page that
 * shows the free intro lesson before the paywall — turning every share
 * into an evergreen acquisition channel.
 *
 * Uses the Web Share API on mobile and falls back to clipboard on desktop.
 */
export default function ShareLessonButton({ topicSlug, title, tagline }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function onClick() {
    if (!topicSlug || typeof window === "undefined") return;
    const url = `${window.location.origin}/learn/${topicSlug}`;
    const shareData = {
      title: title || "Patch & Pot",
      text: tagline || "Read the free intro lesson on Patch & Pot",
      url,
    };

    // Mobile + supporting browsers: native share sheet
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        // user dismissed — fall through to clipboard copy
        if (e?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Last resort — show the URL in a prompt so the user can copy manually
      window.prompt(t("share.copy_prompt"), url);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="share-lesson-btn"
      className="btn-ghost inline-flex items-center gap-2"
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check strokeWidth={1.6} className="w-4 h-4 text-forest" />
          <span data-testid="share-lesson-copied">
            {t("share.link_copied")}
          </span>
        </>
      ) : (
        <>
          <Share2 strokeWidth={1.5} className="w-4 h-4" />
          <span>{t("share.share_masterclass")}</span>
        </>
      )}
    </button>
  );
}
