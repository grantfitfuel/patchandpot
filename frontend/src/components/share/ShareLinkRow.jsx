/**
 * ShareLinkRow — the URL field + Copy / Open / Native-share / Refresh
 * controls. Pulled out of SharePatchModal during the 2026-02 refactor so
 * the modal stays focused on layout. Stateless beyond the local
 * "just copied" tick.
 */
import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Share2, Sprout } from "lucide-react";
import { useI18n } from "@/i18n";

export default function ShareLinkRow({ shareUrl, busy, onRefresh }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

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

  const onNativeShare = async () => {
    if (!shareUrl || typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({
        title: t("share_patch.native_title", { name: "" }),
        text: t("share_patch.native_body", { name: "" }),
        url: shareUrl,
      });
    } catch {
      /* user cancelled — fine */
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
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
            {copied
              ? <Check strokeWidth={1.6} className="w-4 h-4" />
              : <Copy strokeWidth={1.6} className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {copied ? t("share_patch.copied") : t("share_patch.copy")}
            </span>
          </button>
        </div>
      </label>

      <div className="flex flex-wrap gap-3">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="share-patch-open"
          className="btn-ghost inline-flex items-center gap-2"
        >
          <ExternalLink strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.open")}
        </a>
        {canNativeShare && (
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
          onClick={onRefresh}
          disabled={busy}
          data-testid="share-patch-refresh"
          className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50"
        >
          {busy
            ? <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" />
            : <Sprout strokeWidth={1.5} className="w-4 h-4" />}
          {t("share_patch.refresh")}
        </button>
      </div>
    </>
  );
}
