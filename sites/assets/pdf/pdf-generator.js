// assets/pdf/pdf-generator.js
// Builds a printable PDF for the *current* Seasonal view:
// - Basics from data/regions/<region>/basics.json
// - Pest Watch for current month from DATA[region].pestwatch
// - Seasonal calendar grid (names separate from month markers)
// Requires: html2canvas, jsPDF, and the page's global DATA object.

(function () {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CUR_M = new Date().getMonth();

  // Defensive DOM getters (so this runs even if elements are missing)
  function el(id) { return document.getElementById(id); }
  function val(id, fallback="") { const e = el(id); return e ? e.value : fallback; }
  function checked(id) { const e = el(id); return !!(e && e.checked); }

  // Tiny helper – same categoriser as the page (kept in sync)
  function inferCategory(name) {
    const n = (name||"").toLowerCase();
    if (/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n)) return "leafy";
    if (/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel\b)/.test(n)) return "roots";
    if (/(pea|bean|chickpea|lentil|soy|edamame)/.test(n)) return "legumes";
    if (/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n)) return "fruit";
    if (/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n)) return "alliums";
    if (/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n)) return "herbs";
    return "other";
  }

  function humanRegion(k){ return k ? k[0].toUpperCase()+k.slice(1) : ""; }

  // Apply the same filters as the page
  function filteredCrops(regionData) {
    const q   = (val("pp-search","").trim().toLowerCase());
    const cat = val("pp-category","all");
    const onlyThisMonth = checked("pp-this-month");

    return (regionData.crops || [])
      .filter(c => c && c.name)
      .filter(c => {
        const name = c.name || "";
        const category = c.category || inferCategory(name);
        if (q && !name.toLowerCase().includes(q)) return false;
        if (cat !== "all" && category !== cat) return false;
        if (onlyThisMonth) {
          const s = (c.months?.sow||[]).includes(CUR_M);
          const p = (c.months?.plant||[]).includes(CUR_M);
          const h = (c.months?.harvest||[]).includes(CUR_M);
          if (!(s||p||h)) return false;
        }
        return true;
      });
  }

  // Build a clean calendar grid fragment (no crop names in month cells)
  function buildCalendar(regionData) {
    const crops = filteredCrops(regionData);

    const grid = document.createElement("div");
    grid.className = "pdf-grid";
    const rowFrag = document.createDocumentFragment();

    // Header
    const headRow = document.createElement("div");
    headRow.className = "pdf-row";
    const cropHead = document.createElement("div");
    cropHead.className = "pdf-headcell";
    cropHead.textContent = "Crop";
    headRow.appendChild(cropHead);
    MONTHS.forEach(m=>{
      const hc = document.createElement("div");
      hc.className = "pdf-headcell";
      hc.textContent = m;
      headRow.appendChild(hc);
    });
    grid.appendChild(headRow);

    // Rows
    crops.forEach(c => {
      const row = document.createElement("div");
      row.className = "pdf-row pdf-keep"; // pdf-keep => avoid page-break-inside

      // First cell: crop name + category ONLY
      const first = document.createElement("div");
      first.className = "pdf-cell pdf-crop";
      const nm = document.createElement("div");
      nm.textContent = c.name;
      nm.style.fontWeight = "700";
      const tag = document.createElement("div");
      tag.className = "pdf-tag";
      const category = (c.category || inferCategory(c.name));
      tag.textContent = category;
      first.appendChild(nm);
      first.appendChild(tag);
      row.appendChild(first);

      // Month cells: EMOJI ONLY
      for (let i=0;i<12;i++){
        const cell = document.createElement("div");
        cell.className = "pdf-cell";
        const s = (c.months?.sow||[]).includes(i);
        const p = (c.months?.plant||[]).includes(i);
        const h = (c.months?.harvest||[]).includes(i);
        cell.textContent = [s?"🌱":"", p?"🪴":"", h?"🥕":""].join(" ").trim();
        row.appendChild(cell);
      }
      rowFrag.appendChild(row);
    });

    grid.appendChild(rowFrag);
    return grid;
  }

  // Build Basics section (from basics.json – print everything present)
  function buildBasics(regionData) {
    const basics = regionData.basics || {};
    const wrap = document.createElement("section");
    wrap.className = "pdf-section";

    const h2 = document.createElement("h2");
    h2.className = "pdf-title2";
    h2.textContent = "Basics – Small-space tips";
    wrap.appendChild(h2);

    // Friendly order if keys exist
    const friendlyOrder = [
      "containers","pots","raisedBeds","directSoil","netting","cloches","coldFrames",
      "protection","watering","feeding","soil","compost","sun","shade","light",
      "spacing","depth","planting","notes","indoors","greenhouse","polytunnel","tools"
    ];

    const keys = Object.keys(basics);
    if (!keys.length) {
      const p = document.createElement("p");
      p.className = "pdf-meta";
      p.textContent = "No basics data found for this region.";
      wrap.appendChild(p);
      return wrap;
    }

    // Make a unique ordered list of existing keys
    const ordered = [...new Set([...friendlyOrder, ...keys])].filter(k => basics[k]);

    ordered.forEach(key => {
      const val = basics[key];
      const group = document.createElement("div");
      group.className = "pdf-block";

      const title = document.createElement("h3");
      title.className = "pdf-title3";
      // Title-case key prettifier
      title.textContent = key.replace(/([A-Z])/g, " $1")
                             .replace(/_/g," ")
                             .replace(/\b\w/g, s => s.toUpperCase());
      group.appendChild(title);

      const list = Array.isArray(val) ? val : (Array.isArray(val?.items) ? val.items : null);
      if (list) {
        const ul = document.createElement("ul");
        ul.className = "pdf-ul";
        list.forEach(item => {
          const li = document.createElement("li");
          li.textContent = item;
          ul.appendChild(li);
        });
        group.appendChild(ul);
      } else if (typeof val === "string") {
        const p = document.createElement("p");
        p.className = "pdf-meta";
        p.textContent = val;
        group.appendChild(p);
      }
      wrap.appendChild(group);
    });

    return wrap;
  }

  // Build Pest Watch (for the current month)
  function buildPestWatch(regionKey, regionData) {
    const wrap = document.createElement("section");
    wrap.className = "pdf-section";

    const h2 = document.createElement("h2");
    h2.className = "pdf-title2";
    h2.textContent = `Pest Watch — ${MONTHS[CUR_M]} (${humanRegion(regionKey)})`;
    wrap.appendChild(h2);

    const entry = (regionData.pestwatch && regionData.pestwatch[String(CUR_M)]) || {items:["No major alerts this month. Keep an eye on slugs after rain."]};
    const ul = document.createElement("ul");
    ul.className = "pdf-ul";
    (entry.items||[]).forEach(t => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  // Build a full A4 sheet DOM for jsPDF to render
  function buildSheet(regionKey, orientation) {
    const regionData = (window.DATA && window.DATA[regionKey]) || { crops:[], basics:{}, pestwatch:{} };

    const sheet = document.createElement("div");
    sheet.className = "pdf-sheet"; // styled in assets/pdf/pdf.css
    sheet.setAttribute("data-orient", orientation);

    // Title
    const head = document.createElement("div");
    head.className = "pdf-head";
    const title = document.createElement("h1");
    title.className = "pdf-title";
    title.textContent = "Patch & Pot — Seasonal Planting";
    const meta = document.createElement("div");
    meta.className = "pdf-meta";
    const catLabel = val("pp-category","all") === "all" ? "All categories" : val("pp-category");
    meta.textContent = `Region: ${humanRegion(regionKey)}  •  Category: ${catLabel}  •  Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`;
    head.appendChild(title);
    head.appendChild(meta);
    sheet.appendChild(head);

    // Legend
    const legend = document.createElement("div");
    legend.className = "legend";
    legend.innerHTML = `<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>`;
    sheet.appendChild(legend);

    // Sections
    sheet.appendChild(buildBasics(regionData));
    sheet.appendChild(buildPestWatch(regionKey, regionData));

    // Calendar
    const calH2 = document.createElement("h2");
    calH2.className = "pdf-title2";
    calH2.textContent = "Seasonal Calendar";
    sheet.appendChild(calH2);
    sheet.appendChild(buildCalendar(regionData));

    return sheet;
  }

  // Orchestrate jsPDF export
  async function exportPDF() {
    const regionKey = val("pp-region","scotland");
    const orientation = (val("pp-orient","portrait") || "portrait").toLowerCase(); // "portrait"|"landscape"

    if (!window.jspdf || !window.html2canvas) {
      alert("Sorry, PDF libraries not loaded.");
      return;
    }

    // Build an offscreen sheet and render with jsPDF.html
    const sheet = buildSheet(regionKey, orientation);
    document.body.appendChild(sheet);

    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: (orientation === "landscape" ? "landscape" : "portrait"),
        unit: "pt",
        format: "a4",
        compress: true,
        hotfixes: ["px_scaling"]
      });

      // Add a small page-break avoid
      sheet.querySelectorAll(".pdf-keep").forEach(n => n.style.breakInside = "avoid");

      await pdf.html(sheet, {
        html2canvas: {
          scale: window.devicePixelRatio > 1 ? 2 : 1.6,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          onclone: (doc) => {
            // Ensure our offscreen node is visible to html2canvas
            const s = doc.querySelector(".pdf-sheet");
            if (s) s.style.left = "0";
          }
        },
        margin: [24, 22, 28, 22],
        autoPaging: "text",
        x: 0,
        y: 0,
        callback: function (doc) {
          const file = `patchandpot-${regionKey}-${MONTHS[CUR_M].toLowerCase()}.pdf`;
          doc.save(file);
        }
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Sorry, PDF generation failed. Check the console for details.");
    } finally {
      sheet.remove();
    }
  }

  // Public API
  window.PP_PDF = {
    init() {
      const btn = document.getElementById("pp-pdf-btn") || document.getElementById("pp-pdf");
      if (btn) btn.addEventListener("click", exportPDF, { passive: true });
    }
  };
})();
