/* global jspdf */
/* Requires local files:
   - assets/pdf/jspdf.umd.min.js
   - assets/pdf/jspdf.plugin.autotable.min.js
*/
(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const GLYPHS = { sow:"🌱", plant:"🪴", harvest:"🥕" };

  const fetchJSON = (url) =>
    fetch(`${url}?v=${Date.now()}`, { cache:'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`Failed to load ${url}`)));

  async function loadRegionData(region){
    const basics = await fetchJSON(`data/regions/${region}/basics.json`).catch(()=>({}));
    const pestwatch = await fetchJSON(`data/regions/${region}/pestwatch.json`).catch(()=>({}));
    const parts = await Promise.all(
      ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"]
        .map(b => fetchJSON(`data/regions/${region}/${b}.json`).catch(()=>[]))
    );
    const crops = parts.flat().filter(c => c && c.name);
    return { basics, pestwatch, crops };
  }

  function filterCrops(crops, sel){
    const q = (sel.q||"").toLowerCase();
    const cat = sel.category || "all";
    const mOnly = !!sel.monthOnly;
    const m = (new Date()).getMonth();
    return (crops||[]).filter(c=>{
      if(!c || !c.name) return false;
      if(q && !c.name.toLowerCase().includes(q)) return false;
      if(cat!=="all" && (c.category||"").toLowerCase()!==cat) return false;
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
    doc.setFontSize(12.5);
    doc.text(text, x, y);
    doc.setFont("helvetica","normal");
  }
  function blockParagraph(doc, text, x, y, maxW, lineH){
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y);
    return y + lines.length * lineH;
  }

  async function buildPDF(sel){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

    const region = sel.region || "scotland";
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

    // Legend
    doc.setFontSize(11);
    doc.setTextColor(30, 40, 35);
    doc.text(`${GLYPHS.sow} Sow    ${GLYPHS.plant} Plant    ${GLYPHS.harvest} Harvest`, 40, 86);

    // Data
    const data = await loadRegionData(region);
    const crops = filterCrops(data.crops, sel);

    let y = 108;

    // Basics (optional)
    if (data.basics && (data.basics.soil || data.basics.tools || data.basics.notes)) {
      sectionTitle(doc, "Basics", 40, y); y += 14;
      doc.setFont("helvetica","normal");
      doc.setFontSize(10.5); doc.setTextColor(35,49,39);
      const maxW = 515, lh = 14;

      if (data.basics.soil)   { y = blockParagraph(doc, `Soil/Compost: ${data.basics.soil}`, 40, y, maxW, lh) + 6; }
      if (data.basics.tools)  { y = blockParagraph(doc, `Tools: ${data.basics.tools}`, 40, y, maxW, lh) + 6; }
      if (data.basics.notes)  { y = blockParagraph(doc, `Notes: ${data.basics.notes}`, 40, y, maxW, lh) + 10; }
    }

    // Pest Watch (full year)
    sectionTitle(doc, "Pest Watch — Full Year", 40, y); y += 14;
    doc.setFont("helvetica","normal");
    doc.setFontSize(10.5); doc.setTextColor(35,49,39);

    for (let m = 0; m < 12; m++){
      const entry = data.pestwatch && data.pestwatch[String(m)];
      const items = entry?.items || [];
      doc.setFont("helvetica","bold");
      doc.text(`${MONTHS[m]}`, 40, y); y += 12;
      doc.setFont("helvetica","normal");

      if (items.length){
        items.forEach(line=>{
          const bullet = `• ${line}`;
          const lines = doc.splitTextToSize(bullet, 515);
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
    sectionTitle(doc, "Seasonal Calendar", 40, y); y += 12;

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
        minCellHeight: 18
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

    // Footer: icon left + text, all centered
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
    doc.save(`patch-and-pot-seasonal-${(selection?.region||'scotland')}.pdf`);
  }

  window.PP_PDF = { generate };
})();
