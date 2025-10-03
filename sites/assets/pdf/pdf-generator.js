/* Patch & Pot – PDF Generator (external)
   - No HTML-to-canvas, no cross-origin images
   - Builds a clean A4 PDF from the currently selected region/category/search
   - Reads DATA from seasonal.html (global binding), mirrors its filtering
*/
(function(){
  // Safe jsPDF getter + on-demand loader (fallback)
  function getJsPDF(){
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise((resolve, reject)=>{
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
      s.onload = ()=> window.jspdf && window.jspdf.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF failed to load'));
      s.onerror = ()=> reject(new Error('jsPDF network error'));
      document.head.appendChild(s);
    });
  }

  // Mirror seasonal’s helpers (kept in sync with your page)
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return"other";
  }

  function getFiltersFromPage(){
    const qEl = document.getElementById('pp-search');
    const catEl = document.getElementById('pp-category');
    const thisMonthEl = document.getElementById('pp-this-month');
    const regionEl = document.getElementById('pp-region');
    return {
      region: regionEl ? regionEl.value : 'scotland',
      q: (qEl && qEl.value || '').trim().toLowerCase(),
      cat: (catEl && catEl.value) || 'all',
      thisMonth: !!(thisMonthEl && thisMonthEl.checked),
      monthIdx: new Date().getMonth()
    };
  }

  function applyFilters(crops, filters){
    return (crops||[])
      .filter(c=>c && c.name)
      .filter(c=>{
        const name = c.name;
        const cat  = c.category || inferCategory(name);
        if (filters.q && !name.toLowerCase().includes(filters.q)) return false;
        if (filters.cat !== 'all' && cat !== filters.cat) return false;
        if (filters.thisMonth){
          const s=(c.months?.sow||[]).includes(filters.monthIdx);
          const p=(c.months?.plant||[]).includes(filters.monthIdx);
          const h=(c.months?.harvest||[]).includes(filters.monthIdx);
          if(!(s||p||h)) return false;
        }
        return true;
      });
  }

  function marksForMonths(mArr){
    // convert [0,3,4] => "Jan, Apr–May"
    if(!mArr || !mArr.length) return "";
    const sorted = Array.from(new Set(mArr)).sort((a,b)=>a-b);
    const ranges = [];
    let start = sorted[0], prev = sorted[0];
    for (let i=1;i<sorted.length;i++){
      const cur = sorted[i];
      if (cur === prev+1){ prev = cur; continue; }
      ranges.push(start===prev ? MONTHS[start] : `${MONTHS[start]}–${MONTHS[prev]}`);
      start = prev = cur;
    }
    ranges.push(start===prev ? MONTHS[start] : `${MONTHS[start]}–${MONTHS[prev]}`);
    return ranges.join(', ');
  }

  function rowLine(doc, x, y, w){ doc.setDrawColor(220); doc.line(x, y, x+w, y); }

  function buildPdfContent(jsPDF, DATA, filters){
    const regionData = DATA[filters.region];
    if(!regionData) throw new Error('Region data not loaded');

    const crops = applyFilters(regionData.crops, filters);
    const pest = (regionData.pestwatch && regionData.pestwatch[String(filters.monthIdx)]) || {items:[]};

    const doc = new jsPDF({unit:'pt', format:'a4', compress: true}); // portrait
    const margin = 40, lineH = 18, pageW = doc.internal.pageSize.getWidth(), usableW = pageW - margin*2;

    // Title
    let y = margin;
    doc.setFont('Helvetica','bold'); doc.setFontSize(18);
    doc.text(`Patch & Pot — ${filters.region[0].toUpperCase()+filters.region.slice(1)} (${MONTHS[filters.monthIdx]})`, margin, y);
    y += 8;

    // Subhead / filters
    doc.setFont('Helvetica','normal'); doc.setFontSize(11);
    const filterBits = [];
    if (filters.cat !== 'all') filterBits.push(`Category: ${filters.cat}`);
    if (filters.q) filterBits.push(`Search: “${filters.q}”`);
    if (filters.thisMonth) filterBits.push('This month only');
    doc.text(filterBits.length ? filterBits.join(' • ') : 'All categories', margin, y += lineH);

    // Legend
    doc.setFontSize(10);
    doc.text('Legend: 🌱 Sow   🪴 Plant   🥕 Harvest', margin, y += lineH);

    // Pest watch (bullets)
    if (pest.items && pest.items.length){
      y += 6;
      doc.setFont('Helvetica','bold'); doc.text('Pest Watch', margin, y += lineH);
      doc.setFont('Helvetica','normal');
      pest.items.forEach(item=>{
        const lines = doc.splitTextToSize(`• ${item}`, usableW);
        lines.forEach(l=>{ doc.text(l, margin, y += lineH); });
      });
      y += 8;
    }

    // Table header
    doc.setFont('Helvetica','bold'); doc.setFontSize(11);
    const colNameX = margin, colCatX = margin + 270, colSowX = margin + 370, colPlantX = margin + 470, colHarvX = margin + 570;
    doc.text('Crop', colNameX, y += lineH);
    doc.text('Category', colCatX, y);
    doc.text('Sow', colSowX, y);
    doc.text('Plant', colPlantX, y);
    doc.text('Harvest', colHarvX, y);
    rowLine(doc, margin, y+6, usableW);
    doc.setFont('Helvetica','normal');

    // Rows
    const startY = y + 14;
    y = startY;
    const addRow = (name, cat, sowArr, plantArr, harvArr)=>{
      const sow = marksForMonths(sowArr);
      const plant = marksForMonths(plantArr);
      const harv = marksForMonths(harvArr);

      // Wrap the crop name if long
      const nameLines = doc.splitTextToSize(name, colCatX - colNameX - 12);
      const catLines  = doc.splitTextToSize(cat, colSowX - colCatX - 12);
      const sowLines  = doc.splitTextToSize(sow || '—', colPlantX - colSowX - 12);
      const plantLines= doc.splitTextToSize(plant || '—', colHarvX - colPlantX - 12);
      const harvLines = doc.splitTextToSize(harv || '—', margin + usableW - colHarvX);

      const rowHeight = Math.max(nameLines.length, catLines.length, sowLines.length, plantLines.length, harvLines.length) * lineH;

      // Page break if needed
      const pageH = doc.internal.pageSize.getHeight();
      if (y + rowHeight + margin > pageH){
        doc.addPage();
        y = margin;
        // Reprint header row on new page
        doc.setFont('Helvetica','bold'); doc.setFontSize(11);
        doc.text('Crop', colNameX, y += lineH);
        doc.text('Category', colCatX, y);
        doc.text('Sow', colSowX, y);
        doc.text('Plant', colPlantX, y);
        doc.text('Harvest', colHarvX, y);
        rowLine(doc, margin, y+6, usableW);
        doc.setFont('Helvetica','normal');
        y += 8;
      }

      // Draw text
      let ty = y;
      nameLines.forEach(l=>{ doc.text(l, colNameX, ty); ty += lineH; });
      ty = y; catLines.forEach(l=>{ doc.text(l, colCatX, ty); ty += lineH; });
      ty = y; sowLines.forEach(l=>{ doc.text(l, colSowX, ty); ty += lineH; });
      ty = y; plantLines.forEach(l=>{ doc.text(l, colPlantX, ty); ty += lineH; });
      ty = y; harvLines.forEach(l=>{ doc.text(l, colHarvX, ty); ty += lineH; });

      y += rowHeight;
      rowLine(doc, margin, y + 4, usableW);
      y += 6;
    };

    crops.forEach(c=>{
      addRow(
        c.name,
        (c.category || inferCategory(c.name)),
        (c.months && c.months.sow) || [],
        (c.months && c.months.plant) || [],
        (c.months && c.months.harvest) || []
      );
    });

    // Footer
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`© Patch & Pot • Generated ${new Date().toLocaleString()}`, margin, pageH - 20);

    return doc;
  }

  function generateNow(){
    try{
      // Ensure seasonal data exists
      if (typeof DATA === 'undefined' || !DATA) {
        alert('Seasonal data not ready yet. Please wait a moment and try again.');
        return;
      }
      const filters = getFiltersFromPage();
      getJsPDF()
        .then(jsPDF => {
          const doc = buildPdfContent(jsPDF, DATA, filters);
          const rn = filters.region[0].toUpperCase()+filters.region.slice(1);
          const cat = filters.cat==='all' ? 'all' : filters.cat;
          const ts = new Date().toISOString().slice(0,10);
          doc.save(`PatchAndPot-${rn}-${cat}-${ts}.pdf`);
        })
        .catch(err=>{
          console.error(err);
          alert('Could not load PDF engine. Check your connection and try again.');
        });
    }catch(e){
      console.error(e);
      alert('PDF generation failed. See console for details.');
    }
  }

  // Public API
  window.PP_PDF = {
    init(){
      // Attach once; handle late DOM readiness
      const bind = ()=>{
        const btn = document.getElementById('pp-download-pdf');
        if (!btn) return false;
        if (!btn.dataset.ppPdfBound){
          btn.addEventListener('click', generateNow);
          btn.dataset.ppPdfBound = '1';
        }
        return true;
      };
      if (!bind()){
        // try again after DOM is fully ready
        document.addEventListener('DOMContentLoaded', bind, {once:true});
        // and after header partial swap (just in case)
        setTimeout(bind, 600);
      }
    },
    generate: generateNow
  };
})();
