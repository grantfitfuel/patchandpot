import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, MapPin, Sprout } from "lucide-react";
import { fetchSharedPatch } from "@/lib/api";
import PlantImage from "@/components/PlantImage";

/**
 * Public, iframe-friendly read-only embed of a shared patch.
 *
 * URL: /embed/p/:shareId — designed to be dropped into a blog post, garden-
 * club page, or school newsletter via:
 *   <iframe src="https://patchandpot.app/embed/p/abc123"
 *           width="100%" height="420" frameborder="0"
 *           style="border:1px solid #e6e1d6;border-radius:0;max-width:640px"
 *           title="My Patch & Pot garden">
 *   </iframe>
 *
 * Design constraints:
 *   - No header / footer chrome (parent page already has its own)
 *   - No JS that talks to the parent (postMessage etc. — keep simple)
 *   - Big tap-target "Open the full patch on Patch & Pot →" so embed visits
 *     convert to real signups
 *   - Renders OK at 320×420 (mobile) AND 640×420 (desktop card)
 *   - Public read-only; no localStorage writes
 */
export default function EmbedPatchPage() {
  const { shareId } = useParams();
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    if (!shareId) return;
    let cancelled = false;
    fetchSharedPatch(shareId)
      .then((d) => { if (!cancelled) setState({ status: "ok", data: d }); })
      .catch((e) => {
        if (cancelled) return;
        const code = e?.response?.status === 404 ? "not_found" : "error";
        setState({ status: code, data: null });
      });
    return () => { cancelled = true; };
  }, [shareId]);

  // Lift the body background so the embed doesn't inherit the parent's
  // dark theme through a transparent canvas. Also kill scrollbars — the
  // embed should size itself naturally inside the iframe.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.background;
    document.body.style.background = "#F7F5F0";
    document.body.classList.add("embed-mode");
    return () => {
      document.body.style.background = prev;
      document.body.classList.remove("embed-mode");
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="min-h-[300px] flex items-center justify-center bg-sand" data-testid="embed-loading">
        <Loader2 className="w-5 h-5 animate-spin text-moss" strokeWidth={1.5} />
      </div>
    );
  }

  if (state.status === "not_found" || state.status === "error") {
    return (
      <div className="bg-sand p-6 text-center" data-testid="embed-missing">
        <Sprout strokeWidth={1.3} className="w-6 h-6 text-terracotta mx-auto mb-3" />
        <p className="font-serif text-xl text-forest">This patch has moved on.</p>
        <a
          href="/" target="_top" rel="noopener"
          className="inline-block mt-4 text-sm uppercase tracking-wider text-terracotta"
        >
          Visit Patch & Pot →
        </a>
      </div>
    );
  }

  const d = state.data;
  const plants = (d.plants || []).slice(0, 6); // cap visible plants in the embed
  const overflow = (d.plants || []).length - plants.length;
  const region = d.region || null;

  // Always target=_top — the embed lives in an iframe, so clicks must
  // escape it to land on the real site.
  const fullUrl = `/p/${shareId}`;

  return (
    <div
      data-testid="embed-patch"
      className="bg-sand border border-border p-5 sm:p-6 max-w-[640px] mx-auto"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-moss/80">
            A garden on Patch & Pot
          </p>
          <h2
            className="font-serif text-2xl sm:text-3xl text-forest mt-1 leading-tight truncate"
            data-testid="embed-name"
          >
            {d.patch_name}
          </h2>
          {region && (
            <p className="mt-1.5 text-sm text-ink/80 inline-flex items-center gap-1.5">
              <MapPin strokeWidth={1.5} className="w-3.5 h-3.5 text-moss" />
              <span className="truncate">{region.name}{region.country ? `, ${region.country}` : ""}</span>
            </p>
          )}
        </div>
        <a
          href={fullUrl}
          target="_top"
          rel="noopener"
          className="shrink-0 inline-flex items-center gap-1 bg-terracotta text-sand px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-terracotta/90"
          data-testid="embed-open-full"
        >
          Open →
        </a>
      </div>

      {plants.length > 0 ? (
        <div className="grid grid-cols-3 gap-2.5 mt-4" data-testid="embed-plants">
          {plants.map((p) => (
            <div key={p.id} className="bg-surface border border-border overflow-hidden">
              <div className="aspect-square">
                <PlantImage plant={p} />
              </div>
              <p className="px-2 py-1.5 text-xs text-ink truncate font-serif">{p.name}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-moss">Just getting started — no plants yet.</p>
      )}

      {overflow > 0 && (
        <p className="mt-3 text-xs text-moss/80 text-center">
          +{overflow} more {overflow === 1 ? "plant" : "plants"} →
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-moss">
        <a
          href="/"
          target="_top"
          rel="noopener"
          className="hover:text-forest tracking-wider uppercase"
          data-testid="embed-attribution"
        >
          patchandpot.app
        </a>
        <a
          href={fullUrl}
          target="_top"
          rel="noopener"
          className="hover:text-forest tracking-wider uppercase"
        >
          See the full patch →
        </a>
      </div>
    </div>
  );
}
