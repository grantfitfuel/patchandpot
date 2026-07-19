/**
 * Recipes — a small curated set of dishes that lean on what you can
 * actually harvest from a windowsill or a patch. Not restaurant food:
 * one pan, minimal shopping, herbs you grew yourself.
 *
 * Each recipe carries:
 *   • id / title
 *   • time (e.g. "20 mins + cooling")
 *   • serves (string — "2", "3–4", "makes 8")
 *   • kcal (rough)
 *   • macros (nullable — "P 4 g · C 14 g · F 16 g")
 *   • diet   (subset of ["V","VG","GF","DF"] where V = vegetarian and
 *             VG = vegan; some rows carry "can-be" flags like "can-gf")
 *   • ingredients []
 *   • method []  (numbered steps)
 *   • uses    — plant ids from the library this recipe leans on;
 *               drives cross-links from the plant page to the recipe.
 *
 * Diet tags are labelled from i18n keys `recipe.diet.{tag}`. Keep the
 * list conservative — do NOT tag GF unless the ingredients are
 * genuinely gluten-free (flour → not GF unless swapped).
 */

export const SECTIONS = [
  { id: "salads",  labelKey: "recipe.section.salads" },
  { id: "mains",   labelKey: "recipe.section.mains" },
  { id: "sides",   labelKey: "recipe.section.sides" },
  { id: "sweet",   labelKey: "recipe.section.sweet" },
];

export const RECIPES = [
  // ── Quick Salads ─────────────────────────────────────────────
  {
    id: "golden-beet-orange-basil",
    section: "salads",
    title: "Golden Beet, Orange & Basil Salad",
    time: "20 mins + cooling",
    serves: "2",
    kcal: 220,
    macros: "P 4 g · C 14 g · F 16 g",
    diet: ["V", "VG", "GF", "DF"],
    uses: ["beetroot", "basil"],
    ingredients: [
      "2 small golden beetroots",
      "1 orange (juice + optional zest)",
      "2 tbsp olive oil",
      "8–10 basil leaves, torn",
      "Sea salt & black pepper",
      "Pinch of ground cinnamon",
    ],
    plating: "both the golden beetroots AND the orange sliced paper-thin into perfect rounds with a mandolin or sharp knife, arranged in overlapping alternating circles on the plate, with torn basil scattered on top",
    method: [
      "Cook the beetroots until tender, cool and peel.",
      "Slice both the beetroots and the peeled orange paper-thin into rounds using a sharp knife or mandolin.",
      "Arrange the beetroot and orange rounds in overlapping circles on the plate.",
      "Whisk any leftover orange juice with the olive oil and drizzle over.",
      "Scatter with torn basil, cinnamon, salt and pepper to serve.",
    ],
  },
  {
    id: "kale-ribbon-chilli-oil",
    section: "salads",
    title: "Kale Ribbon Salad with Chilli Oil",
    time: "8 mins",
    serves: "2",
    kcal: 180,
    macros: "P 6 g · C 10 g · F 12 g",
    diet: ["V", "VG", "GF", "DF"],
    uses: ["kale", "chilli"],
    ingredients: [
      "3 cups kale, stripped and shredded thin",
      "1 tbsp olive oil",
      "Juice of half a lemon",
      "1 tsp chilli oil, plus extra to serve",
      "1 tsp toasted sesame seeds",
    ],
    method: [
      "Massage the kale with the olive oil and lemon juice for 1–2 minutes until it darkens and softens.",
      "Drizzle with chilli oil, top with sesame seeds and eat straight away.",
    ],
  },

  // ── Simple Mains ─────────────────────────────────────────────
  {
    id: "courgette-herb-fritters",
    section: "mains",
    title: "Courgette & Herb Fritters",
    time: "20 mins",
    serves: "2",
    kcal: 320,
    macros: "P 11 g · C 18 g · F 22 g",
    diet: ["V", "DF", "can-gf"],
    uses: ["courgette", "parsley", "chives", "mint"],
    ingredients: [
      "2 small courgettes, coarsely grated",
      "1 egg, beaten",
      "3 tbsp plain flour (or gluten-free flour)",
      "2 tbsp mixed soft herbs, chopped",
      "Sea salt & black pepper",
      "Oil for shallow frying",
    ],
    method: [
      "Salt the grated courgette and leave for 10 minutes, then squeeze out as much liquid as you can.",
      "Mix with the egg, flour, herbs and seasoning to a rough batter.",
      "Fry heaped spoonfuls in a little oil, 2–3 mins each side, until deep golden.",
    ],
  },
  {
    id: "beetroot-lentil-bake",
    section: "mains",
    title: "Beetroot & Lentil Bake",
    time: "35 mins",
    serves: "3–4",
    kcal: 280,
    macros: "P 12 g · C 32 g · F 8 g",
    diet: ["V", "VG", "GF", "DF"],
    uses: ["beetroot", "garlic", "thyme"],
    ingredients: [
      "2–3 beetroots, diced small",
      "1 cup cooked green lentils",
      "1 onion, chopped",
      "2 cloves garlic, sliced",
      "300 ml vegetable stock (or 200 ml stock + 100 ml chopped tomatoes)",
      "1 tsp thyme leaves",
      "Salt, pepper, olive oil",
    ],
    method: [
      "Sweat the onion and garlic in olive oil until soft.",
      "Add the diced beetroot, lentils, stock, thyme and seasoning.",
      "Cover and bake at 190 °C for 25–30 mins, until the beetroot is tender.",
    ],
  },
  {
    id: "stuffed-peppers-rice-herbs",
    section: "mains",
    title: "Stuffed Peppers with Rice & Herbs",
    time: "25 mins",
    serves: "2",
    kcal: 300,
    macros: "P 9 g · C 50 g · F 8 g",
    diet: ["V", "VG", "DF", "GF"],
    uses: ["pepper", "parsley", "basil", "garlic"],
    ingredients: [
      "2 sweet peppers",
      "1 cup cooked rice",
      "2 tbsp mixed soft herbs, chopped",
      "1 clove garlic, minced",
      "1 tbsp olive oil",
      "Salt, black pepper",
    ],
    method: [
      "Halve the peppers lengthwise and scoop out the seeds.",
      "Mix the rice with the herbs, garlic, olive oil and seasoning.",
      "Fill the peppers, drizzle with a little more oil and bake at 200 °C for 20–25 mins.",
    ],
  },

  // ── Soups & Sides ────────────────────────────────────────────
  {
    id: "roasted-root-tray",
    section: "sides",
    title: "Roasted Root Tray",
    time: "35 mins",
    serves: "4",
    kcal: 180,
    macros: "P 3 g · C 28 g · F 6 g",
    diet: ["V", "VG", "GF", "DF"],
    uses: ["beetroot", "carrot", "parsnip", "thyme", "rosemary"],
    ingredients: [
      "2 beetroots, cut in wedges",
      "3 carrots, cut in batons",
      "2 parsnips, cut in batons",
      "3 tbsp olive oil",
      "1 tbsp thyme or rosemary leaves",
      "Sea salt, black pepper",
    ],
    method: [
      "Toss everything on a tray with the oil, herbs and salt.",
      "Roast at 200 °C for 30–35 mins, turning once, until the edges caramelise.",
    ],
  },
  {
    id: "tomato-basil-soup",
    section: "sides",
    title: "Tomato & Basil Soup",
    time: "25 mins",
    serves: "3–4",
    kcal: 150,
    macros: null,
    diet: ["V", "VG", "GF", "DF"],
    uses: ["tomato", "basil", "garlic"],
    ingredients: [
      "1 onion, chopped",
      "2 cloves garlic, sliced",
      "600 g ripe tomatoes, chopped (or 1 tin)",
      "500 ml vegetable stock",
      "A generous handful of basil",
      "1 tbsp olive oil, salt, pepper",
    ],
    method: [
      "Sweat the onion and garlic in oil until soft, 5 minutes.",
      "Add tomatoes and stock, simmer for 15 minutes.",
      "Blend until smooth, stir in torn basil and season to taste.",
    ],
  },
  {
    id: "herbed-flatbreads",
    section: "sides",
    title: "Herbed Flatbreads",
    time: "15 mins",
    serves: "4",
    kcal: 220,
    macros: "P 6 g · C 30 g · F 8 g",
    diet: ["V"],
    uses: ["parsley", "chives", "thyme", "oregano"],
    ingredients: [
      "1 cup plain flour, plus extra for rolling",
      "½ cup water",
      "2 tbsp mixed chopped herbs",
      "½ tsp salt",
      "1 tbsp olive oil",
    ],
    method: [
      "Mix the flour, water, salt, oil and herbs into a soft dough.",
      "Divide into 4, roll thin on a floured surface.",
      "Cook 1–2 mins each side in a dry hot pan until blistered.",
    ],
  },

  // ── Sweet & Snacks ───────────────────────────────────────────
  {
    id: "herb-scones",
    section: "sweet",
    title: "Herb Scones",
    time: "25 mins",
    serves: "makes 8",
    kcal: 180,
    macros: null,
    diet: ["V"],
    uses: ["chives", "parsley", "thyme"],
    ingredients: [
      "225 g self-raising flour",
      "50 g cold butter, cubed",
      "2 tbsp mixed soft herbs, chopped",
      "1 tsp baking powder",
      "150 ml milk",
      "Pinch of salt",
    ],
    method: [
      "Rub the butter into the flour, baking powder and salt until it looks like breadcrumbs.",
      "Stir in the herbs, then the milk, to a soft dough.",
      "Pat out to 2 cm thick, stamp out 8 rounds and bake at 200 °C for 12–15 mins.",
    ],
  },
  {
    id: "roasted-strawberries",
    section: "sweet",
    title: "Roasted Strawberries",
    time: "15 mins",
    serves: "2",
    kcal: 110,
    macros: null,
    diet: ["V", "VG", "GF", "DF"],
    uses: ["strawberry"],
    ingredients: [
      "1 cup strawberries, hulled",
      "1 tsp sugar (optional)",
      "A few thyme leaves or a tiny grind of black pepper",
    ],
    method: [
      "Toss the strawberries with the sugar and thyme in a small ovenproof dish.",
      "Roast at 180 °C for 10–15 minutes until the juices are syrupy.",
      "Great warm on yoghurt, or cool as a jam-in-waiting.",
    ],
  },
  {
    id: "mint-iced-tea",
    section: "sweet",
    title: "Mint Iced Tea",
    time: "5 mins + cooling",
    serves: "4",
    kcal: 5,
    macros: null,
    diet: ["V", "VG", "GF", "DF"],
    uses: ["mint"],
    ingredients: [
      "A big handful of fresh mint",
      "2 tea bags (black or green)",
      "1 litre boiling water",
      "Juice of half a lemon, ice to serve",
    ],
    method: [
      "Steep the tea bags and mint in the boiling water for 5 minutes, then remove.",
      "Chill, add lemon juice and pour over plenty of ice.",
    ],
  },
];

// Allergen key labels (English fallback — resolved via i18n on the page).
export const DIET_KEYS = ["V", "VG", "GF", "DF", "can-gf"];

export const WASTE_TIPS_KEY = "recipe.waste_tips.body";
