/* global jspdf */
/* Uses CDN jsPDF + autoTable loaded by seasonal.html */
(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const NAME_TO_IDX = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};

  // ---- fetch helper (cache buster) ----
  async function fetchJSON(url){
    const r = await fetch(`${url}?v=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error(`Failed ${url} (${r.status})`);
    return r.json();
  }

  // ---- load region meta + crops (robust to missing files/blocks) ----
  async function loadRegionData(region){
    const basics    = await fetchJSON(`data/regions/${region}/basics.json`).catch(()=> ({}));
    const pestwatch = await fetchJSON(`data/regions/${region}/pestwatch.json`).catch(()=> ({}));

    // Try the common block filenames; ignore missing ones without exploding.
    const blockNames = [
      "alliums","roots","legumes","herbs","brassicas","salads","cucurbits",
      "nightshades","fruits","flowers","leafy","softfruit","other"
    ];
    const parts = await Promise.all(
      blockNames.map(async b=>{
        try { return await fetchJSON(`data/regions/${region}/${b}.json`); }
        catch { return []; }
      })
    );

    // Some repos store each block as an array; others as { crops:[...] }
    const cropsRaw = parts.flatMap(p => Array.isArray(p) ? p : (Array.isArray(p?.crops) ? p.crops : []));
    const crops = cropsRaw
      .filter(c => c && c.name)
      .map(normaliseCropMonths);  // make months 0–11 arrays

    return { basics, pestwatch, crops };
  }

  // ---- month normalisers ----
  function toIdxArray(v){
    // Accept: [0,1,2], [1,2,3], ["jan","feb"], { jan:true, feb:true }, "jan, feb"
    if (v == null) return [];
    if (Array.isArray(v)) {
      return v.map(x => monthToIdx(x)).filter(x => x>=0 && x<=11);
    }
    if (typeof v === 'object') {
      return Object.keys(v).map(k => monthToIdx(k)).filter(x => x>=0 && x<=11);
    }
    if (typeof v === 'string') {
      return v.split(',').map(s=>monthToIdx(s.trim())).filter(x => x>=0 && x<=11);
    }
    const n = monthToIdx(v);
    return (n>=0 && n<=11) ? [n] : [];
  }

  function monthToIdx(x){
    if (typeof x === 'number') {
      // allow 0–11 and 1–12
      if (x>=0 && x<=11) return x;
      if (x>=1 && x<=12) return x-1;
      return -1;
    }
    const s = String(x||'').trim().toLowerCase();
    if (s in NAME_TO_IDX) return NAME_TO_IDX[s];
    const n = Number(s);
    if (!Number.isNaN(n)) return monthToIdx(n);
    return -1;
  }

  function normaliseCropMonths(c){
    const m = c.months || {};
    return {
      ...c,
      months: {
        sow:     toIdxArray(m.sow),
        plant:   toIdxArray(m.plant),
        harvest: toIdxArray(m.harvest)
      }
    };
  }

  // ---- crop filter ----
  function filterCrops(crops, sel){
    const q = (sel?.q||"").toLowerCase();
    const cat = (sel?.category||"all").toLowerCase();
    const mOnly = !!sel?.monthOnly;
    const m = (new Date()).getMonth();

    return (crops||[]).filter(c=>{
      if(!c || !c.name) return false;
      if(q && !c.name.toLowerCase().includes(q)) return false;
      if(cat!=="all" && (c.category||"").toLowerCase()!==cat) return false;
      if(mOnly){
        const s=c.months?.sow?.includes(m);
        const p=c.months?.plant?.includes(m);
        const h=c.months?.harvest?.includes(m);
        if(!(s||p||h)) return false;
      }
      return true;
    });
  }

  // ---- image helper (footer icon) ----
  async function imgToDataURL(url){
    try{
      const res = await fetch(url, {cache:'no-store'});
      if(!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve,reject)=>{
        const r = new FileReader();
        r.onload = ()=> resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }catch(_){ return null; }
  }

  // ---- tiny layout helpers ----
  function sectionTitle(doc, text, x, y){
    doc.setFont("helvetica","bold");
    doc.setFontSize(12.5);
    doc.text(text, x, y);
    doc.setFont("helvetica","normal");
  }
  function blockParagraph(doc, text, x, y, maxW, lineH){
    if(!text) return y;
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y);
    return y + lines.length * lineH;
  }

  // ---- PDF builder ----
  async function buildPDF(sel){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

    const region = (sel?.region || "scotland").toLowerCase();
    const year = new Date().getFullYear();

    // Header
    doc.setFont("helvetica","bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 38, 23);
    doc.text(`Patch & Pot — Seasonal (${region[0].toUpperCase()+region.slice(1)})`, 40, 48);
    doc.setFont("helvetica","normal");
    doc.setFontSize(11.5);
    doc.setTextColor(35, 49, 39);
    doc.text(`Small-space growing calendar • ${year}`, 40, 66);

    // Data
    const data = await loadRegionData(region);
    const crops = filterCrops(data.crops, sel);

    let y = 92;

    // BASICS (print if any meaningful content)
    const hasBasics = !!(data.basics && (data.basics.soil || data.basics.tools || data.basics.notes));
    if (hasBasics){
      sectionTitle(doc, "Basics", 40, y); y += 14;
      doc.setFont("helvetica","normal");
      doc.setFontSize(10.5); doc.setTextColor(35,49,39);
      const maxW = 515, lh = 14;
      y = blockParagraph(doc, data.basics.soil   ? `Soil/Compost: ${data.basics.soil}`   : "", 40, y, maxW, lh) + 6;
      y = blockParagraph(doc, data.basics.tools  ? `Tools: ${data.basics.tools}`        : "", 40, y, maxW, lh) + 6;
      y = blockParagraph(doc, data.basics.notes  ? `Notes: ${data.basics.notes}`        : "", 40, y, maxW, lh) + 10;
    }

    // PEST WATCH (accept 0–11, 1–12, or names)
    sectionTitle(doc, "Pest Watch — Full Year", 40, y); y += 14;
    doc.setFont("helvetica","normal");
    doc.setFontSize(10.5); doc.setTextColor(35,49,39);

    const pest = data.pestwatch || {};
    for (let m = 0; m < 12; m++){
      const entry = pest[m] ?? pest[m+1] ?? pest[MONTHS[m].toLowerCase()] ?? pest[MONTHS[m]] ?? {};
      const items = Array.isArray(entry.items) ? entry.items : (Array.isArray(entry) ? entry : []);
      doc.setFont("helvetica","bold"); doc.text(`${MONTHS[m]}`, 40, y); y += 12;
      doc.setFont("helvetica","normal");
      if (items.length){
        items.forEach(line=>{
          const lines = doc.splitTextToSize(`• ${line}`, 515);
          doc.text(lines, 50, y);
          y += lines.length * 13;
        });
      } else {
        doc.text("• (No specific alerts.)", 50, y); y += 13;
      }
      y += 4;
      if (y > 700){ doc.addPage(); y = 60; }
    }

    // CALENDAR GRID
    if (y > 730){ doc.addPage(); y = 60; }
    sectionTitle(doc, "Seasonal Calendar", 40, y); y += 12;

    const head = ["Crop"].concat(MONTHS);
    const body = crops.map(c=>{
      const row = [c.name];
      for (let i=0;i<12;i++){
        const s=c.months?.sow?.includes(i);
        const p=c.months?.plant?.includes(i);
        const h=c.months?.harvest?.includes(i);
        row.push([s?"S":""," ",p?"P":""," ",h?"H":""].join("").trim());
      }
      return row;
    });

    doc.autoTable({
      startY: y+6,
      head: [head],
      body,
      theme: 'grid',
      styles: { font: "helvetica", fontSize: 9.7, halign: 'center', cellPadding: 5, minCellHeight: 20 },
      headStyles: { fillColor: [239,247,241], textColor: [20,30,24], fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { cellWidth: 180, halign: 'left', fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'head' && d.column.index > 0) d.cell.styles.fontSize = 9.5;
      }
    });

    // FOOTER (pot icon left, text centred as a block)
    const iconData = await imgToDataURL('/img/patchandpot-pot.png');
    const pageCount = doc.getNumberOfPages();
    for (let p=1; p<=pageCount; p++){
      doc.setPage(p);
      const pageH = doc.internal.pageSize.getHeight();
      const pageW = doc.internal.pageSize.getWidth();
      const footerY = pageH - 34;
      const text = '© 2025 Patch & Pot | Created by Grant Cameron Anthony';
      doc.setFont("helvetica","normal");
      doc.setFontSize(10.5);
      doc.setTextColor(35,49,39);
      const textW = doc.getTextWidth(text);
      const iconW = iconData ? 14 : 0, gap = iconData ? 8 : 0;
      const totalW = iconW + gap + textW;
      const startX = (pageW - totalW)/2;
      if (iconData) doc.addImage(iconData, 'PNG', startX, footerY-10, 14, 14);
      doc.text(text, startX + iconW + gap, footerY);
    }

    return doc;
  }

  async function generate(selection){
    const doc = await buildPDF(selection || {});
    doc.save(`patch-and-pot-seasonal-${(selection?.region||'scotland')}.pdf`);
  }

  window.PP_PDF = { generate };
})();
