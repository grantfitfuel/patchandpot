import { useEffect, useMemo, useRef, useState } from "react";
import { formatApiError } from "@/lib/formatApiError";
import { Check, ChevronDown, Code2, Copy, Download, ExternalLink, Facebook, ImageDown, Loader2, Mail, MessageCircle, Pin, Share, Share2, Sprout, Trash2, Twitter, X } from "lucide-react";
import { createSharedPatch, deleteSharedPatch } from "@/lib/api";
import { useI18n } from "@/i18n";

/**
 * "Share my patch" — turns the active patch into a public read-only URL.
 *
 * Local persistence: we cache `{share_id, owner_secret}` per patch under
 *   patchpot.share.<patchId>.v1
 * so re-opening the modal for the same patch UPDATES the existing snapshot
 * (preserving the URL the user already pasted into chat / email) instead
 * of minting a fresh one every time.
 */
function readCachedShare(patchId) {
  if (!patchId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`patchpot.share.${patchId}.v1`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedShare(patchId, value) {
  if (!patchId || typeof window === "undefined") return;
  try {
    localStorage.setItem(`patchpot.share.${patchId}.v1`, JSON.stringify(value));
  } catch (e) {
    console.warn("SharePatchModal: persist failed", e);
  }
}

function clearCachedShare(patchId) {
  if (!patchId || typeof window === "undefined") return;
  try { localStorage.removeItem(`patchpot.share.${patchId}.v1`); }
  catch (e) { console.warn("SharePatchModal: clear failed", e); }
}

// Minimal HTML-attribute escape — used for the iframe `title` we embed in
// the copy-pasteable snippet. Keeps user-provided patch names safe to drop
// into someone else's blog without breaking the snippet's outer quotes.
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function SharePatchModal({ open, onClose, patchId, patchName, region, plants }) {
  const { t } = useI18n();
  const [state, setState] = useState({ status: "idle", error: "" });
  const [cached, setCached] = useState(() => readCachedShare(patchId));
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Opt-in: surface this patch on the homepage "Most-loved" wall.
  // Default off — owner explicitly toggles it on.
  const [listPublicly, setListPublicly] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCached(readCachedShare(patchId));
    setState({ status: "idle", error: "" });
    setCopied(false);
    setShowDeleteConfirm(false);
  }, [open, patchId]);

  // Auto-save `list_publicly` toggle changes — but skip the very first
  // render after the modal opens (otherwise the initial false→false noop
  // would fire a redundant POST).
  const firstToggleRender = useRef(true);
  useEffect(() => {
    if (firstToggleRender.current) {
      firstToggleRender.current = false;
      return;
    }
    if (!cached?.share_id || !cached?.owner_secret) return;
    onCreateOrUpdate();
    // onCreateOrUpdate is intentionally not in deps — it's recreated on
    // every render via inline closures and would loop. We only want to
    // fire when the toggle itself flips.
  }, [listPublicly]);

  // Reset the "first render skip" flag whenever the modal opens.
  useEffect(() => {
    if (open) firstToggleRender.current = true;
  }, [open]);

  // Pretty, human-facing URL — displayed in the modal, copied to clipboard,
  // pasted into emails and WhatsApp body text. The `?v=` suffix is a
  // stable cache-buster: every time we ship a new share-card aesthetic
  // we bump the value, which makes Facebook / Pinterest / LinkedIn treat
  // it as a brand-new URL and re-scrape (their preview caches are keyed
  // on the full URL including query string, and they bake the scraped
  // image into every post permanently — there's no other way to force
  // them to forget the old preview).
  const SHARE_CARD_VERSION = "wc2"; // bump when og.png aesthetic changes
  const shareUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/p/${cached.share_id}?v=${SHARE_CARD_VERSION}`;
  }, [cached]);

  // Crawler-friendly URL — passed *only* to platform share intents
  // (Facebook `?u=`, Twitter `?url=`, LinkedIn, etc.) so their scrapers
  // land on the server-rendered preview HTML with proper OG meta. Same
  // version suffix as `shareUrl` so previously-cached previews are
  // ignored and a fresh watercolour scrape is forced.
  const crawlerUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/share/preview/${cached.share_id}?v=${SHARE_CARD_VERSION}`;
  }, [cached]);

  // Alias retained so other components (Open-preview button, embed snippet)
  // keep working without further refactor.
  const directUrl = shareUrl;

  // Iframe-friendly embed URL — designed to be dropped into a blog post via
  // the snippet shown below. Skips header/footer chrome via the /embed/p/
  // route handled in App.js.
  const embedUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/embed/p/${cached.share_id}`;
  }, [cached]);

  const embedSnippet = useMemo(() => {
    if (!embedUrl) return "";
    const title = patchName ? `${patchName} — Patch & Pot` : "My Patch & Pot garden";
    return `<iframe src="${embedUrl}" width="100%" height="420" frameborder="0" style="border:1px solid #e6e1d6;max-width:640px" title="${escapeAttr(title)}" loading="lazy"></iframe>`;
  }, [embedUrl, patchName]);

  // QR sticker PDF for printing & sticking on a garden gate.
  const qrPdfUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    const backend = process.env.REACT_APP_BACKEND_URL || "";
    return `${backend}/api/share/patch/${cached.share_id}/qr.pdf`;
  }, [cached]);

  // Social Media Kit ZIP — 4 aspect-ratio teasers + per-platform captions.
  // The endpoint generates + caches everything server-side; the user just
  // needs an anchor tag with a sensible filename.
  const socialKitUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    const backend = process.env.REACT_APP_BACKEND_URL || "";
    return `${backend}/api/share/patch/${cached.share_id}/social-kit.zip`;
  }, [cached]);

  // [Share to Stories / Reels] — invokes the OS-native share sheet on
  // mobile so the user can post to Instagram Story / TikTok / WhatsApp
  // Status in one tap. Requires the Web Share API Level 2 (file sharing).
  // Desktop browsers and older mobiles silently fall back to a download.
  const [sharingStory, setSharingStory] = useState(false);
  const canNativeShareFiles = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    if (typeof navigator.canShare !== "function") return false;
    try {
      // Probe with a 1-byte dummy file — same File API surface as the
      // real share. If canShare returns false here (e.g. desktop
      // Chrome) we don't show the button at all.
      const probe = new File([new Uint8Array([0])], "probe.png", { type: "image/png" });
      return navigator.canShare({ files: [probe] });
    } catch {
      return false;
    }
  }, []);
  const onShareStory = async () => {
    if (!cached?.share_id || sharingStory) return;
    setSharingStory(true);
    try {
      const backend = process.env.REACT_APP_BACKEND_URL || "";
      // Fetch the 9:16 teaser image + captions in parallel — the captions
      // endpoint also warms the LLM cache for any later Tweet click.
      const [imgRes, capRes] = await Promise.all([
        fetch(`${backend}/api/share/patch/${cached.share_id}/story.png`),
        fetch(`${backend}/api/share/patch/${cached.share_id}/captions.json`),
      ]);
      if (!imgRes.ok) throw new Error("story image fetch failed");
      const blob = await imgRes.blob();
      const file = new File([blob], "patch-and-pot-story.png", { type: "image/png" });
      const cap = capRes.ok ? (await capRes.json())?.captions?.reels_story : "";
      await navigator.share({
        files: [file],
        text: cap || "",
        url: shareUrl,
        title: cached?.patch_name || "My Patch",
      });
    } catch (e) {
      // AbortError = user dismissed the share sheet; not worth surfacing.
      if (e?.name !== "AbortError") {
        console.warn("Native share failed", e);
      }
    } finally {
      setSharingStory(false);
    }
  };
  // Per-platform one-tap share. Every branch ships a ready post: the
  // platform's own intent URL takes a URL we control, the platform
  // scrapes our OG card image (the watercolour), and the caption sits
  // in the text/quote/description param. No "download a ZIP" anywhere.
  //
  // iOS quirk: `facebook.com/sharer.php` is intercepted by Facebook's
  // universal link → the FB app opens the feed and silently DROPS the
  // `u=` param. Same kind of behaviour on WhatsApp's `wa.me`. So on
  // mobile (where the Web Share API exists) we hand the share off to
  // the OS-native share sheet instead — the user taps Facebook in the
  // iOS sheet and FB's own composer receives the URL + caption
  // correctly. Desktop browsers still use the sharer URL (works fine
  // because no universal-link interception there).
  const onSimpleShare = async (platform) => {
    if (!cached?.share_id || !shareUrl) return;
    const name = cached?.patch_name || "my patch";
    const tagline = t("share_patch.platforms.default_text", { name });

    // Prefer the OS-native share sheet on platforms that get hijacked
    // by their own apps (FB, WhatsApp). The user still chooses Facebook
    // / WhatsApp / Messages from the sheet, but the OS hands the data
    // to the right app with the URL + text intact. We pass the
    // crawler-friendly URL so receiving apps (FB, iMessage, WhatsApp)
    // scrape proper OG meta and render a watercolour card preview.
    const isMobileHijackedPlatform = platform === "facebook" || platform === "whatsapp";
    if (isMobileHijackedPlatform && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: tagline,
          url: crawlerUrl,
        });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return; // user dismissed
        // fall through to the URL intent if Web Share rejects
      }
    }

    let intent;
    switch (platform) {
      case "facebook":
        // Desktop fallback only — FB's web sharer honours `u`.
        intent = "https://www.facebook.com/sharer/sharer.php"
          + `?u=${encodeURIComponent(crawlerUrl)}`
          + `&quote=${encodeURIComponent(tagline)}`;
        break;
      case "whatsapp":
        // Desktop fallback — WhatsApp Web scrapes the URL for an
        // unfurl card. Pretty URL in the message body, crawler URL
        // would also work but pretty looks better in the chat.
        intent = "https://wa.me/"
          + `?text=${encodeURIComponent(`${tagline} ${crawlerUrl}`)}`;
        break;
      case "pinterest": {
        // Pinterest pins the *image* directly, with caption + URL.
        // The `url` Pinterest stores against the pin is the human
        // pretty URL — that's what Pinterest displays under the pin.
        const backend = process.env.REACT_APP_BACKEND_URL || "";
        const media = `${backend}/api/share/patch/${cached.share_id}/og.png`;
        intent = "https://pinterest.com/pin/create/button/"
          + `?url=${encodeURIComponent(shareUrl)}`
          + `&media=${encodeURIComponent(media)}`
          + `&description=${encodeURIComponent(tagline)}`;
        break;
      }
      case "email":
        // Mail clients prefill subject + body with the pretty link —
        // recipients see a clean URL, not the /api/... internal path.
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
  // URL pre-filled with both the caption text and the patch URL. X will
  // auto-attach the OG card image when it scrapes the URL, so the user
  // gets a real Twitter Card preview with zero extra work.
  const [tweeting, setTweeting] = useState(false);
  const onTweet = async () => {
    if (!cached?.share_id || tweeting) return;
    setTweeting(true);
    try {
      const backend = process.env.REACT_APP_BACKEND_URL || "";
      const r = await fetch(`${backend}/api/share/patch/${cached.share_id}/captions.json`);
      const json = r.ok ? await r.json() : null;
      let twitterCaption = json?.captions?.youtube_twitter || "";
      // The AI caption sometimes embeds the patch URL inline ("…going. https://patchandpot.app/p/abc").
      // Twitter's intent appends the URL via `url=` separately, so leaving
      // it inline produces a duplicate URL in the tweet. Strip any
      // patchandpot.app links from the caption text before handing it off.
      twitterCaption = twitterCaption
        .replace(/https?:\/\/(?:www\.)?patchandpot\.[^\s]+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      const intent = new URL("https://x.com/intent/tweet");
      if (twitterCaption) intent.searchParams.set("text", twitterCaption);
      // Twitter scrapes the URL we pass — must be the crawler-friendly
      // preview endpoint that serves og:image + twitter:card meta, not
      // the SPA route at /p/{id}.
      intent.searchParams.set("url", crawlerUrl);
      const win = window.open(intent.toString(), "_blank", "noopener,noreferrer,width=600,height=560");
      if (!win) window.location.href = intent.toString();
    } catch (e) {
      console.warn("Tweet intent failed", e);
    } finally {
      setTweeting(false);
    }
  };

  const ready = !!region && !!patchName;

  const onCreateOrUpdate = async () => {
    if (!ready || state.status === "loading") return;
    setState({ status: "loading", error: "" });
    try {
      const result = await createSharedPatch({
        patch_name: patchName,
        list_publicly: listPublicly,
        region: {
          name: region.name,
          country: region.country || null,
          latitude: region.latitude ?? null,
          longitude: region.longitude ?? null,
          climate_zone: region.climate_zone || null,
          hemisphere: region.hemisphere || null,
        },
        plants: (plants || []).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category || null,
          ai_generated: !!p.ai_generated,
        })),
        share_id: cached?.share_id || null,
        owner_secret: cached?.owner_secret || null,
      });
      const next = { share_id: result.share_id, owner_secret: result.owner_secret };
      writeCachedShare(patchId, next);
      setCached(next);
      setState({ status: "ok", error: "" });
    } catch (e) {
      setState({ status: "error", error: formatApiError(e, t("share_patch.error_generic")) });
    }
  };

  const onCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.warn("clipboard write failed", e);
    }
  };

  const onCopyEmbed = async () => {
    if (!embedSnippet) return;
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 1800);
    } catch (e) {
      console.warn("clipboard write failed (embed)", e);
    }
  };

  const onNativeShare = async () => {
    if (!shareUrl || typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({
        title: t("share_patch.native_title", { name: patchName }),
        text: t("share_patch.native_body", { name: patchName }),
        url: shareUrl,
      });
    } catch {
      /* user cancelled — fine */
    }
  };

  const onDelete = async () => {
    if (!cached?.share_id || !cached?.owner_secret) return;
    setState({ status: "loading", error: "" });
    try {
      await deleteSharedPatch(cached.share_id, cached.owner_secret);
      clearCachedShare(patchId);
      setCached(null);
      setShowDeleteConfirm(false);
      setState({ status: "idle", error: "" });
    } catch (e) {
      setState({ status: "error", error: formatApiError(e, t("share_patch.error_generic")) });
    }
  };

  if (!open) return null;

  const plantCount = (plants || []).length;
  const summaryLine = t("share_patch.summary", {
    n: plantCount,
    label: plantCount === 1 ? t("share_patch.plant_singular") : t("share_patch.plant_plural"),
    region: region?.name || "—",
  });

  return (
    <div
      data-testid="share-patch-modal"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-10 sm:p-10 bg-ink/40 backdrop-blur-sm animate-fade-up overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-sand w-full max-w-xl border border-border shadow-xl max-h-[95vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-border gap-4">
          <div>
            <p className="overline">{t("share_patch.eyebrow")}</p>
            <h2 className="font-serif text-3xl text-forest mt-1 leading-tight">
              {cached ? t("share_patch.title_live") : t("share_patch.title_idle")}
            </h2>
            <p className="text-sm text-moss mt-2 leading-relaxed">{summaryLine}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("share_patch.close")}
            data-testid="share-patch-close"
            className="text-moss hover:text-forest"
          >
            <X strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-5">
          {!ready && (
            <div className="card-flat p-5 text-sm text-moss">
              {t("share_patch.no_region")}
            </div>
          )}

          {state.status === "error" && (
            <div className="border border-terracotta/40 bg-terracotta/5 text-terracotta px-4 py-3 text-sm" data-testid="share-patch-error">
              {state.error}
            </div>
          )}

          {!cached && ready && (
            <button
              type="button"
              onClick={onCreateOrUpdate}
              disabled={state.status === "loading"}
              data-testid="share-patch-create"
              className="btn-terracotta w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {state.status === "loading" ? (
                <><Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" /> {t("share_patch.creating")}</>
              ) : (
                <><Share2 strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.create_cta")}</>
              )}
            </button>
          )}

          {cached && (
            <>
              <label className="block">
                <span className="overline">{t("share_patch.link_label")}</span>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    data-testid="share-patch-url-input"
                    className="flex-1 px-3 py-2 border border-border bg-surface text-ink text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={onCopy}
                    data-testid="share-patch-copy"
                    className="btn-ghost inline-flex items-center gap-2 px-4"
                  >
                    {copied ? <Check strokeWidth={1.6} className="w-4 h-4" /> : <Copy strokeWidth={1.6} className="w-4 h-4" />}
                    <span className="hidden sm:inline">{copied ? t("share_patch.copied") : t("share_patch.copy")}</span>
                  </button>
                </div>
              </label>

              <div className="flex flex-wrap gap-3">
                <a
                  href={directUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="share-patch-open"
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  <ExternalLink strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.open")}
                </a>
                {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                  <button
                    type="button"
                    onClick={onNativeShare}
                    data-testid="share-patch-native"
                    className="btn-ghost inline-flex items-center gap-2"
                  >
                    <Share2 strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.native")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCreateOrUpdate}
                  disabled={state.status === "loading"}
                  data-testid="share-patch-refresh"
                  className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {state.status === "loading" ? (
                    <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sprout strokeWidth={1.5} className="w-4 h-4" />
                  )}
                  {t("share_patch.refresh")}
                </button>
              </div>

              <p className="text-xs text-moss/80 leading-relaxed">
                {t("share_patch.fine_print")}
              </p>

              {/* Opt-in: homepage discovery wall */}
              <label className="flex items-start gap-3 cursor-pointer select-none" data-testid="share-patch-list-publicly-label">
                <input
                  type="checkbox"
                  checked={listPublicly}
                  onChange={(e) => setListPublicly(e.target.checked)}
                  data-testid="share-patch-list-publicly"
                  className="mt-1 w-4 h-4 accent-forest"
                />
                <span className="text-xs text-ink/80 leading-relaxed">
                  <span className="block font-semibold text-ink">{t("share_patch.list_publicly.title")}</span>
                  {t("share_patch.list_publicly.help")}
                </span>
              </label>

              {/* PRIMARY SHARE ROW — every button = one tap → ready post
                  with image + caption + link. No "download a ZIP" nonsense.
                  Mobile users see a "Share to phone" button that fires the
                  native share sheet (Instagram, TikTok, Stories, etc).      */}
              <div className="pt-2 space-y-3">
                <p className="overline text-moss" data-testid="share-patch-platforms-label">
                  {t("share_patch.platforms.label")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={onTweet}
                    disabled={tweeting}
                    data-testid="share-patch-tweet"
                    className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2 disabled:opacity-60 disabled:cursor-wait"
                  >
                    {tweeting
                      ? <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" />
                      : <Twitter strokeWidth={1.5} className="w-4 h-4" />}
                    <span className="text-sm">{t("share_patch.platforms.x")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimpleShare("facebook")}
                    data-testid="share-patch-facebook"
                    className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2"
                  >
                    <Facebook strokeWidth={1.5} className="w-4 h-4" />
                    <span className="text-sm">{t("share_patch.platforms.facebook")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimpleShare("whatsapp")}
                    data-testid="share-patch-whatsapp"
                    className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2"
                  >
                    <MessageCircle strokeWidth={1.5} className="w-4 h-4" />
                    <span className="text-sm">{t("share_patch.platforms.whatsapp")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimpleShare("pinterest")}
                    data-testid="share-patch-pinterest"
                    className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2"
                  >
                    <Pin strokeWidth={1.5} className="w-4 h-4" />
                    <span className="text-sm">{t("share_patch.platforms.pinterest")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSimpleShare("email")}
                    data-testid="share-patch-email"
                    className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2"
                  >
                    <Mail strokeWidth={1.5} className="w-4 h-4" />
                    <span className="text-sm">{t("share_patch.platforms.email")}</span>
                  </button>
                  {canNativeShareFiles && (
                    <button
                      type="button"
                      onClick={onShareStory}
                      disabled={sharingStory}
                      data-testid="share-patch-story"
                      className="btn-ghost inline-flex items-center justify-center gap-2 px-3 py-2 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {sharingStory
                        ? <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" />
                        : <Share strokeWidth={1.5} className="w-4 h-4" />}
                      <span className="text-sm">{t("share_patch.platforms.story")}</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-moss/70 leading-relaxed">
                  {t("share_patch.platforms.help")}
                </p>
              </div>

              {/* ADVANCED — power users only. QR sticker, embed code, raw
                  4-image kit. Hidden behind a disclosure so most users
                  never see them.                                          */}
              <details className="pt-2 group" data-testid="share-patch-advanced">
                <summary className="text-sm text-moss/80 hover:text-forest cursor-pointer inline-flex items-center gap-2 list-none">
                  <ChevronDown strokeWidth={1.5} className="w-4 h-4 transition-transform group-open:rotate-180" />
                  {t("share_patch.advanced.toggle")}
                </summary>
                <div className="pt-3 flex flex-wrap items-center gap-4">
                  {!showEmbed ? (
                    <button
                      type="button"
                      onClick={() => setShowEmbed(true)}
                      data-testid="share-patch-embed-open"
                      className="text-sm text-moss hover:text-forest inline-flex items-center gap-2"
                    >
                      <Code2 strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.embed.open")}
                    </button>
                  ) : null}
                  <a
                    href={qrPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="share-patch-qr-download"
                    className="text-sm text-moss hover:text-forest inline-flex items-center gap-2"
                  >
                    <Download strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.qr.download")}
                  </a>
                  <a
                    href={socialKitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="share-patch-social-kit"
                    className="text-sm text-moss hover:text-forest inline-flex items-center gap-2"
                  >
                    <ImageDown strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.social_kit.download")}
                  </a>
                </div>
              </details>
              {showEmbed && (
                <div className="pt-2 space-y-2" data-testid="share-patch-embed-block">
                  <p className="overline">{t("share_patch.embed.label")}</p>
                  <p className="text-xs text-moss/80">{t("share_patch.embed.help")}</p>
                  <textarea
                    readOnly
                    rows={4}
                    value={embedSnippet}
                    onFocus={(e) => e.target.select()}
                    data-testid="share-patch-embed-snippet"
                    className="w-full px-3 py-2 border border-border bg-surface text-ink text-xs font-mono resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onCopyEmbed}
                      data-testid="share-patch-embed-copy"
                      className="btn-ghost inline-flex items-center gap-2"
                    >
                      {embedCopied ? <Check strokeWidth={1.6} className="w-4 h-4" /> : <Copy strokeWidth={1.6} className="w-4 h-4" />}
                      {embedCopied ? t("share_patch.copied") : t("share_patch.embed.copy")}
                    </button>
                    <a
                      href={embedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="share-patch-embed-preview"
                      className="btn-ghost inline-flex items-center gap-2"
                    >
                      <ExternalLink strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.embed.preview")}
                    </a>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    data-testid="share-patch-delete-open"
                    className="text-sm text-moss hover:text-terracotta inline-flex items-center gap-2"
                  >
                    <Trash2 strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.delete")}
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-ink/80">{t("share_patch.delete_confirm")}</span>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={state.status === "loading"}
                      data-testid="share-patch-delete-confirm"
                      className="text-sm text-terracotta hover:underline disabled:opacity-50"
                    >
                      {t("share_patch.delete_yes")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      data-testid="share-patch-delete-cancel"
                      className="text-sm text-moss hover:text-forest"
                    >
                      {t("share_patch.cancel")}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
