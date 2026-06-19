import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchGeneratedMasterclass } from "@/lib/api";
import TopicImage from "@/components/TopicImage";

// Curated, staff-promoted AI-authored masterclasses surfaced as first-class
// panels above the user-generated suggestion form. The underlying content
// still lives in db.generated_masterclasses (so it's editable from Mongo
// without a frontend redeploy), but the UI presents them as authored deep
// dives — not "community topics".
export const FEATURED_DEEP_DIVE_SLUGS = [
  "soil-and-compost-building-the-bed-beneath-every-plant",
  "container-and-small-space-gardening-mastery",
  "pollinators-and-the-beneficial-garden",
  "harvesting-and-preserving-the-home-garden",
  "cut-flowers-from-tiny-spaces",
  "reading-the-sky-weather-frost-and-phenology-for-growers",
];

export default function DeepDiveSection() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      FEATURED_DEEP_DIVE_SLUGS.map((slug) =>
        fetchGeneratedMasterclass(slug, "en").catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      setItems(
        results
          .map((d, i) => (d ? { slug: FEATURED_DEEP_DIVE_SLUGS[i], data: d } : null))
          .filter(Boolean),
      );
    });
    return () => { cancelled = true; };
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mt-20" data-testid="section-deep-dives">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 border-b border-border pb-4">
        <div>
          <p className="overline">Deep dives</p>
          <h2 className="font-serif text-3xl md:text-4xl text-forest mt-2">Beyond the foundations</h2>
          <p className="text-ink/70 mt-2 max-w-xl">
            Six in-depth courses on the topics that quietly decide whether a
            garden thrives — soil, containers, pollinators, harvest, cut flowers,
            and reading the sky.
          </p>
        </div>
        <p className="text-sm text-moss">{items.length} courses</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {items.map(({ slug, data }) => (
          <Link
            key={slug}
            to={`/masterclasses/custom/${slug}`}
            data-testid={`deep-dive-${slug}`}
            className="group block bg-sand border border-border hover:border-terracotta transition-colors"
          >
            <div className="aspect-[4/3] overflow-hidden bg-surface">
              <TopicImage
                subject={data.imageSubject || data.topic || data.title}
                cacheKey={`deep-dive:${slug}`}
                alt={data.title}
                eager
                className="transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-5">
              <p className="text-[10px] tracking-[0.18em] uppercase text-moss">Deep dive · {data.lessons?.length || 5} lessons</p>
              <h3 className="font-serif text-xl text-forest mt-2 leading-tight group-hover:text-terracotta transition-colors">
                {data.title}
              </h3>
              {data.tagline && (
                <p className="text-sm text-ink/70 mt-2 line-clamp-3 leading-relaxed">{data.tagline}</p>
              )}
              <div className="mt-4 flex items-center gap-2 text-sm text-terracotta">
                <span>Start course</span>
                <ArrowRight strokeWidth={1.5} className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
