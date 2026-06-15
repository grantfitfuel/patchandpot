import { useEffect, useState } from "react";
import { Leaf, Loader2 } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const memCache = new Map();

/**
 * On-demand AI image for any topic (flowers, lessons, etc.).
 * Caches in-memory; backend additionally caches in MongoDB.
 *
 * Props:
 *   subject      e.g. "Rose flower bloom"
 *   cacheKey     stable identifier for cache (subject if omitted)
 *   style        optional style hint forwarded to backend
 *   eager        if true, fetches on mount; otherwise renders a placeholder
 *   className    passed to <img>
 *   alt          accessibility label
 */
export default function TopicImage({ subject, cacheKey, style, eager = true, className = "", alt }) {
  const key = cacheKey || subject;
  const [src, setSrc] = useState(memCache.get(key) || null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!eager) return;
    if (memCache.has(key)) { setSrc(memCache.get(key)); return; }
    let cancelled = false;
    setLoading(true);
    axios
      .post(`${API}/topic-image`, { subject, style, cache_key: cacheKey })
      .then((res) => {
        if (cancelled) return;
        memCache.set(key, res.data.image);
        setSrc(res.data.image);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [eager, key, subject, style, cacheKey]);

  if (src) {
    return <img src={src} alt={alt || subject} className={`object-cover w-full h-full ${className}`} />;
  }
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-surface text-moss ${className}`}>
      {loading ? (
        <>
          <Loader2 strokeWidth={1.2} className="w-7 h-7 animate-spin" />
          <span className="text-[11px] tracking-wider uppercase mt-3 px-3 text-center">Growing image…</span>
        </>
      ) : failed ? (
        <Leaf strokeWidth={1.2} className="w-8 h-8 opacity-40" />
      ) : (
        <Leaf strokeWidth={1.2} className="w-8 h-8 opacity-60" />
      )}
    </div>
  );
}
