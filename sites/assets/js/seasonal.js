/* Patch & Pot – Seasonal page app (FULL)
   Root is /sites; data lives at /sites/data/regions/{region}/{block}.json
   Blocks: basics.json, pestwatch.json, roots.json, leafy.json, legumes.json,
           fruit.json, alliums.json, herbs.json, softfruit.json, other.json
*/

(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CUR_M = new Date().getMonth();

  const REGIONS = ["scotland","ireland","england","wales"];
  const CROP_BLOCKS = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
  const META_BLOCKS = ["basics","pestwatch"];

  // Where JSONs live (sites is repo root)
  const DATA_BASE = "data/regions";

  // In-memory data by region
  const DATA = { scotland:null, ireland:null, england:null, wales:null };
  const MISSING = Object.fromEntries(REGIONS.map(r=>[r,new Set()]));

  // --- Utilities
  const $ = sel => document.querySelector(sel);
  const el = id => document.getElementById(id);
  const cap = s => s ? s[0].toUpperCase()+s.slice(1) : "";

  function bust(url){ return `${url}?v=${Date.now()}`; }

  function fetchJSON(url){
    return fetch(bust(url), {cache:'no-store'})
      .then(r => r.ok ? r.json() : Promise.reject(url));
  }

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return "other";
  }

  // --- Filters
  function getFilters(){
    return{
      region: el('pp-region')?.value || 'scotland',
      q: (el('pp-search')?.value || '').trim().toLowerCase(),
      cat: el('pp-category')?.value || 'all',
      monthOnly: !!el('pp-this-month')?.checked
    };
  }

  function applyFilters(list){
    const f = getFilters();
    return (list||[])
      .filter(c => c && c.name)
      .filter(c=>{
        const cat = c.category || inferCategory(c.name);
        if(f.q && !c.name.toLowerCase().includes(f.q)) return false;
        if(f.cat !== 'all' && cat !== f.cat) return false;
        if(f.monthOnly){
          const s=(c.months?.sow||[]).includes(CUR_M);
          const p=(c.months?.plant||[]).includes(CUR_M);
          const h=(c.months?.harvest||[]).includes(CUR_M);
          if(!(s||p||h)) return false;
        }
        return true;
      });
  }

  // --- Render helpers
  function setMonthHints(){
    el('pp-month-hint').textContent = `Here’s what suits containers now in ${MONTHS[CUR_M]}.`;
    el('pp-month-name').textContent = MONTHS[CUR_M];
  }

  function renderPestWatch(regionKey){
    const reg = DATA[regionKey] || {};
    const entry = (reg.pestwatch && reg.pestwatch[String(CUR_M)]) || {items:["No major alerts this month. Keep an eye on slugs after rain."]};
    el('pp-region-name').textContent = cap(regionKey);
    $('#pp-pestwatch ul').innerHTML = (entry.items||[]).map(i=>`<li>${i}</li>`).join('') || '<li>No items.</li>';
  }

  function renderToday(regionKey){
    const reg = DATA[regionKey] || {};
    const list = el('pp-today-list');
    const items=[];
    applyFilters(reg.crops||[]).forEach(c=>{
      const s=(c.months?.sow||[]).includes(CUR_M);
      const p=(c.months?.plant||[]).includes(CUR_M);
      const h=(c.months?.harvest||[]).includes(CUR_M);
      if(s||p||h){
        const tag=c.category||inferCategory(c.name);
        items.push(`<li><strong>${c.name}</strong> ${s?"🌱":""}${p?" 🪴":""}${h?" 🥕":""} <span class="pp-tags">(${tag})</span></li>`);
      }
    });
    list.innerHTML = items.length ? items.join('') : `<li>No items match your filters for ${MONTHS[CUR_M]}.</li>`;
  }

  function renderCalendar(regionKey){
    const reg = DATA[regionKey] || {};
    const wrap = el('pp-calendar');

    const head = `<div class="pp-row">
      <div class="pp-head">Crop</div>
      ${MONTHS.map(m=>`<div class="pp-head">${m}</div>`).join('')}
    </div>`;

    const rows = applyFilters(reg.crops||[]).map(c=>{
      const cat=c.category||inferCategory(c.name);
      const cells = MONTHS.map((_,i)=>{
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks=[s?"🌱":"",p?"🪴":"",h?"🥕":""].filter(Boolean).join(" ");
        return `<div class="pp-cell">${marks}</div>`;
      }).join('');
      return `<div class="pp-row">
        <div class="pp-crop"><span class="name">${c.name}</span><span class="pp-tags">(${cat})</span></div>
        ${cells}
      </div>`;
    }).join('');

    wrap.innerHTML = head + rows;
  }

  function renderAll(){
    const {region} = getFilters();
    localStorage.setItem('pp-region', region);
    document.title = `Seasonal Planting (${cap(region)}) • Patch & Pot`;
    setMonthHints(); renderPestWatch(region); renderToday(region); renderCalendar(region);

    const miss = [...MISSING[region]].sort();
    const box = el('pp-error');
    if(miss.length){
      box.style.display='block';
      box.innerHTML = `<strong>Missing files for ${cap(region)}:</strong><br>${miss.map(x=>`<code>${DATA_BASE}/${region}/${x}.json</code>`).join('<br>')}`;
    }else{
      box.style.display='none'; box.innerHTML='';
    }
  }

  // --- Data loading
  function loadBlock(region, block){
    const url = `${DATA_BASE}/${region}/${block}.json`;
    return fetchJSON(url).catch(()=>{ MISSING[region].add(block); return (block==='basics'||block==='pestwatch')?{}:[]; });
  }

  function assembleRegion(region){
    const metaP = Promise.all(META_BLOCKS.map(b=>loadBlock(region,b)))
      .then(([basics,pestwatch]) => ({basics: basics||{}, pestwatch: pestwatch||{}}));

    const cropP = Promise.all(CROP_BLOCKS.map(b=>loadBlock(region,b)))
      .then(parts => (parts||[]).flat().filter(c=>c && c.name));

    return Promise.all([metaP, cropP])
      .then(([meta,crops]) => ({ region: cap(region), basics: meta.basics, pestwatch: meta.pestwatch, crops }));
  }

  function boot(){
    const sel = el('pp-region');
    if(sel) sel.value = localStorage.getItem('pp-region') || 'scotland';

    ['pp-search','pp-category','pp-this-month'].forEach(id=>{
      const e = el(id);
      e && e.addEventListener(id==='pp-search'?'input':'change', renderAll);
    });
    sel && sel.addEventListener('change', renderAll);

    renderAll();
  }

  Promise.all(REGIONS.map(r => assembleRegion(r).then(obj => (DATA[r]=obj))))
    .then(boot);

  // --- Expose current selection to the PDF generator
  window.PP_VIEW = {
    getSelection: () => ({
      region: el('pp-region')?.value || 'scotland',
      category: el('pp-category')?.value || 'all',
      q: (el('pp-search')?.value || '').trim(),
      monthOnly: !!el('pp-this-month')?.checked
    })
  };

  // Wire the PDF button safely (after generator loads)
  window.addEventListener('load', ()=>{
    const btn = el('pp-make-pdf');
    if(!btn) return;
    btn.addEventListener('click', async ()=>{
      try{
        btn.disabled = true; btn.textContent = 'Building…';
        if(!window.PP_PDF || !window.PP_PDF.generate){ alert('PDF generator not found.'); return; }
        await window.PP_PDF.generate(window.PP_VIEW.getSelection());
      }catch(e){
        alert('Sorry, PDF generation failed.');
      }finally{
        btn.disabled=false; btn.textContent='📄 Download PDF';
      }
    });
  });

})();
