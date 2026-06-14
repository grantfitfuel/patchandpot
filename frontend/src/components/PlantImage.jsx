import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { fetchPlantImage } from "@/lib/api";

const cache = new Map(); // in-memory per session cache

export default function PlantImage({ plant, className = "", eager = false }) {
  const [src, setSrc] = useState(cache.get(plant.id) || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(plant.id)) {
      setSrc(cache.get(plant.id));
      return;
    }
    if (!eager) return; // lazy mode: caller decides when to load
    setLoading(true);
    fetchPlantImage(plant)
      .then((res) => {
        if (cancelled) return;
        cache.set(plant.id, res.image);
        setSrc(res.image);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [plant, eager]);

  const triggerLoad = () => {
    if (src || loading) return;
    setLoading(true);
    fetchPlantImage(plant)
      .then((res) => {
        cache.set(plant.id, res.image);
        setSrc(res.image);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  if (src) {
    return (
      <img
        src={src}
        alt={plant.name}
        data-testid={`plant-image-${plant.id}`}
        className={`object-cover w-full h-full ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={triggerLoad}
      data-testid={`plant-image-generate-${plant.id}`}
      disabled={loading}
      className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-surface text-moss hover:bg-forest/5 transition-colors ${className}`}
    >
      <Leaf strokeWidth={1.2} className={`w-8 h-8 ${loading ? "animate-pulse" : ""}`} />
      <span className="text-xs tracking-wider uppercase">{loading ? "Growing image…" : "Generate image"}</span>
    </button>
  );
}
