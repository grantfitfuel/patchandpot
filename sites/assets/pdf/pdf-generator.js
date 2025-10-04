/* Patch & Pot – PDF Generator (A4, multipage, with Basics/Pest Watch)
   Drop-in for sites/assets/pdf/pdf-generator.js
*/
(function(){
  const BRAND = {
    name: 'Patch & Pot',
    footer: '© 2025 Patch & Pot | Created by Grant Cameron Anthony'
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Utility fetch (no cache so iOS Safari doesn’t stale-cache)
  const fjson = (url) => fetch(url + `?v=${Date.now()}`, {cache:'no-store'}).then(r => {
    if(!r.ok) throw new Error('Missing '+url);
    return r.json();
  });

  // Assemble region data from your existing JSON layout
  async function loadRegion(regionKey){
    const base = `data/regions/${regionKey}`;
    // meta
    const [basics, pestwatch] = await Promise.all([
      fjson(`${base}/basics.json`).catch(()=>({text:[]}))
      ,fjson(`${base}/pestwatch.json`).catch(()=>({}))
    ]);
    // crops
    const blocks = ['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'];
    const parts = await Promise.all(blocks.map(b => fjson(`${base}/${b}.json`).catch(()=>[])));
    const crops = parts.flat().filter(x => x && x.name);

    return { basics, pestwatch, crops };
  }

  // Category inference (kept in sync with seasonal page)
  function inferCategory(name){
    const n=(name||'').toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|pak|choi|bok|tat\s*soi|watercress)/.test(n))return'leafy';
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return'roots';
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return'legumes';
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return'fruit';
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return'alliums';
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return'herbs';
    return 'other';
  }

  function filterCrops(crops, {q='',
                               category='all'}){
    const needle = (q||'').trim().toLowerCase();
    return (crops||[]).filter(c=>{
      const name = c.name || '';
      const tag  = c.category || inferCategory(name);
      if(needle && !name.toLowerCase().includes(needle)) return false;
      if(category !== 'all' && tag !== category) return false;
      return true;
    });
  }

  // Build one A4 sheet in a hidden DOM, then snapshot with html2canvas
  function buildSheet({regionLabel, pageLabel, selection, basicsBlock, pestBlock, rows}){
    const wrap = document.createElement('section');
    wrap.className = 'pdf-sheet';

    // Title bar
    const head = document.createElement('div');
    head.className = 'pdf-titlebar';
    head.innerHTML = `
      <h2 class="pdf-title">${regionLabel}</h2>
      <p class="pdf-sub">${pageLabel}</p>
    `;
    wrap.appendChild(head);

    // legend
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `<span>🌱 <strong>Sow</strong></span><span>🪴 <strong>Plant</strong></span><span>🥕 <strong>Harvest</strong></span>`;
    wrap.appendChild(legend);

    // Optional blocks (Basics / Pest Watch)
    if (basicsBlock){
      const b = document.createElement('div');
      b.className = 'pdf-block';
      b.innerHTML = `<h3>Basics</h3><div>${basicsBlock}</div>`;
      wrap.appendChild(b);
    }
    if (pestBlock){
      const p = document.createElement('div');
      p.className = 'pdf-block';
      p.innerHTML = `<h3>Pest Watch — ${selection.monthName}</h3><ul>${pestBlock}</ul>`;
      wrap.appendChild(p);
    }

    // Grid
    const grid = document.createElement('div');
    grid.className = 'pdf-grid';

    // Header row
    const rowH = document.createElement('div'); rowH.className = 'pdf-row';
    const headCrop = document.createElement('div'); headCrop.className = 'pdf-headcell'; headCrop.textContent='Crop';
    rowH.appendChild(headCrop);
    MONTHS.forEach(m=>{
      const c = document.createElement('div'); c.className='pdf-headcell month-head'; c.textContent=m; rowH.appendChild(c);
    });
    grid.appendChild(rowH);

    // Rows (already filtered)
    rows.forEach(crop=>{
      const r = document.createElement('div'); r.className='pdf-row';

      const c0 = document.createElement('div');
      c0.className='pdf-cell pdf-crop';
      c0.innerHTML = `<span>${crop.name}</span><span class="pdf-tag">(${crop.category||inferCategory(crop.name)})</span>`;
      r.appendChild(c0);

      for(let i=0;i<12;i++){
        const cell = document.createElement('div'); cell.className='pdf-cell month-cell';
        const s = (crop.months?.sow||[]).includes(i);
        const p = (crop.months?.plant||[]).includes(i);
        const h = (crop.months?.harvest||[]).includes(i);
        let marks = [];
        if(s) marks.push('🌱'); if(p) marks.push('🪴'); if(h) marks.push('🥕');
        cell.textContent = marks.join(' ');
        r.appendChild(cell);
      }
      grid.appendChild(r);
    });

    wrap.appendChild(grid);

    // Footer branding (text only)
    const foot = document.createElement('div');
    foot.className = 'pdf-footer';
    foot.textContent = BRAND.footer;
    wrap.appendChild(foot);

    return wrap;
  }

  async function toPdfPages(sheets, {orientation='p'}){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'a4', orientation: (orientation==='l'?'landscape':'portrait') });

    for(let i=0;i<sheets.length;i++){
      const el = sheets[i];
      document.body.appendChild(el); // must be attached for fonts/paint
      /* eslint no-await-in-loop: 0 */
      const canvas = await html2canvas(el, {
        scale: 2, backgroundColor:'#ffffff', useCORS:true, logging:false, windowWidth: el.offsetWidth
      });
      const img = canvas.toDataURL('image/png');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      doc.addImage(img, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
      document.body.removeChild(el);
      if (i < sheets.length-1) doc.addPage();
    }
    return doc;
  }

  async function buildPdf({region='scotland', category='all', q='', includeMeta=true, landscape=false}){
    const data = await loadRegion(region);
    const monthIndex = new Date().getMonth();
    const monthName = MONTHS[monthIndex];

    // selection, filtered crops
    const selection = {region, category, q, monthName};
    const crops = filterCrops(data.crops, selection);

    // Build one or more sheets (paginate ~34 crops per A4 portrait)
    const limit = landscape ? 22 : 34;
    const pages = [];
    const regionLabel = `Seasonal Planting — ${region[0].toUpperCase()+region.slice(1)}`;
    const pageStyle = landscape ? 'Landscape A4' : 'Portrait A4';

    // First sheet optionally has Basics/Pest Watch
    let idx = 0;
    if (includeMeta){
      const basicsText = (Array.isArray(data.basics?.text) ? data.basics.text : []).map(t=>String(t)).join(' ');
      const pests = (data.pestwatch && data.pestwatch[String(monthIndex)] && data.pestwatch[String(monthIndex)].items) || [];
      const pestList = pests.map(li=>`<li>${li}</li>`).join('');
      const rows = crops.slice(idx, idx+limit);
      pages.push(buildSheet({
        regionLabel,
        pageLabel:`Filter: ${category==='all'?'All categories':category}`,
        selection,
        basicsBlock: basicsText ? `<p>${basicsText}</p>` : '',
        pestBlock: pestList || '',
        rows
      }));
      idx += limit;
    }

    // Remaining sheets (grid only)
    while (idx < crops.length){
      const rows = crops.slice(idx, idx+limit);
      pages.push(buildSheet({
        regionLabel,
        pageLabel:`Filter: ${category==='all'?'All categories':category}`,
        selection,
        basicsBlock: '',
        pestBlock: '',
        rows
      }));
      idx += limit;
    }

    // Convert to jsPDF
    const doc = await toPdfPages(pages, {orientation: landscape ? 'l' : 'p'});
    return doc;
  }

  // Public API
  window.PP_PDF = {
    async generate(sel){
      try{
        const btn = document.getElementById('pp-make-pdf') || document.querySelector('[data-pp-make-pdf]');
        btn && (btn.disabled = true, btn.textContent = 'Building…');

        const includeMeta = !!document.getElementById('pp-include-meta')?.checked || true; // default ON if control not present
        const landscape = (document.getElementById('pp-page')?.value || 'portrait') === 'landscape';

        const doc = await buildPdf({
          region: (sel?.region)||'scotland',
          category: (sel?.category)||'all',
          q: (sel?.q)||'',
          includeMeta,
          landscape
        });

        // File name e.g. seasonal-scotland-2025-10-04.pdf
        const d = new Date();
        const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
        const fname = `seasonal-${(sel?.region||'scotland')}-${yyyy}-${mm}-${dd}.pdf`;
        doc.save(fname);
      }catch(err){
        alert('Sorry, PDF generation failed.');
        console.error(err);
      }finally{
        const btn = document.getElementById('pp-make-pdf') || document.querySelector('[data-pp-make-pdf]');
        btn && (btn.disabled = false, btn.textContent = '📄 Download PDF');
      }
    }
  };
})();
