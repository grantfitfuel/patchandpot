import { useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { fetchPestImage } from "@/lib/api";
import { useI18n } from "@/i18n";

const cache = new Map();

export default function PestImage({ name, testId }) {
  const { t } = useI18n();
  const [src, setSrc] = useState(cache.get(name) || null);
  const [loading, setLoading] = useState(false);

  const trigger = async () => {
    if (src || loading) return;
    setLoading(true);
    try {
      const res = await fetchPestImage(name);
      cache.set(name, res.image);
      setSrc(res.image);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
    }
  };

  if (src) {
    return (
      <div className="mt-3 aspect-[4/3] overflow-hidden border border-border max-w-sm" data-testid={testId || `pest-image-${name}`}>
        <img src={src} alt={name} className="object-cover w-full h-full" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={trigger}
      disabled={loading}
      data-testid={`pest-image-trigger-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      className="mt-3 inline-flex items-center gap-2 text-xs text-moss hover:text-forest border border-border px-3 py-2 bg-surface"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />}
      {loading ? t("guidance.loading").split(" ")[0] : t("guidance.show_reference")}
    </button>
  );
}
