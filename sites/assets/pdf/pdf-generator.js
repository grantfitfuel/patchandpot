/* Patch & Pot — PDF Generator (A4, portrait/landscape), emoji grid, taller rows */
(function(){
  const PP_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const POT_ICON = 'img/patchandpot-icon.png'; // small inline in footer

  /* data loader (reads JSON from /sites/data/regions/<region>/*) */
  function fetchJSON(url){ return fetch(url+`?v=${Date.now()}`, {cache:'no-store'}).then(r=>r.json()); }
  async function loadRegion(region){
    const base = `data/regions/${region}/`;
    const [basics, pestwatch, ...parts] = await Promise.all([
      fetchJSON(base+'basics.json').catch(()=>({})),
      fetchJSON(base+'pestwatch.json').catch(()=>({})),
      ...['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'].map(b=>fetchJSON(base+b+'.json').catch(()=>[]))
    ]);
    const crops = parts.flat().filter(c=>c && c.name);
    return { basics, pestwatch, crops };
  }

  /* filtering logic mirrors page */
  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|gooseber|currant|blueber|fig|apple|pear|plum|cherry|rhubarb|tomatillo|cape gooseberry)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|rosemary|stevia)/.test(n))return"herbs";
    return "other";
  }
  function applyFilters(crops, {category,q}){
    const qq=(q||'').toLowerCase();
    return (crops||[]).filter(c=>{
      const cat=c.category||inferCategory(c.name);
      if(category && category!=='all' && cat!==category) return false;
      if(qq && !(c.name||'').toLowerCase().includes(qq)) return false;
      return true;
    });
  }

  /* footer (small pot + brand inline, centred) */
  async function drawFooter(doc,pageWidth,pageHeight){
    const y = pageHeight - 10;
    // small text
    doc.setFont('helvetica','normal').setFontSize(9);
    const text = '© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    const textWidth = doc.getTextWidth(text);
    const cx = pageWidth/2;

    // optional pot icon (if it fails, just text)
    try {
      // Put pot 8x8mm to the left of text
      const potW=6, potH=6;
      const totalW = potW + 2 + textWidth;
      const startX = cx - totalW/2;
      const imgX = startX, imgY = y - potH + 1.5;
      doc.addImage(POT_ICON, 'PNG', imgX, imgY, potW, potH);
      doc.text(text, startX + potW + 2, y);
    } catch {
      doc.text(text, cx - textWidth/2, y);
    }
  }

  function legendLine(doc, x, y){
    doc.setFont('helvetica','bold').setFontSize(11);
    doc.text('🌱 Sow   🪴 Plant   🥕 Harvest', x, y);
  }

  function titleBar(doc, pageWidth, text){
    // green bar with dark text
    const m = 12;
    const h = 10;
    doc.setFillColor(46,125,50); // brand green
    doc.roundedRect(m, m, pageWidth - m*2, h, 2, 2, 'F');
    doc.setFont('helvetica','bold').setFontSize(13).setTextColor(0,0,0);
    doc.text(text, m+4, m + 7);
    doc.setTextColor(0,0,0);
  }

  function monthHeaderRow(){
    return [{content:'Crop', styles:{halign:'left'}}].concat(PP_MONTHS.map(m=>({content:m, styles:{halign:'center'}})));
  }

  function cropRow(crop){
    const marks = (i)=> {
      const s=(crop.months?.sow||[]).includes(i);
      const p=(crop.months?.plant||[]).includes(i);
      const h=(crop.months?.harvest||[]).includes(i);
      return (s?'🌱':'') + (p?' 🪴':'') + (h?' 🥕':'');
    };
    return [{content:`${crop.name}\n(${crop.category||inferCategory(crop.name)})`, styles:{halign:'left'}}]
      .concat(PP_MONTHS.map((_,i)=>({content:marks(i).trim(), styles:{halign:'center'}})));
  }

  function buildTableBody(crops){
    return crops.map(c=>cropRow(c));
  }

  async function addBasicsAndPest(doc, regionKey, basics, pestwatch, pageWidth){
    const m=16, y0=28;
    doc.setFillColor(27,34,31);
    doc.setDrawColor(126,212,149);
    doc.roundedRect(m, y0, pageWidth - m*2, 30, 3, 3, 'F'); // dark block
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold').setFontSize(12);
    doc.text('Basics', m+6, y0+8);
    doc.setFont('helvetica','normal').setFontSize(11);

    const basicsText = (basics?.text) ? basics.text
      : (Array.isArray(basics?.tips) ? basics.tips.join('  •  ')
      : 'Good hygiene, drainage, right pot size, and consistent watering.');

    const wrapWidth = pageWidth - m*2 - 12;
    doc.text(doc.splitTextToSize(basicsText, wrapWidth), m+6, y0+14);

    // Pest Watch (current month)
    const cur = new Date().getMonth();
    const items = (pestwatch && pestwatch[String(cur)] && pestwatch[String(cur)].items) || ['Keep an eye on slugs after rain.'];

    let y = y0 + 30 + 6;
    doc.setFont('helvetica','bold').setFontSize(12);
    doc.setTextColor(255,255,255);
    doc.text(`Pest Watch — ${regionKey[0].toUpperCase()+regionKey.slice(1)}`, m+6, y);
    doc.setFont('helvetica','normal').setFontSize(11);

    y += 5;
    doc.setTextColor(220,235,225);
    items.forEach(line=>{
      doc.text(`• ${line}`, m+8, y);
      y += 5;
    });

    // footer on this page
    const {w,h} = doc.internal.pageSize;
    await drawFooter(doc, w, h);
  }

  async function addCropTables(doc, crops, regionKey, page, includeLegend){
    const isPortrait = page !== 'landscape';
    const margin = 10; // mm
    const {w:PW, h:PH} = doc.internal.pageSize;

    // column widths tuned so month headers never wrap
    // available inner width:
    const innerW = (isPortrait ? 190 : 277) - margin*0; // jsPDF A4 inner width approx; we’ll still set columnStyles explicitly
    const monthW = isPortrait ? 12 : 16; // keep headers visible
    const cropW  = isPortrait ? 72 : 90;

    const head = [ monthHeaderRow() ];
    const body = buildTableBody(crops);

    // Title strip + legend
    titleBar(doc, PW, `Seasonal Planting — ${regionKey[0].toUpperCase()+regionKey.slice(1)}`);
    if (includeLegend) legendLine(doc, 12, 26);

    doc.autoTable({
      head,
      body,
      startY: 32,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 10,
        cellPadding: 2.2,
        minCellHeight: 9.5,      // row height (taller than before)
        lineWidth: 0.15,
        textColor: [0,0,0]
      },
      headStyles: {
        fillColor: [46,125,50], // brand green header
        textColor: [0,0,0],
        lineWidth: 0.15
      },
      alternateRowStyles: { fillColor: [242,248,245] },
      columnStyles: Object.assign(
        { 0: { cellWidth: cropW, halign: 'left' } },
        ...PP_MONTHS.map((_,i)=>({ [i+1]: { cellWidth: monthW, halign: 'center' } }))
      ),
      willDrawCell: (data)=>{ /* noop */ },
      didDrawPage: async (data)=>{
        // small footer on each page
        const {w,h} = doc.internal.pageSize;
        await drawFooter(doc, w, h);
      },
      pageBreak: 'auto',
      rowPageBreak: 'auto',
      tableWidth: 'wrap'
    });
  }

  async function buildPdf({region, category, q, page='portrait', includeBasics=true}){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: (page==='landscape'?'landscape':'portrait'), unit: 'mm', format: 'a4', compress: true });

    const regionKey = (region||'scotland').toLowerCase();
    const data = await loadRegion(regionKey);
    const filtered = applyFilters(data.crops, {category, q});

    // Optionally add Basics & Pest page (page 1)
    if(includeBasics){
      titleBar(doc, doc.internal.pageSize.getWidth(), `Seasonal Planting — ${regionKey[0].toUpperCase()+regionKey.slice(1)}`);
      await addBasicsAndPest(doc, regionKey, data.basics, data.pestwatch, doc.internal.pageSize.getWidth());
      doc.addPage(doc.internal.pageSize.getWidth()>doc.internal.pageSize.getHeight()?'landscape':'p'); // next page
    }

    await addCropTables(doc, filtered, regionKey, page, !includeBasics);

    // Save
    const nice = (s)=>s[0].toUpperCase()+s.slice(1);
    doc.save(`Patch&Pot_Seasonal_${nice(regionKey)}.pdf`);
  }

  window.PP_PDF = {
    async generate(sel){
      await buildPdf(sel||{region:'scotland', page:'portrait', includeBasics:true});
    }
  };
})();
