import { useEffect, useRef, useState } from "react";
import { ChefHat } from "lucide-react";
import { fetchRecipeImage } from "@/lib/api";

const cache = new Map();
const inflight = new Map();

/**
 * Recipe image with lazy loading via IntersectionObserver.
 * Generates via Nano Banana on first call; cached server-side in MongoDB
 * under the key `recipe-image:<id>` (see /app/backend/routers/recipes.py).
 *
 * The generation prompt is built server-side from the recipe title + a
 * shortlist of the first ingredients, so image quality is stable
 * regardless of what the client sends.
 */
export default function RecipeImage({ recipe, className = "" }) {
  const [src, setSrc] = useState(cache.get(recipe.id) || null);
  const [loading, setLoading] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  // Lazy-load on visibility
  useEffect(() => {
    if (src) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);

  // Auto-fetch when visible
  useEffect(() => {
    if (!inView || src) return;
    if (cache.has(recipe.id)) {
      setSrc(cache.get(recipe.id));
      return;
    }
    let cancelled = false;
    setLoading(true);

    let req = inflight.get(recipe.id);
    if (!req) {
      req = fetchRecipeImage(recipe)
        .then((r) => r.image)
        .finally(() => inflight.delete(recipe.id));
      inflight.set(recipe.id, req);
    }

    req
      .then((image) => {
        if (cancelled) return;
        cache.set(recipe.id, image);
        setSrc(image);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [inView, recipe, src]);

  return (
    <div
      ref={ref}
      className={`w-full h-full ${className}`}
      data-testid={`recipe-image-wrap-${recipe.id}`}
    >
      {src ? (
        <img
          src={src}
          alt={recipe.title}
          data-testid={`recipe-image-${recipe.id}`}
          className="object-cover w-full h-full"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface text-moss">
          <ChefHat
            strokeWidth={1.2}
            className={`w-8 h-8 ${loading ? "animate-pulse opacity-70" : "opacity-50"}`}
          />
          {loading && (
            <span className="text-[11px] tracking-wider uppercase mt-3">
              Plating…
            </span>
          )}
        </div>
      )}
    </div>
  );
}
