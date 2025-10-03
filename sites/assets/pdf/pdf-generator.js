/* Patch & Pot PDF generator – jsPDF only (no emoji for iOS reliability) */
(function(){
  function titleCase(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }

  // fetch helpers (cache-busted)
  function fetchJSON(url){
    return fetch(url + (url.includes('?')?'':'?v=' + Date.now()), {cache:'no-store'})
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status + ' for ' + url)));
  }

  async function loadRegion(region){
    const base = `data/regions/${region}/`;
    const blocks = ['basics','pestwatch','roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'];
    const results = await Promise.all(blocks.map(b =>
      fetchJSON(base + b + '.json').catch(()=> (b==='basics'||b==='pestwatch') ? {} : [])
    ));
    const [basics, pestwatch, ...cropBlocks] = results;
    // flatten crops (blocks are arrays)
    const crops = cropBlocks.reduce((acc, blk)=>{
      if (Array.isArray(blk)) acc.push(...blk);
      return acc;
    }, []);
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

  // simple multi-page table writer (landscape A4, mm)
  function drawPDF(sel, data){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 12;
    const topY = margin + 8;
    const leftX = margin;

    // Title
    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.text(`Seasonal Planting Calendar — ${titleCase(sel.region)}`, leftX, margin + 4);

    // Sub / legend
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.text(`Filter: ${sel.category === 'all' ? 'All categories' : titleCase(sel.category)}${sel.q? ' | Search: '+sel.q : ''}`, leftX, margin + 10);
    doc.text('Legend: S = Sow   P = Plant   H = Harvest', pw - margin, margin + 10, {align:'right'});

    // Column sizes
    const firstColW = 62;                          // crop name
    const tableW = pw - margin - leftX;
    const monthsW = tableW - firstColW;
    const colW = monthsW / 12;                     // ~17-18mm
    const rowH = 7.2;                              // consistent height
    const headH = 8.6;

    // Header row
    let y = topY + 6;
    doc.setFillColor(243,247,245);
    doc.setDrawColor(220,226,220);
    doc.rect(leftX, y, firstColW, headH, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Crop', leftX + 2.2, y + 5.8);

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for(let i=0;i<12;i++){
      const x = leftX + firstColW + i*colW;
      doc.rect(x, y, colW, headH, 'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(9);
      doc.text(months[i], x + colW/2, y + 5.6, {align:'center'});
    }

    // Rows
    y += headH;
    const bottomLimit = ph - margin - 10; // leave space for footer

    const crops = applyFilters(data.crops, sel);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);

    for (let idx=0; idx<crops.length; idx++){
      const c = crops[idx];
      // page break if needed
      if (y + rowH > bottomLimit){
        // footer before page break
        drawFooter(doc, pw, ph, margin);
        doc.addPage('a4','landscape');
        // redraw header on new page
        y = margin + 14;
        doc.setFillColor(243,247,245);
        doc.setDrawColor(220,226,220);
        doc.rect(leftX, y, firstColW, headH, 'FD');
        doc.setFont('helvetica','bold'); doc.setFontSize(10);
        doc.text('Crop', leftX + 2.2, y + 5.8);
        for(let i=0;i<12;i++){
          const x = leftX + firstColW + i*colW;
          doc.rect(x, y, colW, headH, 'FD');
          doc.setFont('helvetica','bold'); doc.setFontSize(9);
          doc.text(months[i], x + colW/2, y + 5.6, {align:'center'});
        }
        y += headH;
        doc.setFont('helvetica','normal'); doc.setFontSize(10);
      }

      // zebra fill
      if (idx % 2 === 0){
        doc.setFillColor(248,250,249);
        doc.rect(leftX, y, tableW, rowH, 'F');
      }

      // crop name + tag
      const tag = (c.category||'').toUpperCase();
      const nameX = leftX + 2;
      const nameY = y + 4.9;
      doc.setTextColor(0,0,0);
      doc.text(c.name, nameX, nameY);
      doc.setFontSize(8); doc.setTextColor(90,100,95);
      doc.text(`(${tag})`, nameX, nameY + 3.2);
      doc.setFontSize(10); doc.setTextColor(0,0,0);

      // month marks
      const marks = monthMarks(c);
      for(let i=0;i<12;i++){
        const x = leftX + firstColW + i*colW;
        doc.setDrawColor(230,235,230);
        doc.rect(x, y, colW, rowH); // cell border
        const m = marks[i];
        if (m){
          doc.setFont('helvetica','bold'); doc.setFontSize(10);
          doc.text(m, x + colW/2, y + 4.6, {align:'center'});
          doc.setFont('helvetica','normal'); doc.setFontSize(10);
        }
      }
      y += rowH;
    }

    // final footer
    drawFooter(doc, pw, ph, margin);

    // filename
    const file = `PatchAndPot-${titleCase(sel.region)}-${sel.category==='all'?'All':titleCase(sel.category)}.pdf`;
    doc.save(file);
  }

  function drawFooter(doc, pw, ph, margin){
    const text = '© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40,40,40);
    doc.text(text, pw/2, ph - margin + 2, {align:'center'});
  }

  window.PP_PDF = {
    generate: async function(sel){
      // minimal guard
      if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF missing');
      const region = (sel.region || 'scotland').toLowerCase();
      const data = await loadRegion(region);
      drawPDF(sel, data);
    }
  };
})();
