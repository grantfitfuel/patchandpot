import { useEffect, useRef, useState } from "react";
import { ChefHat } from "lucide-react";
import axios from "axios";
import { API } from "@/lib/api";

/**
 * Recipe image — lazy loaded, browser-cached across refreshes.
 *
 * Instead of POSTing for a base64 JSON blob on every mount (which the
 * browser can never HTTP-cache), we point `<img src>` straight at
 * `GET /api/recipes/{id}/image.jpg`. The server responds with raw JPEG
 * bytes and `Cache-Control: public, max-age=2592000, immutable`, so the
 * browser stores it natively and every refresh is 0 requests, 0 bytes,
 * 0 Gemini cost.
 *
 * If the GET returns 404 (image not yet generated), we make a one-shot
 * POST to warm the server cache, then swap the src to re-fetch. All
 * subsequent visitors of the same recipe hit the cached bytes.
 */
export default function RecipeImage({ recipe, className = "" }) {
  const baseUrl = `${API}/recipes/${recipe.id}/image.jpg`;
  const [src, setSrc] = useState(null);
  const [inView, setInView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [warming, setWarming] = useState(false);
  const [tried, setTried] = useState(false); // one-shot warm guard
  const ref = useRef(null);

  // Lazy-load via IntersectionObserver
  useEffect(() => {
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
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Kick off the actual image request once visible
  useEffect(() => {
    if (!inView) return;
    setSrc(baseUrl);
  }, [inView, baseUrl]);

  // If the <img> load fails, assume the cache is cold — POST to warm
  // then swap src with a cache-buster to re-request.
  const handleError = async () => {
    if (warming || tried) { setLoading(false); return; }
    setTried(true);
    setWarming(true);
    try {
      await axios.post(`${API}/recipes/${recipe.id}/image`, {
        id: recipe.id,
        title: recipe.title,
        ingredients: recipe.ingredients,
        method: recipe.method,
        plating: recipe.plating,
      }, { timeout: 90000 });
      // Re-fetch the (now cached) image bytes.
      setSrc(`${baseUrl}?v=${Date.now()}`);
    } catch (_e) {
      setLoading(false);
    } finally {
      setWarming(false);
    }
  };

  return (
    <div
      ref={ref}
      className={`w-full h-full relative ${className}`}
      data-testid={`recipe-image-wrap-${recipe.id}`}
    >
      {src && (
        <img
          src={src}
          alt={recipe.title}
          data-testid={`recipe-image-${recipe.id}`}
          className="object-cover w-full h-full"
          onLoad={() => setLoading(false)}
          onError={handleError}
        />
      )}
      {(!src || loading) && (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-surface text-moss">
          <ChefHat
            strokeWidth={1.2}
            className={`w-8 h-8 ${(loading || warming) ? "animate-pulse opacity-70" : "opacity-50"}`}
          />
          {(loading || warming) && (
            <span className="text-[11px] tracking-wider uppercase mt-3">
              {warming ? "Plating…" : "Loading…"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
