/* assets/js/seasonal.js
   Patch & Pot — Seasonal page logic
   IMPORTANT: data paths are absolute from the site root (sites/ is the repo root),
   so all fetches use:  /data/regions/${region}/${block}.json
*/
(function () {
  "use strict";

  // -------- Constants
  const REGIONS = ["scotland", "england", "ireland", "wales"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CROPS_BLOCKS = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
  const NOW_M = new Date().getMonth();

  // -------- State
  const DATA = { scotland:null, england:null, ireland:null, wales:null };
  const MISSING = Object.fromEntries(REGIONS.map(r => [r, new Set()]));
  const TRIED = Object.fromEntries(REGIONS.map(r => [r, new Set()]));

  // -------- DOM refs
  const el = {
    region:     () => document.getElementById("pp-region"),
    search:     () => document.getElementById("pp-search"),
    category:   () => document.getElementById("pp-category"),
    monthOnly:  () => document.getElementById("pp-this-month"),
    pestTitleR: () => document.getElementById("pp-region-name"),
    pestTitleM: () => document.getElementById("pp-month-name"),
    pestList:   () => document.querySelector("#pp-pestwatch ul"),
    todayHint:  () => document.getElementById("pp-month-hint"),
    todayList:  () => document.getElementById("pp-today-list"),
    calendar:   () => document.getElementById("pp-calendar"),
    errorBox:   () => document.getElementById("pp-error"),
  };

  // -------- Helpers
  function titleCaseRegion(k){ return k ? k[0].toUpperCase() + k.slice(1) : ""; }

  function safeJSON(url) {
    // cache-bust + no-store to avoid iOS stubborn caching while you iterate
    const full = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
    return fetch(full, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
        return r.json();
      });
  }

  function tryFetch(region, block) {
    const endpoint = `/data/regions/${region}/${block}.json`;
    TRIED[region].add(endpoint);
    return safeJSON(endpoint).catch(() => {
      MISSING[region].add(`${block}.json`);
      // Return reasonable empty structures
      if (block === "basics" || block === "pestwatch") return {};
      return [];
    });
  }

  function inferCategory(name) {
    const n = (name || "").toLowerCase();
    if (/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n)) return "leafy";
    if (/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n)) return "roots";
    if (/(pea|bean|chickpea|lentil|soy|edamame)/.test(n)) return "legumes";
    if (/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n)) return "fruit";
    if (/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n)) return "alliums";
    if (/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n)) return "herbs";
    return "other";
  }

  function getFilters() {
    return {
      region: (el.region()?.value || "scotland").toLowerCase(),
      q: (el.search()?.value || "").trim().toLowerCase(),
      cat: el.category()?.value || "all",
      monthOnly: !!el.monthOnly()?.checked,
    };
  }

  function filterCrops(crops) {
    const f = getFilters();
    return (crops || []).filter(c => {
      if (!c || !c.name) return false;
      if (f.q && !c.name.toLowerCase().includes(f.q)) return false;
      const cat = c.category || inferCategory(c.name);
      if (f.cat !== "all" && cat !== f.cat) return false;
      if (f.monthOnly) {
        const s = (c.months?.sow || []).includes(NOW_M);
        const p = (c.months?.plant || []).includes(NOW_M);
        const h = (c.months?.harvest || []).includes(NOW_M);
        if (!(s || p || h)) return false;
      }
      return true;
    });
  }

  // -------- Rendering
  function renderPestWatch(regionKey) {
    const region = DATA[regionKey] || {};
    const monthEntry = region.pestwatch?.[String(NOW_M)];
    const items = monthEntry?.items || ["No major alerts this month. Keep an eye on slugs after rain."];

    el.pestTitleR().textContent = titleCaseRegion(regionKey);
    el.pestTitleM().textContent = MONTHS[NOW_M];
    el.pestList().innerHTML = items.map(li => `<li>${li}</li>`).join("");
  }

  function renderToday(regionKey) {
    const region = DATA[regionKey] || {};
    const list = filterCrops(region.crops || []);
    el.todayHint().textContent = `Here’s what suits containers now in ${MONTHS[NOW_M]}.`;

    const rows = [];
    list.forEach(c => {
      const s = (c.months?.sow || []).includes(NOW_M);
      const p = (c.months?.plant || []).includes(NOW_M);
      const h = (c.months?.harvest || []).includes(NOW_M);
      if (s || p || h) {
        const tag = c.category || inferCategory(c.name);
        rows.push(
          `<li><strong>${c.name}</strong>${s ? " (sow)" : ""}${p ? " (plant)" : ""}${h ? " (harvest)" : ""} <span class="pp-tags">(${tag})</span></li>`
        );
      }
    });
    el.todayList().innerHTML = rows.length ? rows.join("") : `<li>No items match your filters for ${MONTHS[NOW_M]}.</li>`;
  }

  function renderCalendar(regionKey) {
    const region = DATA[regionKey] || {};
    const wrap = el.calendar();
    const head = `<div class="pp-row">
      <div class="pp-head sm">Crop</div>
      ${MONTHS.map(m => `<div class="pp-head sm">${m}</div>`).join("")}
    </div>`;

    const rows = filterCrops(region.crops || []).map(c => {
      const cat = c.category || inferCategory(c.name);
      const monthCells = MONTHS.map((_, i) => {
        const s = (c.months?.sow || []).includes(i);
        const p = (c.months?.plant || []).includes(i);
        const h = (c.months?.harvest || []).includes(i);
        // No emoji variant (per your “boring” PDF choice); page can still show emojis if you prefer:
        const marks = [s ? "Sow" : "", p ? "Plant" : "", h ? "Harvest" : ""].filter(Boolean).join(" / ");
        return `<div class="pp-cell">${marks}</div>`;
      }).join("");

      return `<div class="pp-row">
        <div class="pp-crop"><span class="name">${c.name}</span><span class="pp-tags">(${cat})</span></div>
        ${monthCells}
      </div>`;
    }).join("");

    wrap.innerHTML = head + rows;
  }

  function renderMissing(regionKey) {
    const miss = [...MISSING[regionKey]];
    const tried = [...TRIED[regionKey]];
    const box = el.errorBox();
    if (!box) return;

    if (miss.length) {
      box.style.display = "block";
      box.innerHTML = `
        <strong>Missing for ${titleCaseRegion(regionKey)}:</strong><br>
        ${miss.map(x => x).join("<br>")}
        <br><br><em>Tried endpoints:</em><br>
        ${tried.join("<br>")}
      `;
    } else {
      box.style.display = "none";
      box.innerHTML = "";
    }
  }

  function renderAll() {
    const { region } = getFilters();
    localStorage.setItem("pp-region", region);
    document.title = `Seasonal Planting (${titleCaseRegion(region)}) • Patch & Pot`;

    renderPestWatch(region);
    renderToday(region);
    renderCalendar(region);
    renderMissing(region);
  }

  // -------- Data loading
  async function loadRegion(region) {
    // meta
    const [basics, pestwatch] = await Promise.all([
      tryFetch(region, "basics"),
      tryFetch(region, "pestwatch"),
    ]);

    // crops
    const blocks = await Promise.all(
      CROPS_BLOCKS.map(b => tryFetch(region, b))
    );
    const crops = blocks.flat().filter(c => c && c.name);

    return { region: titleCaseRegion(region), basics, pestwatch, crops };
  }

  async function preloadAll() {
    // Preload every region once; render after Scotland is ready (or selected)
    await Promise.all(
      REGIONS.map(async r => {
        DATA[r] = await loadRegion(r);
      })
    );
  }

  // -------- Boot
  function bindUI() {
    const r = el.region();
    if (r) r.value = localStorage.getItem("pp-region") || "scotland";

    const inputs = [
      [el.search(), "input"],
      [el.category(), "change"],
      [el.monthOnly(), "change"],
      [el.region(), "change"],
    ];
    inputs.forEach(([node, ev]) => {
      if (!node) return;
      node.addEventListener(ev, renderAll, { passive: true });
    });

    // Initial static labels
    el.pestTitleM().textContent = MONTHS[NOW_M];
  }

  (async function init() {
    try {
      bindUI();
      await preloadAll();
      renderAll();
      // Expose a tiny read-only selector for the PDF generator (if ever restored)
      window.PP_VIEW = {
        getSelection: () => ({
          region: (el.region()?.value || "scotland").toLowerCase(),
          category: el.category()?.value || "all",
          q: (el.search()?.value || "").trim(),
          monthOnly: !!el.monthOnly()?.checked,
        })
      };
    } catch (err) {
      const box = el.errorBox();
      if (box) {
        box.style.display = "block";
        box.textContent = `Failed to load data: ${err && err.message ? err.message : err}`;
      }
    }
  })();
})();
