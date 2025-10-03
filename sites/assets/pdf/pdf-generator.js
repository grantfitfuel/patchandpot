/* Patch & Pot – Seasonal PDF generator
 * Uses region JSON blocks under data/regions/<region>/.
 * Renders a clean A4 multi-page PDF (portrait or landscape).
 * No emojis in crop-name column; icons appear only in month cells.
*/
(function(global){
  const { jsPDF } = window.jspdf || {};
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ----- fetch helpers -----
  const blocks = ["basics","pestwatch","roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];

  function fetchJSON(url){
    return fetch(url + `?v=${Date.now()}`, {cache:'no-store'})
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}: ${url}`)));
  }

  async function loadRegion(region){
    const base = `data/regions/${region}`;
    const results = await Promise.all(blocks.map(b =>
      fetchJSON(`${base}/${b}.json`).catch(()=> (b==="basics"||b==="pestwatch")?{}:[])
    ));
    const meta = { basics: results[0]||{}, pestwatch: results[1]||{} };
    const crops = results.slice(2).flat().filter(c => c && c.name);
    return { meta, crops };
  }

  // ---- drawing helpers ----
  function drawHeader(doc, title, sub, logoLeft, y){
    const lm = 16, rm = doc.internal.pageSize.getWidth()-16;
    doc.setFont("helvetica","bold");
    doc.setFontSize(20);
    doc.text(title, lm, y);
    doc.setFont("helvetica","normal");
    doc.setFontSize(10);
    doc.text(sub, lm, y+6);
    // legend on the right
    const legend = "Legend: 🌱 Sow   🪴 Plant   🥕 Harvest";
    const w = doc.getTextWidth(legend);
    doc.text(legend, rm - w, y+6);
  }

  function drawFooter(doc){
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const center = w/2;
    const y = h - 12;

    // logo (small, centred)
    try{
      // If you want to embed a base64 logo, replace below with doc.addImage(dataUrl,...)
      // Here we just draw a tiny pot with text, to avoid external fetch.
      doc.setFillColor(220, 120, 60);
      doc.circle(center, y-3.5, 2.6, "F");
    }catch(e){}

    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    const line = "© 2025 Patch & Pot | Created by Grant Cameron Anthony";
    const tw = doc.getTextWidth(line);
    doc.text(line, center - tw/2, y+4);
  }

  function monthRowMarks(crop, mIdx){
    const s = (crop.months?.sow||[]).includes(mIdx);
    const p = (crop.months?.plant||[]).includes(mIdx);
    const h = (crop.months?.harvest||[]).includes(mIdx);
    return (s?"🌱 ":"") + (p?"🪴 ":"") + (h?"🥕 ":"");
  }

  // paginate crops into chunks that fit on a page
  function paginate(items, rowsPerPage){ 
    const out=[]; for(let i=0;i<items.length;i+=rowsPerPage) out.push(items.slice(i,i+rowsPerPage)); 
    return out;
  }

  function fitText(doc, text, maxWidth){
    // decrease font size for month header so last char doesn't wrap
    let size = 10;
    doc.setFontSize(size);
    while (doc.getTextWidth(text) > maxWidth && size > 7){
      size -= 0.3;
      doc.setFontSize(size);
    }
    return size;
  }

  function renderCalendarPage(doc, crops, opts, pageIndex){
    const margin = 14;
    const usableW = doc.internal.pageSize.getWidth() - margin*2;
    const usableH = doc.internal.pageSize.getHeight() - margin*2;

    const colCropW = Math.max(usableW * 0.22, 110); // crop name column
    const colMonthW = (usableW - colCropW) / 12;

    let y = margin;

    // header
    if(pageIndex === 0){
      drawHeader(
        doc,
        `Patch & Pot — Seasonal Planting`,
        `Region: ${opts.regionName} • Category: ${opts.categoryName} • Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`,
        null, y
      );
      y += 14;
    } else {
      doc.setFont("helvetica","italic"); doc.setFontSize(10);
      doc.text(`Seasonal Planting — ${opts.regionName} (cont’d)`, margin, y);
      y += 8;
    }

    // table header
    doc.setFont("helvetica","bold"); doc.setFontSize(10);
    doc.setFillColor(242, 246, 244);
    doc.rect(margin, y, colCropW, 10, "F");
    doc.rect(margin+colCropW, y, colMonthW*12, 10, "F");
    doc.setDrawColor(217, 227, 220);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, colCropW + colMonthW*12, 10);

    doc.text("Crop", margin+2, y+7);
    for(let m=0;m<12;m++){
      const x = margin + colCropW + m*colMonthW + 2;
      doc.setFont("helvetica","bold");
      const size = fitText(doc, MONTHS[m], colMonthW-4);
      doc.text(MONTHS[m], x, y+7);
      doc.setFontSize(10);
    }
    y += 10;

    // rows
    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    const rowH = 11.5;
    crops.forEach(crop=>{
      // name cell
      doc.setFillColor(247, 250, 248);
      doc.rect(margin, y, colCropW, rowH, "F");
      doc.rect(margin, y, colCropW, rowH); // border
      // crop name (no emoji here)
      doc.text(crop.name, margin+2, y+7);
      // tag
      doc.setFont("helvetica","bold"); doc.setTextColor(107,124,115); doc.setFontSize(9);
      const tag = (crop.category || "").toLowerCase();
      doc.text(tag || "", margin+2, y+10);
      doc.setFont("helvetica","normal"); doc.setTextColor(0,0,0); doc.setFontSize(10);

      // months
      for(let m=0;m<12;m++){
        const x = margin + colCropW + m*colMonthW;
        doc.rect(x, y, colMonthW, rowH);
        const marks = monthRowMarks(crop, m);
        if(marks){
          doc.text(marks.trim(), x+2, y+7);
        }
      }
      y += rowH;
    });

    drawFooter(doc);
  }

  // optional pages
  function renderBasicsPage(doc, basics, regionName){
    doc.addPage();
    const m = 16;
    drawHeader(doc, `Patch & Pot — Basics`, `Region: ${regionName}`, null, m);
    let y = m + 12;
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("Container & Planting Basics", m, y);
    doc.setFont("helvetica","normal"); doc.setFontSize(10); y+=6;

    const lines = [
      basics?.soil || "Use peat-free multi-purpose compost with added drainage (perlite or grit).",
      basics?.watering || "Water little and often; keep compost just moist. Avoid waterlogging.",
      basics?.light || "6+ hours of light preferred; many herbs and salads manage with part shade.",
      basics?.feeding || "Liquid feed fortnightly once plants are established.",
      basics?.protection || "Use fleece/cloche to hold heat; netting against birds/cabbage whites."
    ];
    lines.forEach(t=>{ doc.text(`• ${t}`, m, y); y+=6; });
    drawFooter(doc);
  }

  function renderPestPage(doc, pestwatch, regionName){
    doc.addPage();
    const m = 16;
    drawHeader(doc, `Patch & Pot — Pest Watch`, `Region: ${regionName}`, null, m);
    let y = m + 12;
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("Month-by-month watchlist", m, y); y+=6;
    doc.setFont("helvetica","normal"); doc.setFontSize(10);
    for(let i=0;i<12;i++){
      const month = MONTHS[i];
      const items = (pestwatch?.[String(i)]?.items)||[];
      doc.text(`${month}:`, m, y); y+=5;
      if(items.length){ items.forEach(it=>{ doc.text(`  • ${it}`, m, y); y+=5; }); }
      else { doc.text("  • No major alerts.", m, y); y+=5; }
      y+=2;
      if(y > doc.internal.pageSize.getHeight()-20){ drawFooter(doc); doc.addPage(); y=16; }
    }
    drawFooter(doc);
  }

  // public API
  const PP_PDF = {
    async generate(opts){
      const region = (opts.region||'scotland').toLowerCase();
      const category = (opts.category||'all').toLowerCase();
      const orientation = (opts.orientation||'landscape').toLowerCase();
      const regionName = region[0].toUpperCase()+region.slice(1);
      const categoryName = category==='all' ? 'All categories' : category;

      const { meta, crops } = await loadRegion(region);
      const filtered = category==='all'
        ? crops
        : crops.filter(c => (c.category||"").toLowerCase() === category);

      // jsPDF init
      const doc = new jsPDF(orientation, "pt", "a4");
      doc.setFont("helvetica","normal");
      doc.setTextColor(20,25,23);

      // paginate  (rows per page differs by orientation)
      const rowsPerPage = orientation==='landscape' ? 20 : 14;
      const pages = paginate(filtered, rowsPerPage);

      // render pages
      pages.forEach((chunk, idx)=>{
        if(idx>0) doc.addPage();
        renderCalendarPage(doc, chunk, {regionName, categoryName}, idx);
      });

      if(opts.includeBasics)  renderBasicsPage(doc, meta.basics, regionName);
      if(opts.includePest)    renderPestPage(doc, meta.pestwatch, regionName);

      // save
      const fname = `patchandpot-${region}-${category}-${orientation}.pdf`;
      doc.save(fname);
    }
  };

  global.PP_PDF = PP_PDF;
})(window);
