import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Code2, Copy, Download, ExternalLink, Loader2, Share2, Sprout, Trash2, X } from "lucide-react";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listPublicly]);

  // Reset the "first render skip" flag whenever the modal opens.
  useEffect(() => {
    if (open) firstToggleRender.current = true;
  }, [open]);

  const shareUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    // We share the crawler-friendly /api/share/preview/{id} URL — it serves
    // proper OG/Twitter meta tags up-front so chat / DM / social previews
    // unfurl into a real card, then redirects humans into the clean SPA
    // route /p/{id}. The redirect happens via window.location.replace so
    // recipients see only a single navigation, not a flash.
    return `${origin}/api/share/preview/${cached.share_id}`;
  }, [cached]);

  // Direct (clean) URL — surfaced as a secondary "open preview" link so the
  // owner can verify their patch without going through the redirect.
  const directUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/p/${cached.share_id}`;
  }, [cached]);

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
      const detail = e?.response?.data?.detail || t("share_patch.error_generic");
      setState({ status: "error", error: detail });
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
      const detail = e?.response?.data?.detail || t("share_patch.error_generic");
      setState({ status: "error", error: detail });
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10 bg-ink/40 backdrop-blur-sm animate-fade-up"
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

              {/* Embed snippet + QR sticker — collapsed by default so the
                  primary share flow stays uncluttered. */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
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
              </div>
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
