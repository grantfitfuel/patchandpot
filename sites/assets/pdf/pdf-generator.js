/* Patch & Pot – seasonal PDF (A4 portrait)
   Requires: jsPDF 2.5.x (UMD) + jsPDF-AutoTable 3.8.x (already loaded via CDN)
*/
(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const GLYPHS = { sow:"🌱", plant:"🪴", harvest:"🥕" };

  function nowYear(){ return new Date().getFullYear(); }

  async function fetchJSON(url){
    const r = await fetch(`${url}?v=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error(`Failed ${url}`);
    return r.json();
  }

  async function loadRegionData(region){
    const meta = await Promise.allSettled([
      fetchJSON(`data/regions/${region}/basics.json`),
      fetchJSON(`data/regions/${region}/pestwatch.json`)
    ]);
    const basics = meta[0].status==='fulfilled' ? meta[0].value : {};
    const pestwatch = meta[1].status==='fulfilled' ? meta[1].value : {};

    const blocks = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
    const parts = await Promise.all(blocks.map(b =>
      fetchJSON(`data/regions/${region}/${b}.json`).catch(()=>[])
    ));
    const crops = parts.flat().filter(c=>c && c.name);
    return {basics, pestwatch, crops};
  }

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return"other";
  }

  function filterCrops(crops, sel){
    const q = (sel.q||"").toLowerCase();
    const cat = sel.category || "all";
    const mOnly = !!sel.monthOnly;
    const m = (new Date()).getMonth();
    return (crops||[]).filter(c=>{
      if(!c || !c.name) return false;
      if(q && !c.name.toLowerCase().includes(q)) return false;
      const infer = c.category || inferCategory(c.name);
      if(cat!=="all" && infer!==cat) return false;
      if(mOnly){
        const s=(c.months?.sow||[]).includes(m);
        const p=(c.months?.plant||[]).includes(m);
        const h=(c.months?.harvest||[]).includes(m);
        if(!(s||p||h)) return false;
      }
      return true;
    });
  }

  async function imgToDataURL(url){
    try{
      const res = await fetch(url, {cache:'no-store'});
      const blob = await res.blob();
      return await new Promise((resolve,reject)=>{
        const r = new FileReader();
        r.onload = ()=> resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }catch(_){ return null; }
  }

  function H1(doc, text, y){
    doc.setFont("helvetica","bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 38, 23);
    doc.text(text, 40, y);
    doc.setFont("helvetica","normal");
  }
  function H2(doc, text, y){
    doc.setFont("helvetica","bold");
    doc.setFontSize(12.5);
    doc.setTextColor(15, 38, 23);
    doc.text(text, 40, y);
    doc.setFont("helvetica","normal");
  }
  function pText(doc, text, x, y, maxW, lineH){
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y);
    return y + lines.length * lineH;
  }

  async function buildPDF(sel){
    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if(!jsPDFCtor) throw new Error("jsPDF not present");

    const doc = new jsPDFCtor({ unit: "pt", format: "a4", orientation: "portrait" });

    const region = sel.region || "scotland";
    const year = nowYear();

    // Header
    H1(doc, `Patch & Pot — Seasonal (${region[0].toUpperCase()+region.slice(1)})`, 48);
    doc.setFont("helvetica","normal");
    doc.setFontSize(11.5);
    doc.setTextColor(35, 49, 39);
    doc.text(`Small-space growing calendar • ${year}`, 40, 66);

    // Legend
    doc.setFontSize(11);
    doc.setTextColor(30, 40, 35);
    doc.text(`${GLYPHS.sow} Sow    ${GLYPHS.plant} Plant    ${GLYPHS.harvest} Harvest`, 40, 86);

    // Region data
    const data = await loadRegionData(region);
    const crops = filterCrops(data.crops, sel);

    let y = 108; // cursor

    // Basics
    if (data.basics && (data.basics.soil || data.basics.tools || data.basics.notes)) {
      H2(doc, "Basics", y); y += 14;
      doc.setFontSize(10.5); doc.setTextColor(35,49,39);
      const maxW = 515, lh = 14;
      if (data.basics.soil)   { y = pText(doc, `Soil/Compost: ${data.basics.soil}`, 40, y, maxW, lh) + 6; }
      if (data.basics.tools)  { y = pText(doc, `Tools: ${data.basics.tools}`, 40, y, maxW, lh) + 6; }
      if (data.basics.notes)  { y = pText(doc, `Notes: ${data.basics.notes}`, 40, y, maxW, lh) + 10; }
    }

    // Full-year Pest Watch
    H2(doc, "Pest Watch — Full Year", y); y += 14;
    doc.setFontSize(10.5); doc.setTextColor(35,49,39);

    for (let m = 0; m < 12; m++){
      const entry = data.pestwatch && data.pestwatch[String(m)];
      const items = entry?.items || [];
      doc.setFont("helvetica","bold");
      doc.text(`${MONTHS[m]}`, 40, y); y += 12;
      doc.setFont("helvetica","normal");

      if (items.length){
        items.forEach(line=>{
          const lines = doc.splitTextToSize(`• ${line}`, 515);
          doc.text(lines, 50, y);
          y += lines.length * 13;
        });
      }else{
        doc.text("• (No specific alerts.)", 50, y);
        y += 13;
      }
      y += 4;
      if (y > 700){ doc.addPage(); y = 60; }
    }

    // Calendar table
    if (y > 730){ doc.addPage(); y = 60; }
    H2(doc, "Seasonal Calendar", y); y += 12;

    const head = ["Crop"].concat(MONTHS);
    const body = crops.map(c=>{
      const row = [c.name];
      for (let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks=[s?GLYPHS.sow:"",p?GLYPHS.plant:"",h?GLYPHS.harvest:""].filter(Boolean).join(" ");
        row.push(marks);
      }
      return row;
    });

    doc.autoTable({
      startY: y+6,
      head: [head],
      body,
      theme: 'grid',
      styles: {
        font: "helvetica",
        fontSize: 9.2,
        halign: 'center',
        cellPadding: 4,
        minCellHeight: 16
      },
      headStyles: {
        fillColor: [239,247,241],
        textColor: [20,30,24],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 160, halign: 'left', fontStyle: 'bold' }
      }
    });

    // Footer (pot icon to the LEFT of text, whole block centred)
    const iconData = await imgToDataURL('img/patchandpot-icon.png');
    const footerY = doc.internal.pageSize.getHeight() - 42;
    const text = '© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    doc.setFont("helvetica","normal");
    doc.setFontSize(10.5);
    doc.setTextColor(35,49,39);
    const textW = doc.getTextWidth(text);
    const iconW = iconData ? 14 : 0;
    const gap = iconData ? 8 : 0;
    const totalW = iconW + gap + textW;
    const pageW = doc.internal.pageSize.getWidth();
    const startX = (pageW - totalW)/2;

    if (iconData){
      doc.addImage(iconData, 'PNG', startX, footerY-11, 14, 14);
      doc.text(text, startX + iconW + gap, footerY);
    }else{
      doc.text(text, (pageW - textW)/2, footerY);
    }

    return doc;
  }

  async function generate(selection){
    const doc = await buildPDF(selection || {});
    const region = (selection?.region||'scotland');
    doc.save(`patch-and-pot-seasonal-${region}.pdf`);
  }

  window.PP_PDF = { generate };
})();
