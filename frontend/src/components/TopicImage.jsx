import { useEffect, useRef, useState } from "react";
import { Leaf, Loader2 } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const memCache = new Map();
const inflight = new Map();

/**
 * On-demand AI image for any topic (flowers, lessons, etc.).
 * Caches in-memory; backend additionally caches in MongoDB.
 * Lazy-loads via IntersectionObserver — image is only requested when the
 * element scrolls into the viewport.
 */
export default function TopicImage({ subject, cacheKey, style, eager = true, className = "", alt }) {
  const key = cacheKey || subject;
  const [src, setSrc] = useState(memCache.get(key) || null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const wrapperRef = useRef(null);

  // Watch viewport visibility (lazy load)
  useEffect(() => {
    if (src) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const el = wrapperRef.current;
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
  }, [src]);

  // Fetch image once visible (or if `eager` and visible)
  useEffect(() => {
    if (!eager || !inView || src) return;
    if (memCache.has(key)) { setSrc(memCache.get(key)); return; }

    let cancelled = false;
    setLoading(true);

    // De-duplicate concurrent requests for the same key
    let request = inflight.get(key);
    if (!request) {
      request = axios.post(`${API}/topic-image`, { subject, style, cache_key: cacheKey })
        .then((res) => res.data.image)
        .finally(() => inflight.delete(key));
      inflight.set(key, request);
    }

    request
      .then((image) => {
        if (cancelled) return;
        memCache.set(key, image);
        setSrc(image);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [eager, inView, key, subject, style, cacheKey, src]);

  return (
    <div ref={wrapperRef} className={`w-full h-full ${className}`}>
      {src ? (
        <img src={src} alt={alt || subject} className="object-cover w-full h-full" loading="lazy" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface text-moss">
          {loading ? (
            <>
              <Loader2 strokeWidth={1.2} className="w-7 h-7 animate-spin" />
              <span className="text-[11px] tracking-wider uppercase mt-3 px-3 text-center">Growing image…</span>
            </>
          ) : (
            <Leaf strokeWidth={1.2} className={`w-8 h-8 ${failed ? "opacity-30" : "opacity-50"}`} />
          )}
        </div>
      )}
    </div>
  );
}
