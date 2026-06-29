/**
 * ShareSocialGrid — one-tap share buttons for X, Facebook, WhatsApp,
 * Pinterest, Email, and (on mobile only) Stories/Reels.
 *
 * Extracted from SharePatchModal during the 2026-02 refactor. Each
 * branch ships a ready-to-post payload: caption + URL, with the
 * platform's own image scraper pulling the watercolour OG card. No
 * "download a ZIP" anywhere.
 */
import { useMemo, useState } from "react";
import { Facebook, Loader2, Mail, MessageCircle, Pin, Share, Twitter } from "lucide-react";
import { useI18n } from "@/i18n";

export default function ShareSocialGrid({ shareUrl, shareId, patchName }) {
  const { t } = useI18n();
  const [tweeting, setTweeting] = useState(false);
  const [sharingStory, setSharingStory] = useState(false);

  const backend = process.env.REACT_APP_BACKEND_URL || "";

  // Probe Web Share API Level 2 (file sharing) once at mount. On desktop
  // browsers and older mobiles canShare returns false → we hide the
  // Stories button entirely rather than silently fall back to a download.
  const canNativeShareFiles = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    if (typeof navigator.canShare !== "function") return false;
    try {
      const probe = new File([new Uint8Array([0])], "probe.png", { type: "image/png" });
      return navigator.canShare({ files: [probe] });
    } catch {
      return false;
    }
  }, []);

  // iOS Facebook + WhatsApp + Messenger only trigger their link-unfurl
  // scrape pipeline when the URL arrives INSIDE the text body. When the
  // URL is passed via the structured `url` field of the Web Share API,
  // those apps treat it as an attached link and post it bare with no
  // card preview. So we concat the URL into the `text` payload and omit
  // `url` — counter-intuitive but the only way to get FB iOS to render
  // the watercolour card in the posted status.
  const onSimpleShare = async (platform) => {
    if (!shareId || !shareUrl) return;
    const name = patchName || "my patch";
    const tagline = t("share_patch.platforms.default_text", { name });

    const isMobileHijackedPlatform = platform === "facebook" || platform === "whatsapp";
    if (isMobileHijackedPlatform && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: `${tagline}\n${shareUrl}`,
        });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
        // fall through to the URL intent if Web Share rejects
      }
    }

    let intent;
    switch (platform) {
      case "facebook":
        intent = "https://www.facebook.com/sharer/sharer.php"
          + `?u=${encodeURIComponent(shareUrl)}`
          + `&quote=${encodeURIComponent(tagline)}`;
        break;
      case "whatsapp":
        intent = "https://wa.me/"
          + `?text=${encodeURIComponent(`${tagline} ${shareUrl}`)}`;
        break;
      case "pinterest": {
        // Pinterest pins the image directly — `?v=wc2` cache-buster forces
        // Pinterest (and our edge CDN) to treat this as a brand-new image
        // URL so we don't accidentally pin the old letterpress card.
        const media = `${backend}/api/share/patch/${shareId}/og.png?v=wc2`;
        intent = "https://pinterest.com/pin/create/button/"
          + `?url=${encodeURIComponent(shareUrl)}`
          + `&media=${encodeURIComponent(media)}`
          + `&description=${encodeURIComponent(tagline)}`;
        break;
      }
      case "email":
        intent = "mailto:"
          + `?subject=${encodeURIComponent(t("share_patch.platforms.email_subject", { name }))}`
          + `&body=${encodeURIComponent(`${tagline}\n\n${shareUrl}`)}`;
        break;
      default:
        return;
    }
    if (platform === "email") {
      // mailto must use top-level navigation, not a popup.
      window.location.href = intent;
      return;
    }
    const win = window.open(intent, "_blank", "noopener,noreferrer,width=600,height=560");
    if (!win) window.location.href = intent;
  };

  // [Tweet this patch] — fetch the AI-written Twitter-tuned caption from
  // the same cache that powers the social-kit ZIP, then pop X's intent
  // pre-filled with caption text + patch URL. X auto-attaches the OG
  // card when it scrapes the URL.
  const onTweet = async () => {
    if (!shareId || tweeting) return;
    setTweeting(true);
    try {
      const r = await fetch(`${backend}/api/share/patch/${shareId}/captions.json`);
      const json = r.ok ? await r.json() : null;
      let twitterCaption = json?.captions?.youtube_twitter || "";
      // The AI caption sometimes embeds the patch URL inline. Twitter's
      // intent appends the URL via `url=` separately so leaving it inline
      // produces a duplicate. Strip any patchandpot.app links from the
      // caption text before handing off.
      twitterCaption = twitterCaption
        .replace(/https?:\/\/(?:www\.)?patchandpot\.[^\s]+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      const intent = new URL("https://x.com/intent/tweet");
      if (twitterCaption) intent.searchParams.set("text", twitterCaption);
      intent.searchParams.set("url", shareUrl);
      const win = window.open(intent.toString(), "_blank", "noopener,noreferrer,width=600,height=560");
      if (!win) window.location.href = intent.toString();
    } catch (e) {
      console.warn("Tweet intent failed", e);
    } finally {
      setTweeting(false);
    }
  };

  // [Share to Stories / Reels] — invokes the OS-native share sheet on
  // mobile so the user can post to Instagram Story / TikTok / WhatsApp
  // Status in one tap. Requires Web Share API Level 2 (file sharing).
  const onShareStory = async () => {
    if (!shareId || sharingStory) return;
    setSharingStory(true);
    try {
      // Fetch the 9:16 teaser image + captions in parallel — the captions
      // endpoint also warms the LLM cache for any later Tweet click.
      const [imgRes, capRes] = await Promise.all([
        fetch(`${backend}/api/share/patch/${shareId}/story.png`),
        fetch(`${backend}/api/share/patch/${shareId}/captions.json`),
      ]);
      if (!imgRes.ok) throw new Error("story image fetch failed");
      const blob = await imgRes.blob();
      const file = new File([blob], "patch-and-pot-story.png", { type: "image/png" });
      const cap = capRes.ok ? (await capRes.json())?.captions?.reels_story : "";
      await navigator.share({
        files: [file],
        text: cap || "",
        url: shareUrl,
        title: patchName || "My Patch",
      });
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.warn("Native share failed", e);
      }
    } finally {
      setSharingStory(false);
    }
  };

  return (
    <div className="pt-2 space-y-3">
      <p className="overline text-moss" data-testid="share-patch-platforms-label">
        {t("share_patch.platforms.label")}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button type="button" onClick={onTweet} disabled={tweeting}
          data-testid="share-patch-tweet"
          className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2 disabled:opacity-60 disabled:cursor-wait">
          {tweeting ? <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" /> : <Twitter strokeWidth={1.5} className="w-4 h-4" />}
          <span className="text-sm">{t("share_patch.platforms.x")}</span>
        </button>
        <button type="button" onClick={() => onSimpleShare("facebook")}
          data-testid="share-patch-facebook"
          className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2">
          <Facebook strokeWidth={1.5} className="w-4 h-4" />
          <span className="text-sm">{t("share_patch.platforms.facebook")}</span>
        </button>
        <button type="button" onClick={() => onSimpleShare("whatsapp")}
          data-testid="share-patch-whatsapp"
          className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2">
          <MessageCircle strokeWidth={1.5} className="w-4 h-4" />
          <span className="text-sm">{t("share_patch.platforms.whatsapp")}</span>
        </button>
        <button type="button" onClick={() => onSimpleShare("pinterest")}
          data-testid="share-patch-pinterest"
          className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2">
          <Pin strokeWidth={1.5} className="w-4 h-4" />
          <span className="text-sm">{t("share_patch.platforms.pinterest")}</span>
        </button>
        <button type="button" onClick={() => onSimpleShare("email")}
          data-testid="share-patch-email"
          className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2">
          <Mail strokeWidth={1.5} className="w-4 h-4" />
          <span className="text-sm">{t("share_patch.platforms.email")}</span>
        </button>
        {canNativeShareFiles && (
          <button type="button" onClick={onShareStory} disabled={sharingStory}
            data-testid="share-patch-story"
            className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2 disabled:opacity-60 disabled:cursor-wait">
            {sharingStory ? <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" /> : <Share strokeWidth={1.5} className="w-4 h-4" />}
            <span className="text-sm">{t("share_patch.platforms.story")}</span>
          </button>
        )}
      </div>
      <p className="text-xs text-moss/70 leading-relaxed">
        {t("share_patch.platforms.help")}
      </p>
    </div>
  );
}
