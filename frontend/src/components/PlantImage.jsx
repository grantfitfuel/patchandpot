import { useEffect, useRef, useState } from "react";
import { Leaf } from "lucide-react";
import { fetchPlantImage } from "@/lib/api";

const cache = new Map();
const inflight = new Map();

/**
 * Plant image with lazy loading via IntersectionObserver.
 * Generates via Nano Banana on first call; cached server-side in MongoDB.
 */
export default function PlantImage({ plant, className = "", eager = false }) {
  const [src, setSrc] = useState(cache.get(plant.id) || null);
  const [loading, setLoading] = useState(false);
  const [inView, setInView] = useState(eager);
  const ref = useRef(null);

  // Lazy-load on visibility
  useEffect(() => {
    if (src || eager) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src, eager]);

  // Auto-fetch when visible
  useEffect(() => {
    if (!inView || src) return;
    if (cache.has(plant.id)) { setSrc(cache.get(plant.id)); return; }
    let cancelled = false;
    setLoading(true);

    let req = inflight.get(plant.id);
    if (!req) {
      req = fetchPlantImage(plant).then((r) => r.image).finally(() => inflight.delete(plant.id));
      inflight.set(plant.id, req);
    }

    req
      .then((image) => {
        if (cancelled) return;
        cache.set(plant.id, image);
        setSrc(image);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [inView, plant, src]);

  return (
    <div ref={ref} className={`w-full h-full ${className}`} data-testid={`plant-image-wrap-${plant.id}`}>
      {src ? (
        <img
          src={src}
          alt={plant.name}
          data-testid={`plant-image-${plant.id}`}
          className="object-cover w-full h-full"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface text-moss">
          <Leaf strokeWidth={1.2} className={`w-8 h-8 ${loading ? "animate-pulse opacity-70" : "opacity-50"}`} />
          {loading && <span className="text-[11px] tracking-wider uppercase mt-3">Growing image…</span>}
        </div>
      )}
    </div>
  );
}
