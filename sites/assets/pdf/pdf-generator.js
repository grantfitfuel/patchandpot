/* global jspdf */
/* Uses CDN: jspdf@2.5.1 and jspdf-autotable@3.8.1
   Builds PDF for CURRENT REGION ONLY
   Includes: Basics, Pest Watch (Jan–Dec), Calendar grid (NO emojis)
   Footer: pot icon left of centered text
*/
(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  async function fetchJSON(url){
    const r = await fetch(`${url}?v=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error(url);
    return r.json();
  }

  async function loadRegion(region){
    const base = `data/regions/${region}`;
    // meta
    const basics = await fetchJSON(`${base}/basics.json`).catch(()=>({}));
    const pestwatch = await fetchJSON(`${base}/pestwatch.json`).catch(()=> ({}));
    // crops
    const blocks = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
    const parts = await Promise.all(blocks.map(b => fetchJSON(`${base}/${b}.json`).catch(()=>[])));
    const crops = parts.flat().filter(c => c && c.name);
    return { basics, pestwatch, crops };
  }

  function fitParagraph(doc, text, x, y, maxW, lineH){
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y);
    return y + lines.length * lineH;
  }

  async function imageToDataURL(url){
    try{
      const res = await fetch(url,{cache:'no-store'}); const blob = await res.blob();
      return await new Promise((resolve,reject)=>{
        const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=reject; fr.readAsDataURL(blob);
      });
    }catch(_){ return null; }
  }

  async function build(sel){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'a4', orientation:'portrait' });
    const region = (sel?.region || 'scotland');
    const year = new Date().getFullYear();

    // Header
    doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(15,38,23);
    doc.text(`Patch & Pot — Seasonal (${region[0].toUpperCase()+region.slice(1)})`, 40, 48);
    doc.setFont('helvetica','normal'); doc.setFontSize(11.5); doc.setTextColor(35,49,39);
    doc.text(`Small-space growing calendar • ${year}`, 40, 66);

    // Legend (text only; no emojis in PDF grid)
    doc.setFontSize(11);
    doc.text(`Sow • Plant • Harvest`, 40, 86);

    // Data
    const data = await loadRegion(region);

    let y = 108;

    // BASICS
    if (data.basics && (data.basics.soil || data.basics.tools || data.basics.notes)){
      doc.setFont('helvetica','bold'); doc.setFontSize(12.5);
      doc.text('Basics', 40, y); y += 14;

      doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
      const maxW=515, lh=14;
      if (data.basics.soil)  y = fitParagraph(doc, `Soil/Compost: ${data.basics.soil}`, 40, y, maxW, lh)+6;
      if (data.basics.tools) y = fitParagraph(doc, `Tools: ${data.basics.tools}`, 40, y, maxW, lh)+6;
      if (data.basics.notes) y = fitParagraph(doc, `Notes: ${data.basics.notes}`, 40, y, maxW, lh)+10;
    }

    // PEST WATCH — full year
    doc.setFont('helvetica','bold'); doc.setFontSize(12.5);
    doc.text('Pest Watch — Full Year', 40, y); y += 14;
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5);

    for (let m=0; m<12; m++){
      const entry = data.pestwatch && data.pestwatch[String(m)];
      const items = entry?.items || [];
      doc.setFont('helvetica','bold'); doc.text(MONTHS[m], 40, y); y += 12;
      doc.setFont('helvetica','normal');

      if(items.length){
        items.forEach(line=>{
          const lines = doc.splitTextToSize(`• ${line}`, 515);
          doc.text(lines, 50, y);
          y += lines.length * 13;
        });
      }else{
        doc.text('• (No specific alerts.)', 50, y);
        y += 13;
      }
      y += 4;
      if (y > 730){ doc.addPage(); y = 60; }
    }

    // CALENDAR GRID (no emojis)
    if (y > 730){ doc.addPage(); y = 60; }
    doc.setFont('helvetica','bold'); doc.setFontSize(12.5);
    doc.text('Seasonal Calendar', 40, y); y += 10;

    const head = ['Crop'].concat(MONTHS);
    const body = (data.crops||[]).map(c=>{
      const row=[c.name];
      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        // Use letters to avoid emoji rendering issues on some PDF engines
        const marks = [s?'S':'',p?'P':'',h?'H':''].filter(Boolean).join('');
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
        fontSize: 9.6,
        halign: 'center',
        cellPadding: 5,
        minCellHeight: 22   // taller rows so long crop names don’t collide
      },
      headStyles: {
        fillColor: [239,247,241],
        textColor: [20,30,24],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 170, halign: 'left', fontStyle: 'bold' } // crop names
      }
    });

    // FOOTER (icon left + text; center as a unit)
    const iconData = await imageToDataURL('img/patchandpot-icon.png');
    const footerY = doc.internal.pageSize.getHeight() - 42;
    const text = '© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(35,49,39);
    const textW = doc.getTextWidth(text);
    const iconW = iconData ? 14 : 0; const gap = iconData ? 8 : 0;
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
    const doc = await build(selection || {});
    doc.save(`patch-and-pot-seasonal-${(selection?.region||'scotland')}.pdf`);
  }

  window.PP_PDF = { generate };
})();
