/**
 * "Share my patch" — turns the active patch into a public read-only URL.
 *
 * This component is the composition shell. The heavy lifting lives in:
 *   • `hooks/useSharedPatch` — state + persistence + URL builders + API
 *   • `components/share/ShareLinkRow` — URL field + Copy / Open / Refresh
 *   • `components/share/ShareSocialGrid` — X / FB / WhatsApp / Pinterest /
 *     Email / Stories buttons (one-tap pre-filled platform intents)
 *   • `components/share/ShareAdvancedBlock` — embed snippet + QR PDF +
 *     social-kit ZIP, hidden behind a disclosure
 *
 * Refactored 2026-02 — was previously a single 745-line file.
 */
import { useState, useEffect } from "react";
import { Loader2, Share2, Trash2, X } from "lucide-react";
import useSharedPatch from "@/hooks/useSharedPatch";
import ShareLinkRow from "@/components/share/ShareLinkRow";
import ShareSocialGrid from "@/components/share/ShareSocialGrid";
import ShareAdvancedBlock from "@/components/share/ShareAdvancedBlock";
import { useI18n } from "@/i18n";

export default function SharePatchModal({ open, onClose, patchId, patchName, region, plants }) {
  const { t } = useI18n();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    state, cached, ready,
    shareUrl, embedUrl, qrPdfUrl, socialKitUrl, embedSnippet,
    listPublicly, setListPublicly,
    createOrUpdate, removeShare,
  } = useSharedPatch({
    open, patchId, patchName, region, plants,
    fallbackErrorMsg: t("share_patch.error_generic"),
  });

  // Reset transient confirm-prompt state every time the modal opens for a
  // new patch.
  useEffect(() => {
    if (open) setShowDeleteConfirm(false);
  }, [open, patchId]);

  if (!open) return null;

  const plantCount = (plants || []).length;
  const summaryLine = t("share_patch.summary", {
    n: plantCount,
    label: plantCount === 1
      ? t("share_patch.plant_singular")
      : t("share_patch.plant_plural"),
    region: region?.name || "—",
  });

  const onDelete = async () => {
    await removeShare();
    setShowDeleteConfirm(false);
  };

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
            <div
              className="border border-terracotta/40 bg-terracotta/5 text-terracotta px-4 py-3 text-sm"
              data-testid="share-patch-error"
            >
              {state.error}
            </div>
          )}

          {!cached && ready && (
            <button
              type="button"
              onClick={() => createOrUpdate()}
              disabled={state.status === "loading"}
              data-testid="share-patch-create"
              className="btn-terracotta w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {state.status === "loading" ? (
                <>
                  <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" />
                  {t("share_patch.creating")}
                </>
              ) : (
                <>
                  <Share2 strokeWidth={1.5} className="w-4 h-4" />
                  {t("share_patch.create_cta")}
                </>
              )}
            </button>
          )}

          {cached && (
            <>
              <ShareLinkRow
                shareUrl={shareUrl}
                busy={state.status === "loading"}
                onRefresh={() => createOrUpdate()}
              />

              <p className="text-xs text-moss/80 leading-relaxed">
                {t("share_patch.fine_print")}
              </p>

              {/* Opt-in: homepage discovery wall */}
              <label
                className="flex items-start gap-3 cursor-pointer select-none"
                data-testid="share-patch-list-publicly-label"
              >
                <input
                  type="checkbox"
                  checked={listPublicly}
                  onChange={(e) => setListPublicly(e.target.checked)}
                  data-testid="share-patch-list-publicly"
                  className="mt-1 w-4 h-4 accent-forest"
                />
                <span className="text-xs text-ink/80 leading-relaxed">
                  <span className="block font-semibold text-ink">
                    {t("share_patch.list_publicly.title")}
                  </span>
                  {t("share_patch.list_publicly.help")}
                </span>
              </label>

              <ShareSocialGrid
                shareUrl={shareUrl}
                shareId={cached.share_id}
                patchName={patchName}
              />

              <ShareAdvancedBlock
                embedUrl={embedUrl}
                embedSnippet={embedSnippet}
                qrPdfUrl={qrPdfUrl}
                socialKitUrl={socialKitUrl}
              />

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
                    <span className="text-sm text-ink/80">
                      {t("share_patch.delete_confirm")}
                    </span>
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
