/* Patch & Pot – PDF generator (A4)
   - Reads current filters from seasonal.html (#pp-region, #pp-category, #pp-this-month)
   - Uses global DATA from seasonal app; if absent, fetches JSON blocks from data/regions/<region>/
   - Orientation chooser modal (portrait/landscape)
   - Includes Basics + Pestwatch (for the selected month) at top
   - Paginates crop rows across multiple A4 pages
   - Footer: pot icon to the LEFT of © text (never above)
*/

window.PP_PDF = (function(){
  const { jsPDF } = window.jspdf || {};
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function $(sel, root=document){ return root.querySelector(sel); }
  function $el(tag, attrs={}){ const n=document.createElement(tag); Object.assign(n, attrs); return n; }

  // ---------- Modal (orientation prompt) ----------
  function ensureModal(){
    let modal = document.getElementById('pp-pdf-modal');
    if(modal) return modal;

    modal = $el('div',{ id:'pp-pdf-modal' });
    modal.innerHTML = `
      <style>
        #pp-pdf-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
        #pp-pdf-modal .box{
          background:#0e1311;color:#e6f0ea;border:1px solid #2b332f;border-radius:14px;
          width:min(520px,92vw);padding:16px 16px 14px;font-family:system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif
        }
        #pp-pdf-modal h3{margin:.1rem 0 .6rem;font-size:1.2rem}
        #pp-pdf-modal .row{display:flex;gap:10px;align-items:center;margin:.6rem 0}
        #pp-pdf-modal label{display:inline-flex;gap:.4rem;align-items:center;background:#151d19;border:1px solid #2b332f;border-radius:10px;padding:.5rem .7rem}
        #pp-pdf-modal .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:.8rem}
        #pp-pdf-modal button{border:none;border-radius:999px;padding:.6rem .95rem;font-weight:800;cursor:pointer}
        #pp-pdf-modal .go{background:#35c26a;color:#061007}
        #pp-pdf-modal .cancel{background:#2b332f;color:#e6f0ea}
      </style>
      <div class="box" role="dialog" aria-modal="true" aria-labelledby="pp-pdf-title">
        <h3 id="pp-pdf-title">Create PDF</h3>
        <div class="row">
          <strong style="min-width:120px">Orientation:</strong>
          <label><input type="radio" name="pp-orient" value="p" checked> Portrait</label>
          <label><input type="radio" name="pp-orient" value="l"> Landscape</label>
        </div>
        <div class="row" style="color:#a6b6af;font-size:.95rem">
          The PDF will include Basics & Pest Watch for the selected region and month, then the crop grid.
        </div>
        <div class="actions">
          <button class="cancel" type="button">Cancel</button>
          <button class="go" type="button">Generate</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.cancel').addEventListener('click', ()=> modal.remove());
    return modal;
  }

  function askOrientation(){
    return new Promise(res=>{
      const modal = ensureModal();
      const go = modal.querySelector('.go');
      go.onclick = ()=>{
        const v = modal.querySelector('input[name="pp-orient"]:checked').value || 'p';
        modal.remove();
        res(v);
      };
    });
  }

  // ---------- Data helpers ----------
  function currentFilters(){
    const region = ($('#pp-region')?.value || 'scotland').toLowerCase();
    const cat = ($('#pp-category')?.value || 'all').toLowerCase();
    const thisMonth = !!$('#pp-this-month')?.checked;
    const m = new Date().getMonth();
    return { region, cat, thisMonth, monthIndex:m, monthName: MONTHS[m] };
  }

  async function loadRegionIfNeeded(region){
    if (window.DATA && window.DATA[region] && window.DATA[region].crops) return window.DATA[region];
    // Fallback: fetch all blocks and assemble (matches seasonal loader)
    async function getJSON(u){ const r=await fetch(u+`?v=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
    const base = `data/regions/${region}/`;
    const metaP = Promise.all([getJSON(base+'basics.json').catch(()=>({})), getJSON(base+'pestwatch.json').catch(()=>({}))])
      .then(([basics,pestwatch])=>({basics,pestwatch}));
    const cropP = Promise.all(['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other']
      .map(b => getJSON(base+`${b}.json`).catch(()=>[])))
      .then(parts => parts.flat().filter(x=>x && x.name));
    const [meta,crops]= await Promise.all([metaP,cropP]);
    return { region: region[0].toUpperCase()+region.slice(1), basics: meta.basics||{}, pestwatch: meta.pestwatch||{}, crops };
  }

  function inferCategory(name){
    const n=(name||'').toLowerCase();
    if (/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n)) return 'leafy';
    if (/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n)) return 'roots';
    if (/(pea|bean|chickpea|lentil|soy|edamame)/.test(n)) return 'legumes';
    if (/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n)) return 'fruit';
    if (/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n)) return 'alliums';
    if (/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n)) return 'herbs';
    return 'other';
  }

  function filterCrops(allCrops, cat, monthIndex, thisMonth){
    let list = Array.isArray(allCrops) ? allCrops.slice() : [];
    if (cat !== 'all') list = list.filter(c => (c.category || inferCategory(c.name)) === cat);
    if (thisMonth){
      list = list.filter(c=>{
        const s=(c.months?.sow||[]).includes(monthIndex);
        const p=(c.months?.plant||[]).includes(monthIndex);
        const h=(c.months?.harvest||[]).includes(monthIndex);
        return s||p||h;
      });
    }
    return list;
  }

  // ---------- Build a single A4 sheet (returns DOM node) ----------
  function buildSheet({regionName, cat, monthIndex, monthName, basics, pestwatch, crops, pageIndex, totalPages}){
    const sheet=$el('div'); sheet.className='pdf-sheet';

    // Header
    const head=$el('div'); head.className='pdf-head';
    const title=$el('h1'); title.className='pdf-title';
    title.textContent=`${regionName} • ${cat==='all'?'All categories':cat[0].toUpperCase()+cat.slice(1)}`;
    const sub=$el('div'); sub.className='pdf-sub';
    sub.textContent=`${monthName} • Sow 🟰 🌱  Plant 🟰 🪴  Harvest 🟰 🥕${totalPages>1?` • Page ${pageIndex+1}/${totalPages}`:''}`;
    head.appendChild(title); head.appendChild($el('div',{textContent:''}));
    sheet.appendChild(head); sheet.appendChild(sub);

    // Legend
    const legend=$el('div'); legend.className='legend';
    legend.innerHTML=`<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>`;
    sheet.appendChild(legend);

    // Basics & Pestwatch (for current month)
    const meta=$el('div'); meta.className='pdf-meta';
    const bH=$el('h4'); bH.textContent='Basics'; meta.appendChild(bH);
    const bP=$el('p'); bP.textContent=(basics?.summary || basics?.intro || 'Good hygiene, drainage, right pot size, and consistent watering.'); meta.appendChild(bP);

    const pH=$el('h4'); pH.textContent=`Pest Watch – ${monthName}`; meta.appendChild(pH);
    const ul=$el('ul');
    const pw=(pestwatch && pestwatch[String(monthIndex)] && pestwatch[String(monthIndex)].items) || ['Keep an eye on slugs after rain.'];
    ul.innerHTML=pw.map(i=>`<li>${i}</li>`).join('');
    meta.appendChild(ul);
    sheet.appendChild(meta);

    // Grid
    const grid=$el('div'); grid.className='pdf-grid';
    // Watercolour wash (based on category)
    const wash=$el('div'); wash.className=`wash wash-${cat==='all'?'other':cat}`;
    grid.appendChild(wash);

    // header row
    const headRow=$el('div'); headRow.className='pdf-row';
    const hc0=$el('div'); hc0.className='pdf-headcell'; hc0.textContent='Crop'; headRow.appendChild(hc0);
    MONTHS.forEach(m=>{ const hc=$el('div'); hc.className='pdf-headcell'; hc.textContent=m; headRow.appendChild(hc); });
    grid.appendChild(headRow);

    crops.forEach(c=>{
      const row=$el('div'); row.className='pdf-row';
      const crop=$el('div'); crop.className='pdf-crop';
      const nm=$el('div'); nm.textContent=c.name;
      const tag=$el('div'); tag.className='pdf-tag'; tag.textContent=`(${c.category || inferCategory(c.name)})`;
      crop.appendChild(nm); crop.appendChild(tag);
      row.appendChild(crop);
      for (let i=0;i<12;i++){
        const cell=$el('div'); cell.className='pdf-cell';
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        cell.textContent = `${s?'🌱':''}${p?'🪴':''}${h?'🥕':''}`;
        row.appendChild(cell);
      }
      grid.appendChild(row);
    });

    sheet.appendChild(grid);

    // Footer (icon LEFT of text)
    const foot=$el('div'); foot.className='pdf-footer';
    const pot=$el('img'); pot.className='pot'; pot.alt='Patch & Pot icon';
    pot.src='img/patchandpot-icon.png';
    const ftxt=$el('div'); ftxt.textContent='© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    foot.appendChild(pot); foot.appendChild(ftxt);
    sheet.appendChild(foot);

    document.body.appendChild(sheet);
    return sheet;
  }

  // ---------- Pagination (split crops into pages) ----------
  function paginateCrops(crops, orient){
    // rows per page tuned for A4 with our metrics
    const rowsPer = (orient==='l') ? 16 : 22;
    const pages=[];
    for (let i=0;i<crops.length;i+=rowsPer){
      pages.push(crops.slice(i, i+rowsPer));
    }
    return { pages, rowsPer };
  }

  // ---------- Render to PDF ----------
  async function renderPDF(orient, {regionName, cat, monthIndex, monthName, basics, pestwatch, crops}){
    const { pages } = paginateCrops(crops, orient);
    const doc = new jsPDF({ orientation: orient==='l'?'landscape':'portrait', unit:'pt', format:'a4' });

    for (let i=0;i<pages.length;i++){
      const pageCrops = pages[i];
      const sheet = buildSheet({regionName, cat, monthIndex, monthName, basics, pestwatch, crops: pageCrops, pageIndex:i, totalPages:pages.length});

      // Canvas capture
      const canvas = await html2canvas(sheet, {
        backgroundColor:'#ffffff',
        scale:2,
        useCORS:true,
        allowTaint:true
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.94);

      // Fit to A4
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(pageW/imgW, pageH/imgH);
      const w = imgW*ratio, h=imgH*ratio;
      const x = (pageW - w)/2;
      const y = (pageH - h)/2;

      if(i>0) doc.addPage();
      doc.addImage(imgData, 'JPEG', x, y, w, h, undefined, 'FAST');

      // cleanup this sheet
      sheet.remove();
    }

    const stamp = new Date().toISOString().slice(0,10);
    const niceCat = (cat==='all'?'All':cat[0].toUpperCase()+cat.slice(1));
    doc.save(`Patch&Pot-${regionName}-${niceCat}-${stamp}.pdf`);
  }

  // ---------- Public init ----------
  function init(){
    const btn = document.getElementById('pp-pdf-btn');
    if(!btn || !jsPDF || !window.html2canvas) return;
    btn.addEventListener('click', async ()=>{
      try{
        const { region, cat, thisMonth, monthIndex, monthName } = currentFilters();
        const regionData = await loadRegionIfNeeded(region);
        const filtered = filterCrops(regionData.crops, cat, monthIndex, thisMonth);
        const orient = await askOrientation();
        await renderPDF(orient, {
          regionName: regionData.region,
          cat,
          monthIndex,
          monthName,
          basics: regionData.basics,
          pestwatch: regionData.pestwatch,
          crops: filtered
        });
      }catch(err){
        console.error(err);
        alert('Sorry — PDF generation failed.');
      }
    });
  }

  return { init };
})();
