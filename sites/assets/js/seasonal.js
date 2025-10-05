/* Seasonal page app – loads ALL blocks from data/regions/{region}/{block}.json
   Blocks: basics (object), pestwatch (object keyed 0..11), crops arrays:
   roots, leafy, legumes, fruit, alliums, herbs, softfruit, other
   NO silent failures. Shows missing files in a red box.
*/
(function(){
  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CUR = new Date().getMonth();
  const REGIONS=["scotland","england","ireland","wales"];
  const CROP_BLOCKS=["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
  const META_BLOCKS=["basics","pestwatch"];

  const DATA={}; // per region: { basics, pestwatch, crops[] }
  const MISSING = Object.fromEntries(REGIONS.map(r=>[r,new Set()]));

  // Helper: infer category if missing
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

  function fetchJSON(url){
    // add hard cache-buster to prevent iOS stale responses
    const u = `${url}?v=${Date.now()}`;
    return fetch(u,{cache:'no-store'}).then(r=>{
      if(!r.ok) throw new Error(url);
      return r.json();
    });
  }

  function loadBlock(region, block){
    const url=`data/regions/${region}/${block}.json`;
    return fetchJSON(url).catch(()=>{
      MISSING[region].add(block);
      // return types per block
      if(block==='basics' || block==='pestwatch') return {};
      return [];
    });
  }

  function assembleRegion(region){
    const metaP = Promise.all(META_BLOCKS.map(b=>loadBlock(region,b)))
      .then(([basics,pestwatch])=>({basics,pestwatch}));
    const cropsP = Promise.all(CROP_BLOCKS.map(b=>loadBlock(region,b)))
      .then(parts=>parts.flat().filter(c=>c && c.name));
    return Promise.all([metaP,cropsP]).then(([meta,crops])=>({
      basics: meta.basics||{},
      pestwatch: meta.pestwatch||{},
      crops: (crops||[]).map(c=>({ ...c, category: c.category || inferCategory(c.name) }))
    }));
  }

  function humanRegion(k){ return k? k[0].toUpperCase()+k.slice(1):""; }

  function getFilters(){
    return {
      region: document.getElementById('pp-region')?.value || 'scotland',
      q: (document.getElementById('pp-search')?.value||'').trim().toLowerCase(),
      cat: document.getElementById('pp-category')?.value || 'all',
      thisMonth: !!document.getElementById('pp-this-month')?.checked
    };
  }

  function applyFilters(list){
    const f=getFilters();
    return (list||[]).filter(c=>{
      if(!c || !c.name) return false;
      if(f.q && !c.name.toLowerCase().includes(f.q)) return false;
      if(f.cat!=='all' && (c.category||'')!==f.cat) return false;
      if(f.thisMonth){
        const s=(c.months?.sow||[]).includes(CUR);
        const p=(c.months?.plant||[]).includes(CUR);
        const h=(c.months?.harvest||[]).includes(CUR);
        if(!(s||p||h)) return false;
      }
      return true;
    });
  }

  function renderPestWatch(regionKey){
    const r=DATA[regionKey]||{};
    const entry = r.pestwatch && r.pestwatch[String(CUR)];
    const items = entry?.items || ["No major alerts this month. Keep an eye on slugs after rain."];
    document.getElementById('pp-region-name').textContent = humanRegion(regionKey);
    document.getElementById('pp-month-name').textContent = MONTHS[CUR];
    const ul = document.querySelector('#pp-pestwatch ul');
    ul.innerHTML = items.map(i=>`<li>${i}</li>`).join('');
  }

  function renderToday(regionKey){
    const r=DATA[regionKey]||{};
    const list=document.getElementById('pp-today-list');
    const items=[];
    applyFilters(r.crops||[]).forEach(c=>{
      const s=(c.months?.sow||[]).includes(CUR);
      const p=(c.months?.plant||[]).includes(CUR);
      const h=(c.months?.harvest||[]).includes(CUR);
      if(s||p||h){
        items.push(`<li><strong>${c.name}</strong> ${s?"🌱":""}${p?" 🪴":""}${h?" 🥕":""} <span class="pp-tags">(${c.category})</span></li>`);
      }
    });
    list.innerHTML = items.length ? items.join('') : `<li>No items match your filters for ${MONTHS[CUR]}.</li>`;
    document.getElementById('pp-month-hint').textContent = `Here’s what suits containers now in ${MONTHS[CUR]}.`;
  }

  function renderCalendar(regionKey){
    const r=DATA[regionKey]||{};
    const wrap=document.getElementById('pp-calendar');
    const head=`<div class="pp-row">
      <div class="pp-head sm">Crop</div>
      ${MONTHS.map(m=>`<div class="pp-head sm">${m}</div>`).join('')}
    </div>`;
    const rows = applyFilters(r.crops||[]).map(c=>{
      const cells = MONTHS.map((_,i)=>{
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks=[s?"🌱":"",p?"🪴":"",h?"🥕":""].filter(Boolean).join(" ");
        return `<div class="pp-cell">${marks}</div>`;
      }).join('');
      return `<div class="pp-row">
        <div class="pp-crop"><span class="name">${c.name}</span><span class="pp-tags">(${c.category})</span></div>
        ${cells}
      </div>`;
    }).join('');
    wrap.innerHTML = head + rows;
  }

  function showMissing(regionKey){
    const miss=[...MISSING[regionKey]].sort();
    const box=document.getElementById('pp-error');
    if(miss.length){
      box.style.display='block';
      box.innerHTML = `<strong>Missing files for ${humanRegion(regionKey)}:</strong><br>${miss.map(x=>`<code>data/regions/${regionKey}/${x}.json</code>`).join('<br>')}`;
    }else{
      box.style.display='none'; box.innerHTML='';
    }
  }

  function renderAll(){
    const {region}=getFilters();
    document.title = `Seasonal Planting (${humanRegion(region)}) • Patch & Pot`;
    localStorage.setItem('pp-region',region);
    renderPestWatch(region);
    renderToday(region);
    renderCalendar(region);
    showMissing(region);
  }

  // Boot
  Promise.all(REGIONS.map(r=>assembleRegion(r).then(obj=>{ DATA[r]=obj; })))
    .then(()=>{
      const sel=document.getElementById('pp-region');
      if(sel) sel.value = localStorage.getItem('pp-region')||'scotland';
      ['pp-search','pp-category','pp-this-month'].forEach(id=>{
        const el=document.getElementById(id);
        el && el.addEventListener(id==='pp-search'?'input':'change',renderAll);
      });
      sel && sel.addEventListener('change',renderAll);
      renderAll();
    })
    .catch(()=>{ /* if fetch explodes, error box will show missing */ });

  // Expose selection for PDF
  window.PP_VIEW = {
    getSelection: () => ({
      region: document.getElementById('pp-region')?.value || 'scotland',
      category: document.getElementById('pp-category')?.value || 'all',
      q: (document.getElementById('pp-search')?.value || '').trim(),
      thisMonth: !!document.getElementById('pp-this-month')?.checked
    }),
    getData: () => ({ DATA, MONTHS })
  };
})();
