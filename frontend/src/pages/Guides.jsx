import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Sprout, LayoutGrid, Recycle, Flower2,
  HandHelping, FileDown,
} from "lucide-react";
import { useI18n } from "@/i18n";

// Resolve at module load so the PDF links go through our backend proxy.
const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

const GUIDES = {
  "first-pot": {
    label: "Begin today",
    title: "Your First Pot",
    icon: Sprout,
    intro: "Everything you need to begin growing today — pot, compost, seeds, light and water.",
    image:
      "https://images.unsplash.com/photo-1763741186493-509db18f6a6a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHw0fHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85",
    sections: [
      { type: "prose", title: "Pick the right pot",
        body: "Drainage matters more than looks. Choose a pot with holes at the base — terracotta breathes well; plastic stays moister. For most herbs and leafy greens a 20 cm-wide pot is enough; tomatoes, peppers and courgettes need 30–40 L of soil to be happy." },
      { type: "prose", title: "Choose a good compost",
        body: "Skip the cheap stuff — peat-free multipurpose compost is the sweet spot. For Mediterranean herbs (rosemary, thyme) mix in a third of horticultural grit to keep things sharp-draining." },
      { type: "prose", title: "Seeds or starter plants?",
        body: "Quick wins start as plug plants (basil, lettuce). Patience pays for tomatoes, chillies and herbs grown from seed — start indoors on a bright sill 6–8 weeks before your local last frost." },
      { type: "prose", title: "Light is the silent ingredient",
        body: "South-facing balconies (north-facing if you're in the southern hemisphere) get the longest sun. If you only have a few hours of direct light, lean towards leaves: lettuce, mint, parsley, chard." },
      { type: "prose", title: "Water with your finger",
        body: "Push a finger an inch into the soil. Dry? Water deeply until it runs out the bottom. Damp? Wait. Most beginner plant deaths are from over-watering, not under." },
    ],
  },

  "space-saving": {
    label: "Small spaces",
    title: "Space-Saving Ideas",
    icon: LayoutGrid,
    intro: "Vertical towers, hanging rails, and crate setups for tiny spaces.",
    image:
      "https://images.unsplash.com/photo-1765558290832-f50b7fab8f36?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwzfHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85",
    sections: [
      { type: "prose", title: "Grow up, not out",
        body: "Cucumbers, beans and even small squashes will happily climb a trellis or a strung line. A 30 cm pot at the base can yield a metre of growing space straight up." },
      { type: "prose", title: "Rail planters & hanging baskets",
        body: "Strawberries, trailing thyme and tumbling tomatoes thrive in baskets — they spill, they look beautiful, and they free up your floor." },
      { type: "prose", title: "Crates and recycled containers",
        body: "Wooden wine crates lined with hessian make perfect shallow herb gardens. Drill drainage holes in old buckets and tins — anything with depth and drainage can grow food." },
      { type: "prose", title: "Stacked towers",
        body: "DIY vertical towers using stacked pots or fabric pocket planters give you 6–10 plants in the footprint of one." },
    ],
  },

  regrow: {
    label: "Zero waste",
    title: "Regrow from Scraps",
    icon: Recycle,
    intro: "Save money and reduce waste by regrowing from kitchen scraps.",
    image:
      "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w8NjA1NzR8MHwxfHNlYXJjaHwxfHxwbGFudCUyMGxlYWYlMjBjbG9zZSUyMHVwJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODE0NjI5MzJ8MA&ixlib=rb-4.1.0&q=85",
    sections: [
      { type: "prose", title: "Spring onions in water",
        body: "Save the white root ends. Stand them in a glass of water on a bright sill, change the water every other day — new green shoots in 3–5 days, ready to snip in a week." },
      { type: "prose", title: "Lettuce, celery & bok choy bases",
        body: "Plant the core in shallow soil with the cut side up, just below the surface. Keep moist — new leaves emerge from the centre." },
      { type: "prose", title: "Garlic & ginger",
        body: "A sprouting clove pushed into soil pointy-side up will give you a green garlic shoot. Sprouted ginger rhizomes love warmth and humidity." },
      { type: "prose", title: "Herbs from cuttings",
        body: "Basil, mint and rosemary root readily in water. Snip a 10 cm stem, strip the lower leaves, pop it in water, transplant once roots are 3 cm long." },
    ],
  },

  "cut-flowers": {
    label: "Bring colour home",
    title: "Cut Flowers",
    icon: Flower2,
    intro:
      "Compact, container-friendly cut flower growing — soil mixes, sowing timings, bulb lasagnes, arranging tips and simple colour palettes.",
    image:
      "https://images.unsplash.com/photo-1745063537934-e6bf484d72eb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85",
    pdfs: [
      { label: "Cut Flower Journal (PDF)", href: `${API_BASE}/api/guide-pdf/cut-flower-journal` },
      { label: "Arranging & Colour Guide (PDF)", href: `${API_BASE}/api/guide-pdf/arranging-and-colour-guide` },
    ],
    sections: [
      { type: "prose", title: "Why grow cut flowers?",
        body: "Flowers brighten rooms, mark the seasons, and offer mindful, steady routines — sow, water, pick, arrange. They also feed bees and hoverflies, making edible crops nearby more productive." },
      { type: "tags", items: ["Low-cost joy", "Pollinator-friendly", "Mindful routine", "Any space works"] },

      { type: "prose", title: "Grow anywhere: containers beyond pots",
        body: "Improvised and upcycled containers work beautifully — sturdy tins and food buckets with 4–6 drainage holes, wooden fruit crates lined with hessian, colanders and old drawers, even guttering runs on fences for trailing violas and alyssum. Stability first: use wide bases and ties for balconies and rails, and add bricks in the bottom for wind safety." },

      { type: "table", title: "Container sizes that work",
        headers: ["Container", "Best for", "Count"],
        rows: [
          ["Window box 3–5 L", "Calendula, cornflower, nigella", "3–5"],
          ["10 L bucket", "Snapdragon dwarf, scabious", "3"],
          ["20 L tub", "Cosmos tall, rudbeckia", "3"],
          ["40 L tub", "Single dahlia or tall sunflower (stake)", "1–2"],
          ["80–100 cm trough", "Mixed annuals + mesh support", "8–12"],
        ],
      },

      { type: "prose", title: "Soil mix & feeding",
        body: "A reliable container mix: 60% peat-free compost, 30% fine bark or composted wood fibre, 10% perlite or grit for drainage, plus slow-release fertiliser (10–12 weeks). Feeding rhythm: water only for the first 4 weeks, then weekly liquid feed at half strength. Heavy feeders like dahlia and zinnia want twice-weekly feeds in hot spells. Top-dress mid-season with 1–2 cm of fresh compost." },

      { type: "list", title: "What to grow — compact, pot-friendly",
        items: [
          "Hardy annuals (cool-tolerant): calendula, cornflower, nigella, ammi, scabious, dill, larkspur. Autumn sow in mild regions; spring sow elsewhere.",
          "Half-hardy: cosmos, snapdragon, rudbeckia, zinnia (warm), celosia (very warm), dwarf sunflowers. Plant out when nights stay above 8–10°C.",
          "Perennial & biennial stars: salvias (nemorosa, microphylla), wallflowers, lavender, sweet William, compact foxglove. Salvias bring long bloom and pollinators; wallflowers bring spring scent.",
        ],
      },

      { type: "list", title: "Bulbs, corms & tubers",
        items: [
          "Spring: tulips (plant November for tall stems), narcissus, alliums.",
          "Summer: lilies (stake), gladioli (stagger plantings every 2 weeks), dahlias (1 per 40 L tub).",
          "Drainage: pot feet and deep soaks — never let them sit in water.",
        ],
      },

      { type: "steps", title: "Bulb lasagne — one pot, months of colour",
        items: [
          "Choose a 30–40 cm deep pot with large drainage holes.",
          "Base layer: 10–12 cm compost, then your largest bulbs (tulips), points up.",
          "Middle layer: 5–7 cm compost, mid bulbs (narcissus).",
          "Top layer: 5–7 cm compost, small bulbs (crocus, muscari).",
          "Finish with 5–7 cm compost, water in, and add winter violas on top if you like.",
        ],
        footer: "Stagger bloom times: early crocus → mid narcissus → late tulip for a rolling show.",
      },

      { type: "list", title: "All-year colour",
        items: [
          "Spring: tulips, narcissus, wallflowers, early alliums.",
          "Summer: sweet peas, cosmos, cornflower, calendula, salvias.",
          "Autumn: dahlias, rudbeckia, late salvias, chrysanthemums.",
          "Winter: berried stems, evergreen foliage, hellebores in pots.",
        ],
      },

      { type: "palettes", title: "Simple colour palettes",
        items: [
          { name: "Pastel Meadow", swatches: ["#F5C6C6", "#F4D9A6", "#E5E7CD", "#C9D6E2"],
            notes: "Sweet peas (pinks), cosmos 'Apricot Lemonade', nigella, scabiosa." },
          { name: "Hot & Happy", swatches: ["#E0492C", "#E89712", "#C9303E", "#8E2D2D"],
            notes: "Zinnia mix, rudbeckia, calendula 'Indian Prince', salvia 'Hot Lips'." },
          { name: "Cool Calm", swatches: ["#4F6FA8", "#EFEFEA", "#7AA37E", "#6A6BA0"],
            notes: "Cornflower, ammi, white cosmos, lavender, salvia nemorosa." },
        ],
        footer: "Pick one base + one accent + one highlight and repeat across containers for cohesion.",
      },

      { type: "list", title: "Arranging — from mini to statement",
        items: [
          "Mini jars & posies: sweet peas, violas, small cosmos, herbs. Cut in the cool; strip leaves below the water line.",
          "Kitchen jug: cosmos, salvias, calendula, wallflowers, ammi. One 'air' element (ammi, grasses) keeps it light.",
          "Statement vase: dahlias, gladioli, lilies. Add foliage structure first. Odd numbers (3, 5, 7) of focal stems work well.",
          "Conditioning: re-cut stems under water, rest 2–4 hours cool. A pinch of sugar + citric acid + tiny bleach makes a passable preservative.",
        ],
      },

      { type: "table", title: "Sowing & planting calendar",
        note: "Shift timings 2–3 weeks later in colder/windy regions, or 2–3 weeks earlier in mild conditions or under cover.",
        headers: ["Plant", "Sow indoors", "Sow direct", "Plant out", "Bulb / tuber", "Notes"],
        rows: [
          ["Calendula", "Feb–Apr", "Mar–Jun; Sep*", "Apr–Jun", "—", "*Autumn sow only in mild areas."],
          ["Cornflower", "Feb–Apr", "Mar–May; Sep", "Apr–May", "—", "Full sun; good drainage."],
          ["Nigella", "Feb–Apr", "Mar–May; Aug–Sep", "Apr–May", "—", "Hates root disturbance — sow in final pot."],
          ["Ammi majus", "Feb–Apr", "Mar–May; Sep", "Apr–May", "—", "Stake early; cool-tolerant."],
          ["Scabiosa", "Feb–Apr", "Apr–May", "May–Jun", "—", "Guard against slugs."],
          ["Cosmos", "Mar–Apr", "May–Jun*", "Late May–Jun", "—", "Pinch at 15 cm for bushier plants."],
          ["Zinnia", "Apr", "Late May–Jun (warm)", "Late May–Jun", "—", "Heat lovers; nights > 10°C."],
          ["Snapdragon", "Jan–Mar", "Apr–May (south)", "May–Jun", "—", "Cool-tolerant blooms."],
          ["Sunflower (dwarf)", "Mar–Apr", "Apr–May", "May–Jun", "—", "Stake from planting; 1 per 20 L+ tub."],
          ["Wallflower", "Jun–Jul", "Jun–Jul", "Sep–Oct", "—", "Scented spring."],
          ["Sweet William", "Jun–Jul", "Jun–Jul", "Sep–Oct", "—", "Great for spring cutting."],
          ["Salvia nemorosa", "Feb–Apr", "—", "May–Jun", "—", "Trim after each flush; bee magnet."],
          ["Lavender", "Feb–Mar", "—", "Apr–May", "—", "Gritty mix; full sun."],
          ["Tulips", "—", "—", "—", "Oct–Dec", "Plant 2–3× bulb depth; 20 cm+ pot."],
          ["Narcissus", "—", "—", "—", "Sep–Nov", "Compact types excel in pots."],
          ["Allium", "—", "—", "—", "Sep–Oct", "Deep pots; underplant with violas."],
          ["Lilies", "—", "—", "—", "Feb–Apr", "Stake early; free-draining."],
          ["Gladioli", "—", "—", "—", "Apr–Jun (stagger)", "Plant in 2-week waves."],
          ["Dahlias", "Feb–Apr", "—", "May–Jun", "Apr–May", "1 per 40 L; lift in cold regions."],
        ],
      },

      { type: "prose", title: "Shortcut",
        body: "When in doubt, sow later. A strong May planting often beats a weak early start." },
    ],
  },

  companion: {
    label: "Plants helping plants",
    title: "Companion Planting",
    icon: HandHelping,
    intro:
      "Match water and light needs, invite pollinators, and steer pests away with clever pairings — perfect for pots and small spaces.",
    image:
      "https://images.unsplash.com/photo-1566249099725-1b0ce8da8c32?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwyfHxwbGFudCUyMGxlYWYlMjBjbG9zZSUyMHVwJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODE0NjI5MzJ8MA&ixlib=rb-4.1.0&q=85",
    sections: [
      { type: "list", title: "Great combos",
        items: [
          "Tomato + Basil — flavour and shared care.",
          "Chilli + Marigold (tagetes) — pulls pollinators and confuses pests.",
          "Kale + Chives — where aphids lurk.",
          "Carrot + Spring onion — muddle carrot fly with onion scent.",
          "Strawberry + Thyme — bee traffic and dry-loving partners.",
          "French beans + Nasturtiums — lure aphids away and give edible flowers.",
        ],
      },
      { type: "list", title: "Things to avoid",
        items: [
          "Overcrowding — blocks airflow and invites mildew.",
          "Mismatched thirst — rosemary with basil rarely ends well.",
          "Deep roots with shallow in tiny pots — they compete hard.",
          "Tomatoes with potatoes in containers — disease crossover and space clash.",
        ],
      },
      { type: "prose", title: "Pollinator boost",
        body: "Add edible flowers — nasturtiums, calendula, violas. Let a few herbs bloom (basil, chives, oregano, thyme). Keep sprays away: try hand removal, water blasts and sticky cards first." },

      { type: "table", title: "Container pairings by pot size",
        headers: ["Pot", "Plant together", "Why it works", "Skip"],
        rows: [
          ["Window box 5–7 L", "Parsley + Chives + Viola", "Shallow, frequent snips; bee-friendly faces.", "Tomato — too thirsty/top heavy."],
          ["10–12 L", "Chilli + Basil OR Salad + Radish", "Warmth lovers that share watering rhythm.", "Mint — spreads aggressively."],
          ["20 L", "Tomato (bush) + Basil + Marigold", "Classic trio; flowers bring pollinators.", "Potato — blight risk."],
          ["40 L tub", "Courgette + Nasturtiums (edge)", "Nasturtiums trail, draw aphids, and you can eat the flowers.", "A second courgette."],
        ],
      },

      { type: "list", title: "Mini 'guilds' by goal",
        items: [
          "Pest deterrence: Brassicas + chives/garlic chives; Beans + nasturtiums; Lettuce + dill (hoverflies).",
          "Flavour & yield: Tomato + basil; Strawberry + thyme; Cucumber + dill.",
          "Shade & living mulch: Chilli + oregano (drapes and cools); Courgette + low nasturtiums.",
          "Nutrient helpers: Peas/beans followed by leafy greens in the same tub after top-up.",
        ],
      },
      { type: "prose", title: "Rotation & hygiene in pots",
        body: "Don't grow tomatoes in the same tub two years running — follow with salads or flowers and refresh a third of the mix. Lift tired roots after harvest, top up with fresh compost and a small handful of slow-release feed. Wipe stakes and clips before re-using, especially after blight or mildew." },

      { type: "prose", title: "Rule of thumb",
        body: "If two plants enjoy the same sun and watering routine, they're good candidates to share a pot. Healthy space beats the 'right' combo squashed in." },
    ],
  },
};

const ORDER = ["first-pot", "space-saving", "regrow", "cut-flowers", "companion"];

// Map guide slugs to their matching home.feature.* i18n key prefix.
const GUIDE_I18N_KEY = {
  "first-pot": "first_pot",
  "space-saving": "space_saving",
  "regrow": "regrow",
  "cut-flowers": "cut_flowers",
  "companion": "companion",
};

export default function GuidesPage() {
  const { slug } = useParams();
  const { t } = useI18n();

  if (!slug) {
    return (
      <div className="container-narrow py-12 md:py-16 animate-fade-up">
        <p className="overline">{t("guides.eyebrow")}</p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
          {t("guides.title")}
        </h1>
        <p className="mt-3 text-ink/75 max-w-2xl">
          {t("guides.intro")}
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {ORDER.map((id) => {
            const g = GUIDES[id];
            const Icon = g.icon;
            const i18nId = GUIDE_I18N_KEY[id];
            const cardLabel = i18nId ? t(`home.feature.${i18nId}.label`) : g.label;
            const cardTitle = i18nId ? t(`home.feature.${i18nId}.title`) : g.title;
            const cardBlurb = i18nId ? t(`home.feature.${i18nId}.blurb`) : g.intro;
            return (
              <Link
                key={id}
                to={`/guides/${id}`}
                data-testid={`guide-card-${id}`}
                className="card-flat overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={g.image} alt={cardTitle} className="object-cover w-full h-full" />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3">
                    <Icon strokeWidth={1.5} className="w-4 h-4 text-terracotta" />
                    <span className="overline">{cardLabel}</span>
                  </div>
                  <h3 className="font-serif text-3xl text-forest mt-3">{cardTitle}</h3>
                  <p className="text-sm text-ink/70 mt-3 flex-1">{cardBlurb}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-forest text-sm tracking-wider uppercase">
                    {t("home.feature.open_guide")} <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const guide = GUIDES[slug];
  if (!guide) {
    return <div className="container-narrow py-16 text-terracotta">{t("guides.not_found")}</div>;
  }
  const Icon = guide.icon;
  const i18nId = GUIDE_I18N_KEY[slug];
  const headerLabel = i18nId ? t(`home.feature.${i18nId}.label`) : guide.label;
  const headerTitle = i18nId ? t(`home.feature.${i18nId}.title`) : guide.title;
  const headerIntro = i18nId ? t(`home.feature.${i18nId}.blurb`) : guide.intro;

  return (
    <article className="container-narrow py-12 md:py-16 animate-fade-up max-w-4xl">
      <Link to="/guides" data-testid="back-to-guides" className="inline-flex items-center gap-2 text-moss hover:text-forest mb-8">
        <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> {t("guides.all_guides")}
      </Link>

      <div className="flex items-center gap-3">
        <Icon strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{headerLabel}</span>
      </div>
      <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">{headerTitle}</h1>
      {headerIntro && (
        <p className="mt-5 text-lg text-ink/80 max-w-2xl leading-relaxed">{headerIntro}</p>
      )}

      <div className="aspect-[16/9] overflow-hidden border border-border my-10">
        <img src={guide.image} alt={headerTitle} className="object-cover w-full h-full" />
      </div>

      {guide.pdfs && guide.pdfs.length > 0 && (
        <div className="border border-border bg-surface p-5 mb-10 flex flex-wrap gap-3">
          <p className="overline w-full">{t("guides.downloads")}</p>
          {guide.pdfs.map((p) => (
            <a
              key={p.href}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              download
              data-testid={`pdf-${p.href.split("/").pop()}`}
              className="inline-flex items-center gap-2 btn-forest"
            >
              <FileDown strokeWidth={1.5} className="w-4 h-4" /> {p.label}
            </a>
          ))}
        </div>
      )}

      <div className="space-y-10">
        {guide.sections.map((s, i) => (
          <SectionBlock key={`${s.type}-${s.title || i}`} section={s} />
        ))}
      </div>
    </article>
  );
}

function SectionBlock({ section }) {
  if (section.type === "tags") {
    return (
      <div className="flex flex-wrap gap-2">
        {section.items.map((t) => (
          <span key={t} className="text-xs px-3 py-1.5 border border-border bg-surface text-moss tracking-wider uppercase">
            {t}
          </span>
        ))}
      </div>
    );
  }

  if (section.type === "table") {
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-3">{section.title}</h2>}
        {section.note && <p className="text-sm text-moss mb-4 italic">{section.note}</p>}
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                {section.headers.map((h) => (
                  <th key={h} className="text-left font-medium text-forest px-4 py-3 border-b border-border tracking-wider uppercase text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, idx) => (
                <tr key={`row-${row[0] || idx}`} className="border-b border-border last:border-b-0">
                  {row.map((cell, ci) => (
                    <td key={`cell-${ci}`} className={`px-4 py-3 ${ci === 0 ? "font-medium text-ink" : "text-ink/80"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (section.type === "list") {
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-4">{section.title}</h2>}
        <ul className="space-y-3">
          {section.items.map((it) => (
            <li key={it} className="flex gap-3 text-ink/80 leading-relaxed">
              <span className="text-terracotta mt-1.5 w-1 h-1 bg-terracotta rounded-full flex-shrink-0" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (section.type === "steps") {
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-4">{section.title}</h2>}
        <ol className="space-y-4">
          {section.items.map((it, i) => (
            <li key={it} className="flex gap-4 leading-relaxed">
              <span className="font-serif text-2xl text-terracotta flex-shrink-0 w-8">{i + 1}</span>
              <span className="text-ink/80 pt-1">{it}</span>
            </li>
          ))}
        </ol>
        {section.footer && <p className="text-sm text-moss mt-5 italic">{section.footer}</p>}
      </section>
    );
  }

  if (section.type === "palettes") {
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-5">{section.title}</h2>}
        <div className="grid sm:grid-cols-3 gap-5">
          {section.items.map((p) => (
            <div key={p.name} className="card-flat p-5">
              <h3 className="font-serif text-2xl text-forest">{p.name}</h3>
              <div className="flex gap-1.5 mt-4 mb-4">
                {p.swatches.map((c) => (
                  <span key={c} className="w-8 h-12 border border-border" style={{ backgroundColor: c }} />
                ))}
              </div>
              <p className="text-sm text-ink/75 leading-relaxed">{p.notes}</p>
            </div>
          ))}
        </div>
        {section.footer && <p className="text-sm text-moss mt-5 italic">{section.footer}</p>}
      </section>
    );
  }

  // prose (default)
  return (
    <section>
      {section.title && <h2 className="font-serif text-3xl text-forest mb-3">{section.title}</h2>}
      <p className="text-ink/80 leading-relaxed text-lg">{section.body}</p>
    </section>
  );
}
