/* Patch & Pot • PDF Generator (on-brand, iOS-safe, no emoji)
   - Landscape/Portrait chooser
   - Optional intro page (Basics + current-month Pest Watch)
   - Clean grid with S/P/H marks, zebra rows, repeat header, safe page breaks
   - Centred footer with logo (above) + text (below)
*/
(function(){
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ---------- helpers ----------
  const titleCase = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : '';
  const now = new Date(); const CUR_M = now.getMonth();

  function fetchJSON(url){
    return fetch(url + (url.includes('?')?'':'?v=' + Date.now()), {cache:'no-store'})
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP '+r.status+' for '+url)));
  }

  async function loadRegion(region){
    const base = `data/regions/${region}/`;
    const blocks = ['basics','pestwatch','roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'];
    const results = await Promise.all(blocks.map(b =>
      fetchJSON(base + b + '.json').catch(()=> (b==='basics'||b==='pestwatch') ? {} : [])
    ));
    const [basics, pestwatch, ...cropBlocks] = results;
    const crops = cropBlocks.reduce((acc, blk)=> Array.isArray(blk) ? acc.concat(blk) : acc, []);
    return { basics, pestwatch, crops };
  }

  function applyFilters(crops, sel){
    const q = (sel.q||'').toLowerCase();
    const cat = sel.category || 'all';
    return (crops||[])
      .filter(c => c && c.name)
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .filter(c => cat==='all' || (c.category||'').toLowerCase()===cat)
      .sort((a,b)=> a.name.localeCompare(b.name));
  }

  function monthMarks(crop){
    const marks = new Array(12).fill('');
    const m = crop.months || {};
    (m.sow||[]).forEach(i => marks[i] = (marks[i]?marks[i]+' ':'') + 'S');
    (m.plant||[]).forEach(i => marks[i] = (marks[i]?marks[i]+' ':'') + 'P');
    (m.harvest||[]).forEach(i => marks[i] = (marks[i]?marks[i]+' ':'') + 'H');
    return marks;
  }

  function splitText(doc, text, maxWidth, fontSize){
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text || '', maxWidth);
  }

  function loadImageAsDataURL(src){
    return fetch(src, {cache:'no-store'})
      .then(r => r.ok ? r.blob() : Promise.reject(new Error('Logo not found')))
      .then(blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }));
  }

  // ---------- drawing ----------
  function drawFooter(doc, pw, ph, margin, logoDataURL){
    const y = ph - margin + 2;
    const logoH = 8; // mm
    if (logoDataURL){
      const logoW = logoH; // square icon
      doc.addImage(logoDataURL, 'PNG', (pw - logoW)/2, y - logoH - 3, logoW, logoH, undefined, 'FAST');
    }
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40,40,40);
    doc.text('© 2025 Patch & Pot | Created by Grant Cameron Anthony', pw/2, ph - margin + 8, {align:'center'});
  }

  function drawHeaderBar(doc, leftX, topY, width){
    // subtle green brand bar
    doc.setFillColor(46,125,50);      // --green rgb approx
    doc.setDrawColor(46,125,50);
    doc.roundedRect(leftX, topY - 9, width, 7, 2, 2, 'F');
  }

  function drawTableHeader(doc, leftX, y, firstColW, colW, headH, tableW){
    doc.setFillColor(243,247,245);
    doc.setDrawColor(220,226,220);
    doc.rect(leftX, y, tableW, headH, 'FD');

    doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
    doc.setFontSize(10);
    doc.text('Crop', leftX + 2.2, y + 5.8);

    doc.setFontSize(9);
    for(let i=0;i<12;i++){
      const x = leftX + firstColW + i*colW;
      doc.line(x, y, x, y + headH); // vertical separators
      doc.text(MONTHS[i], x + colW/2, y + 5.6, {align:'center'});
    }
    // right edge
    doc.line(leftX + tableW, y, leftX + tableW, y + headH);
  }

  function drawIntroPage(doc, pw, margin, sel, basics, pestwatch){
    const maxW = pw - margin*2;
    let y = margin + 12;

    // Title + legend line
    doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0);
    doc.setFontSize(20);
    doc.text(`Seasonal Planting — ${titleCase(sel.region)}`, margin, y);
    y += 7;

    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    const filterLine = `Filter: ${sel.category==='all'?'All categories':titleCase(sel.category)}${sel.q? ' • Search: '+sel.q : ''}`;
    doc.text(filterLine, margin, y);
    doc.text('Legend: S = Sow   P = Plant   H = Harvest', margin + maxW, y, {align:'right'});
    y += 6;

    // Basics (if present)
    const hasBasics = basics && (basics.containers || basics.sun || basics.soil || basics.tips);
    if (hasBasics){
      doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.text('Basics (Small-space Growing)', margin, y); y += 4;

      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      const chunks = [];
      if (basics.containers) chunks.push(`Containers: ${basics.containers}`);
      if (basics.sun)        chunks.push(`Light: ${basics.sun}`);
      if (basics.soil)       chunks.push(`Soil: ${basics.soil}`);
      if (basics.tips)       chunks.push(`Tips: ${basics.tips}`);

      chunks.forEach(txt=>{
        const lines = doc.splitTextToSize(txt, maxW);
        doc.text(lines, margin, y);
        y += lines.length*4 + 2;
      });
      y += 2;
    }

    // Pest Watch (current month)
    const monthEntry = (pestwatch && pestwatch[String(CUR_M)]) || null;
    if (monthEntry && monthEntry.items && monthEntry.items.length){
      doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.text(`Pest Watch — ${MONTHS[CUR_M]}`, margin, y); y += 4;

      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      monthEntry.items.forEach(item=>{
        const bullets = doc.splitTextToSize('• ' + item, maxW);
        doc.text(bullets, margin, y);
        y += bullets.length*4 + 1;
      });
    }
  }

  function drawGridPages(doc, sel, crops, logoDataURL){
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 12;
    const leftX = margin;
    const topY = margin + 22;

    const firstColW = 64;                       // crop column
    const tableW = pw - margin - leftX;
    const monthsW = tableW - firstColW;
    const colW = Math.floor((monthsW / 12) * 100) / 100;  // round to avoid float drift
    const actualTableW = firstColW + (colW * 12);         // fully aligned width
    const rowH = 7.4;                          // row height
    const headH = 9.2;                         // header height
    const bottomLimit = ph - margin - 14;      // leave space for footer

    // header ribbon
    drawHeaderBar(doc, leftX, topY, actualTableW);

    // header row
    let y = topY;
    drawTableHeader(doc, leftX, y, firstColW, colW, headH, actualTableW);
    y += headH;

    // rows
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
    crops.forEach((c, idx) => {
      // page break check
      if (y + rowH > bottomLimit){
        drawFooter(doc, pw, ph, margin, logoDataURL);
        doc.addPage(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight() ? 'a4':'a4', doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight() ? 'landscape':'portrait');

        // new page header
        drawHeaderBar(doc, leftX, topY, actualTableW);
        y = topY;
        drawTableHeader(doc, leftX, y, firstColW, colW, headH, actualTableW);
        y += headH;
      }

      // zebra row
      if (idx % 2 === 0){
        doc.setFillColor(248,250,249);
        doc.rect(leftX, y, actualTableW, rowH, 'F');
      }

      // crop name + tag (two lines)
      const nameX = leftX + 2;
      const nameY = y + 4.8;
      doc.text(c.name, nameX, nameY);
      doc.setFontSize(8); doc.setTextColor(90,100,95);
      doc.text(`(${(c.category||'').toUpperCase()})`, nameX, nameY + 3.2);
      doc.setFontSize(10); doc.setTextColor(0,0,0);

      // cells
      const marks = monthMarks(c);
      for (let i=0; i<12; i++){
        const x = leftX + firstColW + i*colW;
        doc.setDrawColor(230,235,230);
        doc.rect(x, y, colW, rowH);
        const m = marks[i];
        if (m){
          doc.setFont('helvetica','bold'); doc.setFontSize(10);
          doc.text(m, x + colW/2, y + 4.7, {align:'center'});
          doc.setFont('helvetica','normal');
        }
      }
      y += rowH;
    });

    drawFooter(doc, pw, ph, margin, logoDataURL);
  }

  async function buildPDF(sel, includeIntro=true){
    const region = (sel.region || 'scotland').toLowerCase();
    const data = await loadRegion(region);
    const crops = applyFilters(data.crops, sel);

    // Orientation chooser (quick, no UI clutter)
    const wantLandscape = window.confirm('Create PDF in Landscape? (Cancel for Portrait)');
    const orientation = wantLandscape ? 'landscape' : 'portrait';

    // init jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({orientation, unit:'mm', format:'a4'});

    // preload logo (optional)
    let logoDataURL = null;
    try { logoDataURL = await loadImageAsDataURL('img/patchandpot-icon.png'); } catch(_) {}

    // Intro page
    if (includeIntro){
      const margin = 14;
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();

      drawIntroPage(doc, pw, margin, sel, data.basics || {}, data.pestwatch || {});
      // footer on intro
      drawFooter(doc, pw, ph, margin, logoDataURL);
      doc.addPage('a4', orientation);
    }

    // Grid pages
    drawGridPages(doc, sel, crops, logoDataURL);

    // filename
    const file = `PatchAndPot-${titleCase(sel.region)}-${sel.category==='all'?'All':titleCase(sel.category)}.pdf`;
    doc.save(file);
  }

  // ---------- public API ----------
  window.PP_PDF = {
    generate: async function(sel){
      if (!window.jspdf || !window.jspdf.jsPDF){
        alert('PDF engine not found'); return;
      }
      try{
        await buildPDF(sel, /*includeIntro*/ true);
      }catch(err){
        console.error(err);
        alert('Sorry, PDF generation failed.');
      }
    }
  };
})();
