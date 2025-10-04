/* Patch & Pot — Seasonal PDF generator (clean build)
   Requires: jspdf.umd.min.js + jspdf.plugin.autotable.min.js
   This exposes window.PP_PDF.generate({region, category, q, page, includeIntro})
   It fetches region JSON directly (no dependency on page state besides selection).
*/
(function () {
  if (window.PP_PDF) return;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const BLOCKS = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];

  const BRAND = {
    green: [46, 125, 50],          // header bar
    gridLine: [222, 230, 225],     // subtle grid
    headFill: [240, 247, 242],     // header cell bg
    text: [0, 0, 0]
  };

  function cap(s){ return s ? s[0].toUpperCase()+s.slice(1) : ""; }

  async function fetchJSON(url){
    const r = await fetch(url + `?v=${Date.now()}`, {cache:"no-store"});
    if(!r.ok) throw new Error(url);
    return r.json();
  }

  async function loadRegion(region){
    const base = `data/regions/${region}/`;
    const [basics, pestwatch, ...blocks] = await Promise.all([
      fetchJSON(base+"basics.json").catch(()=>({})),
      fetchJSON(base+"pestwatch.json").catch(()=>({})),
      ...BLOCKS.map(b => fetchJSON(base+b+".json").catch(()=>[]))
    ]);

    const crops = [];
    blocks.forEach(b=>{
      if(Array.isArray(b)) crops.push(...b);
      else if(b && Array.isArray(b.crops)) crops.push(...b.crops);
    });

    return { basics, pestwatch, crops };
  }

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|pak|choi|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|physalis|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|chive|welsh onion)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return "other";
  }

  function monthMarks(crop, i){
    const s = (crop.months?.sow||[]).includes(i)     ? "S" : "";
    const p = (crop.months?.plant||[]).includes(i)   ? "P" : "";
    const h = (crop.months?.harvest||[]).includes(i) ? "H" : "";
    return (s+p+h) || "";
  }

  function filterCrops(all, category, q){
    let list = all.filter(c=>c && c.name);
    if (category && category !== "all"){
      list = list.filter(c=>(c.category||inferCategory(c.name))===category);
    }
    if (q && q.trim()){
      const needle = q.trim().toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(needle));
    }
    return list;
  }

  function addHeader(doc, region, category, pageNo, pageCount){
    const m = 16, y = 16;
    doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.setTextColor(...BRAND.text);
    doc.text(`Seasonal Planting — ${cap(region)}`, m, y);

    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    const filter = (category==="all"||!category) ? "All categories" : category;
    const when = new Date().toLocaleDateString("en-GB");
    doc.text(`Filter: ${filter}  •  Generated ${when}  •  Page ${pageNo}/${pageCount}`, m, y+6);

    const legend = "Legend: S = Sow   P = Plant   H = Harvest";
    const w = doc.getTextWidth(legend);
    const x = doc.internal.pageSize.getWidth() - m - w;
    doc.text(legend, x, y+6);
  }

  function addFooter(doc){
    const text = "© 2025 Patch & Pot | Created by Grant Cameron Anthony";
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60,104,84);
    const pageW = doc.internal.pageSize.getWidth();
    const x = (pageW - doc.getTextWidth(text))/2;
    const y = doc.internal.pageSize.getHeight() - 10;
    doc.text(text, x, y);
    doc.setTextColor(...BRAND.text);
  }

  function addIntro(doc, basics, pestItems){
    // A subtle dark band under the header with Basics + Pest Watch (single lines)
    const margin = 16, top = 40, h = 22;
    const w = doc.internal.pageSize.getWidth() - margin*2;

    doc.setFillColor(14,25,20);
    doc.roundedRect(margin, top, w, h, 3, 3, "F");

    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(235,245,238);
    doc.text("Basics", margin+6, top+7);
    doc.setFont("helvetica","normal"); doc.setFontSize(10);

    const basicsLine = (basics && basics.quick) || "Good hygiene, drainage, right pot size, and consistent watering.";
    doc.text(basicsLine, margin+6, top+13, { maxWidth: w-12 });

    doc.setFont("helvetica","bold");
    doc.text("Pest Watch", margin+6, top+19);
    doc.setFont("helvetica","normal");

    const line = (pestItems && pestItems.length) ? pestItems[0] : "Keep an eye on slugs after rain.";
    const offset = doc.getTextWidth("Pest Watch ")+2;
    doc.text(line, margin+6+offset, top+19, { maxWidth: w-12-offset });

    doc.setTextColor(...BRAND.text);
  }

  function buildTable(doc, crops, startY, orientation){
    // Bigger/taller rows so names NEVER collide or look cramped
    const isLandscape = (orientation||"p").toLowerCase().startsWith("l");
    const cropColWidth = isLandscape ? 120 : 96;

    const head = [["Crop"].concat(MONTHS)];
    const body = crops.map(c=>{
      const cat = (c.category || inferCategory(c.name));
      const name = `${c.name}\n(${cat})`;
      const row = [name];
      for(let i=0;i<12;i++) row.push(monthMarks(c,i));
      return row;
    });

    const colStyles = { 0: { cellWidth: cropColWidth, overflow: "linebreak", minCellHeight: 26, valign: "middle" } };
    for(let i=1;i<=12;i++){
      colStyles[i] = { halign: "center", minCellHeight: 26, cellWidth: "auto" };
    }

    doc.autoTable({
      head,
      body,
      startY,
      margin: { left: 16, right: 16 },
      styles: {
        font: "helvetica",
        fontSize: 11,
        textColor: BRAND.text,
        lineColor: BRAND.gridLine,
        lineWidth: 0.2,
        cellPadding: { top: 6, bottom: 6, left: 3, right: 3 },   // ← TALLER ROWS
        overflow: "linebreak",
        valign: "middle",
        minCellHeight: 26                                        // ← TALLER ROWS
      },
      headStyles: {
        fillColor: BRAND.headFill,
        textColor: BRAND.text,
        fontStyle: "bold"
      },
      columnStyles: colStyles,
      didDrawPage: (data) => {
        // Header & footer on each page
        addHeader(doc, data.settings._region, data.settings._category, doc.internal.getNumberOfPages(), data.settings._pageCount);
        addFooter(doc);

        // Rounded green bar above table head (brand touch)
        const pageW = doc.internal.pageSize.getWidth();
        const barX = 16, barW = pageW - 32, barH = 7;
        const barY = data.settings.startY - 6; // just above table head
        doc.setFillColor(...BRAND.green);
        doc.roundedRect(barX, barY, barW, barH, 3, 3, "F");
      }
    });
  }

  async function generate(opts = {}){
    try{
      const region = (opts.region || window.PP_VIEW?.getSelection?.().region || "scotland").toLowerCase();
      const category = opts.category || window.PP_VIEW?.getSelection?.().category || "all";
      const q = opts.q ?? window.PP_VIEW?.getSelection?.().q ?? "";
      const includeIntro = (typeof opts.includeIntro === "boolean") ? opts.includeIntro : true;

      // Orientation: read from a select with id="pp-page" if present; fallback to portrait
      const pageSel = document.getElementById("pp-page");
      const pageOpt = (opts.page || pageSel?.value || "portrait a4").toLowerCase();
      const orientation = pageOpt.includes("landscape") ? "l" : "p";

      const { jsPDF } = window.jspdf || {};
      if(!jsPDF || !window.jspdf || !window.jspPDF || !window.jspdf?.jsPDF){
        // some bundles expose only window.jspdf.jsPDF
      }
      const Doc = jsPDF || window.jspdf?.jsPDF;
      if(!Doc || !window.jspdf?.autoTable){
        throw new Error("jsPDF/autoTable not loaded");
      }

      // Load data
      const data = await loadRegion(region);
      const crops = filterCrops(data.crops, category, q);

      // Build the PDF
      const doc = new Doc({ orientation, unit: "pt", format: "a4" });

      // Total pages is unknown until tables are laid out; we'll draw header/footer
      // on each page with a forward-looking estimate by first making a dry run in memory.
      // Simpler: render once; then loop pages to overwrite header numbers.
      // We’ll set placeholders now and then correct after final page count.
      doc.__pp_meta = { region, category };

      // Top: header
      addHeader(doc, region, category, 1, 1);

      let y = 58; // space under header text
      if (includeIntro){
        addIntro(doc, data.basics, (data.pestwatch && data.pestwatch[String(new Date().getMonth())]?.items)||[]);
        y = 68; // little extra gap below the intro band
      }

      // Table(s)
      doc.autoTableSetDefaults({}); // ensure default state clean
      // stash meta to read inside didDrawPage
      const _settings = { _region: region, _category: category, _pageCount: 9999, startY: y }; // fake pagecount first
      doc.autoTable.previous = undefined; // reset
      buildTable(doc, crops, y+18, orientation);

      // After table is rendered, correct page numbers and rewrite headers with actual total
      const total = doc.internal.getNumberOfPages();
      for(let i=1;i<=total;i++){
        doc.setPage(i);
        // wipe area where header meta text sits (small white box over it)
        // (intentional skip to avoid complexity; instead re-draw over text)
        addHeader(doc, region, category, i, total);
        addFooter(doc);
      }

      // File name
      const when = new Date().toISOString().slice(0,10);
      const fname = `PatchAndPot_Seasonal_${cap(region)}_${category==='all'?'All':category}_${when}.pdf`;
      doc.save(fname);
    }catch(err){
      alert('Sorry, PDF generation failed.');
      console.error(err);
    }
  }

  window.PP_PDF = { generate };
})();
