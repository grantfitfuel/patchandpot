import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";

const shareCache = new Map();

/**
 * Modal that:
 * 1. Fetches a Nano Banana "bloom backdrop" via /api/share-image for the masterclass.
 * 2. Composes title + region + Patch&Pot mark on a 1080×1080 canvas client-side.
 * 3. Lets the user download the PNG.
 */
export default function ShareCard({ open, onClose, masterclassSlug, masterclassTitle, regionName }) {
  const canvasRef = useRef(null);
  const [bgSrc, setBgSrc] = useState(() => shareCache.get(masterclassSlug) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [composed, setComposed] = useState(false);

  // Fetch backdrop
  useEffect(() => {
    if (!open || !masterclassSlug) return;
    if (shareCache.has(masterclassSlug)) {
      setBgSrc(shareCache.get(masterclassSlug));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .post("/share-image", {
        masterclass_slug: masterclassSlug,
        masterclass_title: masterclassTitle,
        region_name: regionName || null,
      })
      .then((res) => {
        if (cancelled) return;
        shareCache.set(masterclassSlug, res.data.image);
        setBgSrc(res.data.image);
      })
      .catch(() => !cancelled && setError("Could not generate share image."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [open, masterclassSlug, masterclassTitle, regionName]);

  // Compose the canvas once we have the backdrop
  useEffect(() => {
    if (!bgSrc || !canvasRef.current || !open) return;
    setComposed(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const size = 1080;
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // 1. Draw background image (cover)
      const ratio = Math.max(size / img.width, size / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

      // 2. Soft cream gradient on lower third for text legibility
      const grad = ctx.createLinearGradient(0, size * 0.45, 0, size);
      grad.addColorStop(0, "rgba(247, 245, 240, 0)");
      grad.addColorStop(0.55, "rgba(247, 245, 240, 0.85)");
      grad.addColorStop(1, "rgba(247, 245, 240, 0.98)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, size * 0.45, size, size * 0.55);

      // 3. Top eyebrow
      ctx.fillStyle = "#5C6B52";
      ctx.font = "500 22px 'Outfit', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("PATCH & POT  ·  MASTERCLASS", 72, 80);

      // 4. Big serif title
      ctx.fillStyle = "#2D4A22";
      ctx.font = "italic 96px 'Cormorant Garamond', Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText(masterclassTitle, 72, size - 220);

      // 5. Completion line
      ctx.fillStyle = "#C65D47";
      ctx.font = "500 32px 'Outfit', system-ui, sans-serif";
      ctx.fillText("Masterclass complete.", 72, size - 150);

      // 6. Region line
      if (regionName) {
        ctx.fillStyle = "#1C231A";
        ctx.font = "400 28px 'Outfit', system-ui, sans-serif";
        ctx.fillText(`Growing in ${regionName}`, 72, size - 100);
      }

      // 7. Date stamp
      const d = new Date();
      const stamp = d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
      ctx.fillStyle = "#5C6B52";
      ctx.font = "400 22px 'Outfit', system-ui, sans-serif";
      ctx.fillText(stamp, 72, size - 60);

      setComposed(true);
    };
    img.src = bgSrc;
  }, [bgSrc, open, masterclassTitle, regionName]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `patchpot-${masterclassSlug}-complete.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (!open) return null;

  return (
    <div
      data-testid="share-card-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10 bg-ink/40 backdrop-blur-sm animate-fade-up"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-sand w-full max-w-2xl border border-border shadow-xl max-h-[95vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="overline">A small moment</p>
            <h2 className="font-serif text-2xl text-forest mt-1">Share your finish</h2>
          </div>
          <button onClick={onClose} aria-label="Close" data-testid="share-card-close" className="text-moss hover:text-forest">
            <X strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="aspect-square bg-surface border border-border overflow-hidden flex items-center justify-center">
            {loading && (
              <div className="flex flex-col items-center gap-3 text-moss">
                <Loader2 strokeWidth={1.2} className="w-7 h-7 animate-spin" />
                <span className="text-xs tracking-wider uppercase">Growing your card…</span>
              </div>
            )}
            {error && <p className="text-terracotta">{error}</p>}
            <canvas
              ref={canvasRef}
              data-testid="share-card-canvas"
              className={`w-full h-full object-cover ${composed ? "block" : "hidden"}`}
            />
          </div>

          <p className="text-sm text-moss mt-5 leading-relaxed">
            A square PNG (1080 × 1080) — perfect for Instagram. Download below, or screenshot and send to a friend.
          </p>

          <button
            type="button"
            onClick={download}
            disabled={!composed}
            data-testid="share-card-download"
            className="mt-5 w-full btn-terracotta inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download strokeWidth={1.5} className="w-4 h-4" /> Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
