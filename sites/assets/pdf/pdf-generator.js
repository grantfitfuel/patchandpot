/* global jspdf */
/* PDF generator (no emojis). Requires jsPDF + AutoTable already loaded (CDN in seasonal.html). */
(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  async function fetchJSON(url){
    const r = await fetch(url + `?v=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error(`Failed ${url}`);
    return r.json();
  }
  async function loadRegionData(region){
    // basics + pestwatch
    const basics = await fetchJSON(`/data/regions/${region}/basics.json`).catch(()=>({}));
    const pestwatch = await fetchJSON(`/data/regions/${region}/pestwatch.json`).catch(()=> ({}));
    // crops – all blocks
    const blocks = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
    const parts = await Promise.all(blocks.map(b =>
      fetchJSON(`/data/regions/${region}/${b}.json`).catch(()=>[])
    ));
    const crops = parts.flat().filter(c => c && c.name);
    return { basics, pestwatch, crops };
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
    const q=(sel.q||"").toLowerCase();
    const cat=sel.category||"all";
    const mOnly=!!sel.monthOnly;
    const m=(new Date()).getMonth();
    return (crops||[]).filter(c=>{
      if(!c || !c.name) return false;
      if(q && !c.name.toLowerCase().includes(q)) return false;
      if(cat!=="all" && (c.category||inferCategory(c.name))!==cat) return false;
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
  function sectionTitle(doc, text, x, y){
    doc.setFont("helvetica","bold");
    doc.setFontSize(13);
    doc.text(text, x, y);
    doc.setFont("helvetica","normal");
  }
  function para(doc, text, x, y, maxW, lineH){
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y);
    return y + lines.length * lineH;
  }

  async function buildPDF(sel){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

    const region = sel.region || "scotland";
    const year = new Date().getFullYear();

    // Title
    doc.setFont("helvetica","bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 38, 23); // dark green heading
    doc.text(`Patch & Pot — Seasonal (${region[0].toUpperCase()+region.slice(1)})`, 40, 48);
    doc.setFont("helvetica","normal");
    doc.setFontSize(11.5);
    doc.setTextColor(35, 49, 39);
    doc.text(`Small-space growing calendar • ${year}`, 40, 66);

    // Legend (no emojis)
    doc.setFontSize(11);
    doc.text(`Legend: S = Sow, P = Plant, H = Harvest`, 40, 86);

    // Data
    const data = await loadRegionData(region);
    const crops = filterCrops(data.crops, sel);

    let y = 108;
    const maxW = 515, lh = 14;

    // BASICS
    if (data.basics && (data.basics.soil || data.basics.tools || data.basics.notes)) {
      sectionTitle(doc, "Basics", 40, y); y += 16;
      doc.setFont("helvetica","normal");
      doc.setFontSize(10.5); doc.setTextColor(35,49,39);

      if (data.basics.soil)   { y = para(doc, `Soil/Compost: ${data.basics.soil}`, 40, y, maxW, lh) + 6; }
      if (data.basics.tools)  { y = para(doc, `Tools: ${data.basics.tools}`, 40, y, maxW, lh) + 6; }
      if (data.basics.notes)  { y = para(doc, `Notes: ${data.basics.notes}`, 40, y, maxW, lh) + 10; }
    }

    // PEST WATCH – full year
    sectionTitle(doc, "Pest Watch — Jan to Dec", 40, y); y += 16;
    doc.setFont("helvetica","normal"); doc.setFontSize(10.5);
    for (let m = 0; m < 12; m++){
      const entry = data.pestwatch && data.pestwatch[String(m)];
      const items = entry?.items || [];
      doc.setFont("helvetica","bold");
      doc.text(`${MONTHS[m]}`, 40, y); y += 12;
      doc.setFont("helvetica","normal");
      if (items.length){
        items.forEach(line=>{
          const lines = doc.splitTextToSize(`• ${line}`, maxW);
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

    // CALENDAR GRID
    if (y > 730){ doc.addPage(); y = 60; }
    sectionTitle(doc, "Seasonal Calendar", 40, y); y += 10;

    const head = ["Crop"].concat(MONTHS);
    const body = crops.map(c=>{
      const row = [c.name];
      for (let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks=[s?"S":"",p?"P":"",h?"H":""].filter(Boolean).join(" ");
        row.push(marks);
      }
      return row;
    });

    doc.autoTable({
      startY: y + 6,
      head: [head],
      body,
      theme: 'grid',
      styles: {
        font: "helvetica",
        fontSize: 9.6,
        halign: 'center',
        cellPadding: 5,
        minCellHeight: 22 /* TALLER rows for long names */
      },
      headStyles: {
        fillColor: [239,247,241],
        textColor: [20,30,24],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 170, halign: 'left', fontStyle: 'bold' } // wider crop-name column
      }
    });

    // FOOTER (pot icon left, text to right; both centred as a unit)
    const iconData = await imgToDataURL('/img/patchandpot-icon.png');
    const footerY = doc.internal.pageSize.getHeight() - 42;
    const text = '© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    doc.setFont("helvetica","normal");
    doc.setFontSize(10.5);
    doc.setTextColor(35,49,39);
    const textW = doc.getTextWidth(text);
    const iconW = iconData ? 16 : 0;
    const gap = iconData ? 8 : 0;
    const totalW = iconW + gap + textW;
    const pageW = doc.internal.pageSize.getWidth();
    const startX = (pageW - totalW)/2;

    if (iconData){
      doc.addImage(iconData, 'PNG', startX, footerY-12, 16, 16);
      doc.text(text, startX + iconW + gap, footerY);
    }else{
      doc.text(text, (pageW - textW)/2, footerY);
    }

    return doc;
  }

  async function generate(selection){
    const doc = await buildPDF(selection || {});
    const region = (selection?.region || 'scotland');
    doc.save(`patch-and-pot-seasonal-${region}.pdf`);
  }

  window.PP_PDF = { generate };
})();
