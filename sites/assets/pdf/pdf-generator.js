/* assets/pdf/pdf-generator.js
   Patch & Pot — PDF generator (region/category aware)
   - Reads current Region, Category, Month filters from the page
   - Lets user choose Portrait or Landscape
   - Remembers last orientation selection (localStorage)
*/
(function () {
  const ORIENT_KEY = "pp-pdf-orient";

  // Expose a tiny API for seasonal.html to call after it loads
  window.PP_PDF = {
    init
  };

  function $(sel) { return document.querySelector(sel); }

  function getSelectedRegion() {
    return ($("#pp-region")?.value || "scotland");
  }
  function getSelectedCategory() {
    return ($("#pp-category")?.value || "all");
  }
  function getMonthName() {
    const m = new Date().getMonth();
    return (window.PP_MONTHS || ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"])[m];
  }

  function init() {
    const btn = $("#pp-make-pdf");
    const orientSel = $("#pp-pdf-orient");

    if (!btn) return; // nothing to do

    // Restore last orientation (if any)
    const saved = localStorage.getItem(ORIENT_KEY);
    if (orientSel && saved) {
      orientSel.value = saved;
    }

    btn.addEventListener("click", async () => {
      // Resolve orientation
      const orient = orientSel ? (orientSel.value || "portrait") : "portrait";
      try {
        await makePDF(orient);
        // Remember choice
        localStorage.setItem(ORIENT_KEY, orient);
      } catch (err) {
        console.error("PDF generation failed:", err);
        alert("Sorry, PDF generation failed. Check the console for details.");
      }
    });
  }

  async function makePDF(orientation) {
    // Pull data from the already-loaded DATA blob the page uses
    const DATA = window.DATA || {};
    const regionKey = getSelectedRegion();
    const category = getSelectedCategory();
    const regionObj = DATA[regionKey];

    if (!regionObj || !Array.isArray(regionObj.crops)) {
      throw new Error("No crop data available for current region.");
    }

    // Build rows that reflect the current UI filters
    const monthIndex = new Date().getMonth();
    const crops = filterCrops(regionObj.crops, category, monthIndex);

    // Build a very simple printable table in a temp DOM node
    const wrapper = buildPrintableDOM({
      title: `Patch & Pot — ${regionObj.region} (${getMonthName()})`,
      legend: [
        ["🌱", "Sow"],
        ["🪴", "Plant"],
        ["🥕", "Harvest"]
      ],
      rows: crops
    });

    // Render with html2canvas -> jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: orientation === "landscape" ? "landscape" : "portrait",
      unit: "pt",
      format: "a4"
    });

    // Give the node a constrained width so we don't get huge gaps
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36; // 0.5 inch
    wrapper.style.width = (pageWidth - margin * 2) + "px";

    // One page at a time: slice the long content into pages
    const pageHeight = doc.internal.pageSize.getHeight();
    const canvas = await html2canvas(wrapper, { backgroundColor: "#ffffff", scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = canvas.height * (imgWidth / canvas.width);

    let y = margin;
    let remaining = imgHeight;
    let position = margin;

    // If it fits on one page:
    if (imgHeight <= pageHeight - margin * 2) {
      doc.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
    } else {
      // Add slices
      let srcY = 0;
      const pagePixels = (pageHeight - margin * 2) * (canvas.height / imgHeight);

      while (remaining > 0) {
        // Create a slice canvas
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.min(pagePixels, canvas.height - srcY);
        const sctx = slice.getContext("2d");
        sctx.drawImage(canvas, 0, srcY, canvas.width, slice.height, 0, 0, canvas.width, slice.height);

        const sliceData = slice.toDataURL("image/png");
        const sliceHeightPt = slice.height * (imgWidth / slice.width);

        doc.addImage(sliceData, "PNG", margin, margin, imgWidth, sliceHeightPt);

        remaining -= sliceHeightPt;
        srcY += slice.height;

        if (remaining > 0) doc.addPage();
      }
    }

    const file = `${regionKey}-${orientation}.pdf`;
    doc.save(file);

    // Clean up
    wrapper.remove();
  }

  function filterCrops(all, category, monthIndex) {
    const list = Array.isArray(all) ? all : [];
    return list.filter(c => {
      if (!c || !c.name) return false;
      if (category && category !== "all") {
        const cat = (c.category || inferCategory(c.name));
        if (cat !== category) return false;
      }
      // We always include—your on-page filter handles “this month only”
      return true;
    });
  }

  function inferCategory(name) {
    const n = (name || "").toLowerCase();
    if (/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n)) return "leafy";
    if (/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n)) return "roots";
    if (/(pea|bean|chickpea|lentil|soy|edamame)/.test(n)) return "legumes";
    if (/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo|cape gooseberry)/.test(n)) return "fruit";
    if (/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n)) return "alliums";
    if (/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n)) return "herbs";
    return "other";
  }

  function buildPrintableDOM({ title, legend, rows }) {
    // Make an off-screen container so we don’t affect the page
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-99999px";
    host.style.top = "0";
    host.style.zIndex = "-1";
    document.body.appendChild(host);

    // Simple styles (tight row spacing, no huge gaps)
    const css = document.createElement("style");
    css.textContent = `
      .pp-print { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; }
      .pp-print h1 { font-size: 16pt; margin: 0 0 8pt; }
      .pp-legend { font-size: 10pt; color:#444; margin: 0 0 6pt; }
      .pp-table { width: 100%; border-collapse: collapse; }
      .pp-table th, .pp-table td { border-bottom: 1px solid #ddd; padding: 4pt 6pt; vertical-align: top; font-size: 10pt; }
      .pp-table th { text-align: left; font-weight: 700; }
      .pp-meta { font-size: 9pt; color: #666; }
      .pp-tight { line-height: 1.25; }
    `;
    host.appendChild(css);

    const wrap = document.createElement("div");
    wrap.className = "pp-print";
    wrap.innerHTML = `
      <h1>${escapeHTML(title)}</h1>
      <div class="pp-legend">
        Legend: ${legend.map(([i, t]) => `${i} ${t}`).join("  •  ")}
      </div>
      <table class="pp-table pp-tight">
        <thead>
          <tr>
            <th style="width:38%">Crop</th>
            <th style="width:12%">Category</th>
            <th style="width:16%">Sow</th>
            <th style="width:16%">Plant</th>
            <th style="width:16%">Harvest</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <div class="pp-meta">Generated from current filters on patchandpot.com</div>
    `;
    host.appendChild(wrap);

    const tbody = wrap.querySelector("tbody");
    rows.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(c.name)}</td>
        <td>${escapeHTML(c.category || inferCategory(c.name))}</td>
        <td>${formatMonths(c.months?.sow)}</td>
        <td>${formatMonths(c.months?.plant)}</td>
        <td>${formatMonths(c.months?.harvest)}</td>
      `;
      tbody.appendChild(tr);
    });

    return wrap;
  }

  function formatMonths(arr) {
    const M = window.PP_MONTHS || ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    if (!Array.isArray(arr) || arr.length === 0) return "—";
    // Group consecutive month indices into ranges
    const s = [...arr].sort((a,b)=>a-b);
    const ranges = [];
    let start = s[0], prev = s[0];
    for (let i=1;i<s.length;i++){
      if (s[i] === prev + 1) { prev = s[i]; continue; }
      ranges.push([start, prev]);
      start = prev = s[i];
    }
    ranges.push([start, prev]);
    return ranges.map(([a,b]) => a===b ? M[a] : `${M[a]}–${M[b]}`).join(", ");
  }

  function escapeHTML(str){
    return String(str||"").replace(/[&<>"']/g, s => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[s]));
  }

})();
