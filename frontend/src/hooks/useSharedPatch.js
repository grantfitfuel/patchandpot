/**
 * useSharedPatch — encapsulates everything stateful and async about the
 * "Share my patch" feature so the SharePatchModal can stay focused on
 * layout. Pulled out of SharePatchModal.jsx during the 2026-02 refactor.
 *
 * Responsibilities:
 *   • Local-storage persistence of `{share_id, owner_secret}` keyed by
 *     patchId, so re-opening the modal updates the existing snapshot
 *     instead of minting a new URL every time.
 *   • Derived URLs (shareUrl, embedUrl, qrPdfUrl, socialKitUrl) all
 *     pointing at the backend-rendered preview endpoint that serves
 *     proper OG / Twitter Card meta for social-crawler unfurls.
 *   • create / update / delete via the existing api helpers, plus the
 *     auto-save behaviour when the "list publicly" checkbox toggles.
 *   • Embed snippet builder (HTML-escapes the iframe title).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createSharedPatch, deleteSharedPatch } from "@/lib/api";
import { formatApiError } from "@/lib/formatApiError";

const LS_PREFIX = "patchpot.share";
const LS_SUFFIX = "v1";

function lsKey(patchId) {
  return `${LS_PREFIX}.${patchId}.${LS_SUFFIX}`;
}

function readCachedShare(patchId) {
  if (!patchId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(lsKey(patchId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedShare(patchId, value) {
  if (!patchId || typeof window === "undefined") return;
  try {
    localStorage.setItem(lsKey(patchId), JSON.stringify(value));
  } catch (e) {
    console.warn("useSharedPatch: persist failed", e);
  }
}

function clearCachedShare(patchId) {
  if (!patchId || typeof window === "undefined") return;
  try { localStorage.removeItem(lsKey(patchId)); }
  catch (e) { console.warn("useSharedPatch: clear failed", e); }
}

// Minimal HTML-attribute escape used for the iframe `title` we embed in
// the copy-pasteable snippet. Keeps user-provided patch names safe to drop
// into someone else's blog without breaking the snippet's outer quotes.
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function useSharedPatch({
  open, patchId, patchName, region, plants, fallbackErrorMsg,
}) {
  const [state, setState] = useState({ status: "idle", error: "" });
  const [cached, setCached] = useState(() => readCachedShare(patchId));
  // Opt-in: surface this patch on the homepage "Most-loved" wall.
  // Default off — owner must explicitly toggle it on.
  const [listPublicly, setListPublicly] = useState(false);

  // Re-hydrate from localStorage and reset transient UI state each time
  // the modal opens.
  useEffect(() => {
    if (!open) return;
    setCached(readCachedShare(patchId));
    setState({ status: "idle", error: "" });
  }, [open, patchId]);

  // Single canonical URL for both display + sharing. We use the backend
  // preview endpoint (`/api/share/preview/{id}`) because it serves proper
  // OG / Twitter Card meta to social scrapers and meta-refreshes humans
  // to the pretty `/p/{id}` SPA route in < 0.5s.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const backend = process.env.REACT_APP_BACKEND_URL || "";

  const shareUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    return `${origin}/api/share/preview/${cached.share_id}`;
  }, [cached, origin]);

  const embedUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    return `${origin}/embed/p/${cached.share_id}`;
  }, [cached, origin]);

  const qrPdfUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    return `${backend}/api/share/patch/${cached.share_id}/qr.pdf`;
  }, [cached, backend]);

  const socialKitUrl = useMemo(() => {
    if (!cached?.share_id) return "";
    return `${backend}/api/share/patch/${cached.share_id}/social-kit.zip`;
  }, [cached, backend]);

  const embedSnippet = useMemo(() => {
    if (!embedUrl) return "";
    const title = patchName ? `${patchName} — Patch & Pot` : "My Patch & Pot garden";
    return `<iframe src="${embedUrl}" width="100%" height="420" frameborder="0" style="border:1px solid #e6e1d6;max-width:640px" title="${escapeAttr(title)}" loading="lazy"></iframe>`;
  }, [embedUrl, patchName]);

  const ready = !!region && !!patchName;

  const createOrUpdate = async (opts = {}) => {
    if (!ready || state.status === "loading") return;
    // Allow callers (e.g. the listPublicly toggle effect) to override the
    // boolean we send up — useEffect closures wouldn't otherwise see the
    // freshest `listPublicly` value because of stale-state-in-closure.
    const publicly =
      typeof opts.listPublicly === "boolean" ? opts.listPublicly : listPublicly;
    setState({ status: "loading", error: "" });
    try {
      const result = await createSharedPatch({
        patch_name: patchName,
        list_publicly: publicly,
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
      setState({ status: "error", error: formatApiError(e, fallbackErrorMsg) });
    }
  };

  // Auto-save `list_publicly` toggle changes — but skip the first render
  // after the modal opens (otherwise the initial false→false noop would
  // fire a redundant POST). Triggered only when an existing share is
  // already created (no point firing this before there's anything to flip).
  const firstToggleRender = useRef(true);
  useEffect(() => {
    if (firstToggleRender.current) {
      firstToggleRender.current = false;
      return;
    }
    if (!cached?.share_id || !cached?.owner_secret) return;
    createOrUpdate({ listPublicly });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listPublicly]);

  useEffect(() => {
    if (open) firstToggleRender.current = true;
  }, [open]);

  const removeShare = async () => {
    if (!cached?.share_id || !cached?.owner_secret) return;
    setState({ status: "loading", error: "" });
    try {
      await deleteSharedPatch(cached.share_id, cached.owner_secret);
      clearCachedShare(patchId);
      setCached(null);
      setState({ status: "idle", error: "" });
    } catch (e) {
      setState({ status: "error", error: formatApiError(e, fallbackErrorMsg) });
    }
  };

  return {
    state, cached, ready,
    shareUrl, embedUrl, qrPdfUrl, socialKitUrl, embedSnippet,
    listPublicly, setListPublicly,
    createOrUpdate, removeShare,
  };
}
