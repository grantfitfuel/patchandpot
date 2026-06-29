/**
 * ShareAdvancedBlock — power-user disclosure (embed snippet + QR PDF +
 * Social-kit ZIP). Hidden behind a <details> so most users never see it.
 *
 * Extracted from SharePatchModal during the 2026-02 refactor.
 */
import { useState } from "react";
import { Check, ChevronDown, Code2, Copy, Download, ExternalLink, ImageDown } from "lucide-react";
import { useI18n } from "@/i18n";

export default function ShareAdvancedBlock({ embedUrl, embedSnippet, qrPdfUrl, socialKitUrl }) {
  const { t } = useI18n();
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

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

  return (
    <>
      <details className="pt-2 group" data-testid="share-patch-advanced">
        <summary className="text-sm text-moss/80 hover:text-forest cursor-pointer inline-flex items-center gap-2 list-none">
          <ChevronDown strokeWidth={1.5} className="w-4 h-4 transition-transform group-open:rotate-180" />
          {t("share_patch.advanced.toggle")}
        </summary>
        <div className="pt-3 flex flex-wrap items-center gap-4">
          {!showEmbed && (
            <button
              type="button"
              onClick={() => setShowEmbed(true)}
              data-testid="share-patch-embed-open"
              className="text-sm text-moss hover:text-forest inline-flex items-center gap-2"
            >
              <Code2 strokeWidth={1.5} className="w-4 h-4" /> {t("share_patch.embed.open")}
            </button>
          )}
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
              {embedCopied
                ? <Check strokeWidth={1.6} className="w-4 h-4" />
                : <Copy strokeWidth={1.6} className="w-4 h-4" />}
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
    </>
  );
}
