/* Seasonal page logic – root-absolute fetches, 12 months, emojis on page */
(function(){
  const PP_MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CUR_M=new Date().getMonth();
  const REGIONS=["scotland","england","ireland","wales"];
  const CROP_BLOCKS=["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
  let DATA={scotland:null,england:null,ireland:null,wales:null};
  const MISSING=Object.fromEntries(REGIONS.map(r=>[r,new Set()]));

  function humanRegion(k){return k? k[0].toUpperCase()+k.slice(1):""}
  function setMonthHints(){
    document.getElementById('pp-month-hint').textContent=`Here’s what suits containers now in ${PP_MONTHS[CUR_M]}.`;
    document.getElementById('pp-month-name').textContent=PP_MONTHS[CUR_M];
  }
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
  function getFilters(){
    return{
      region: document.getElementById('pp-region')?.value || 'scotland',
      q: (document.getElementById('pp-search')?.value || '').trim().toLowerCase(),
      cat: document.getElementById('pp-category')?.value || 'all',
      monthOnly: !!document.getElementById('pp-this-month')?.checked
    };
  }
  function applyFilters(list){
    const f=getFilters();
    return (list||[])
      .filter(c=>c && c.name)
      .filter(c=>{
        const name=c.name;
        const cat=(c.category||inferCategory(name));
        if(f.q && !name.toLowerCase().includes(f.q)) return false;
        if(f.cat!=='all' && cat!==f.cat) return false;
        if(f.monthOnly){
          const s=(c.months?.sow||[]).includes(CUR_M);
          const p=(c.months?.plant||[]).includes(CUR_M);
          const h=(c.months?.harvest||[]).includes(CUR_M);
          if(!(s||p||h)) return false;
        }
        return true;
      });
  }

  function fetchJSON(rootAbsUrl){
    return fetch(rootAbsUrl+`?v=${Date.now()}`, {cache:'no-store'})
      .then(r=> r.ok ? r.json() : Promise.reject(rootAbsUrl));
  }
  function loadBlock(region, block){
    const url=`/data/regions/${region}/${block}.json`;
    return fetchJSON(url).catch(()=>{ MISSING[region].add(block); return (block==='basics'||block==='pestwatch')?{}:[]; });
  }
  function assembleRegion(region){
    const metaP=Promise.all([loadBlock(region,'basics'),loadBlock(region,'pestwatch')])
      .then(([basics,pestwatch])=>({basics,pestwatch}));
    const cropP=Promise.all(CROP_BLOCKS.map(b=>loadBlock(region,b)))
      .then(parts=>parts.flat().filter(c=>c && c.name));
    return Promise.all([metaP,cropP]).then(([meta,crops])=>({
      region: humanRegion(region),
      basics: meta.basics||{},
      pestwatch: meta.pestwatch||{},
      crops
    }));
  }

  function renderPestWatch(regionKey){
    const region=DATA[regionKey]||{};
    const entry=(region.pestwatch && region.pestwatch[String(CUR_M)]) || { items:["No major alerts this month. Keep an eye on slugs after rain."] };
    document.getElementById('pp-region-name').textContent=humanRegion(regionKey);
    document.querySelector('#pp-pestwatch ul').innerHTML=(entry.items||[]).map(i=>`<li>${i}</li>`).join('') || '<li>No items.</li>';
  }
  function renderToday(regionKey){
    const region=DATA[regionKey]||{};
    const list=document.getElementById('pp-today-list');
    const items=[];
    applyFilters(region.crops||[]).forEach(c=>{
      const s=(c.months?.sow||[]).includes(CUR_M);
      const p=(c.months?.plant||[]).includes(CUR_M);
      const h=(c.months?.harvest||[]).includes(CUR_M);
      if(s||p||h){
        const tag=c.category||inferCategory(c.name);
        items.push(`<li><strong>${c.name}</strong> ${s?"🌱":""}${p?" 🪴":""}${h?" 🥕":""} <span class="pp-tags">(${tag})</span></li>`);
      }
    });
    list.innerHTML=items.length?items.join(''):`<li>No items match your filters for ${PP_MONTHS[CUR_M]}.</li>`;
  }
  function renderCalendar(regionKey){
    const region=DATA[regionKey]||{};
    const wrap=document.getElementById('pp-calendar');
    const head=`<div class="pp-row">
      <div class="pp-head sm">Crop</div>
      ${PP_MONTHS.map(m=>`<div class="pp-head sm">${m}</div>`).join('')}
    </div>`;
    const rows=applyFilters(region.crops||[]).map(c=>{
      const cat=c.category||inferCategory(c.name);
      const cells=PP_MONTHS.map((_,i)=>{
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
    wrap.innerHTML=head+rows;
  }

  function renderAll(){
    const {region}=getFilters();
    localStorage.setItem('pp-region',region);
    document.title=`Seasonal Planting (${humanRegion(region)}) • Patch & Pot`;
    setMonthHints(); renderPestWatch(region); renderToday(region); renderCalendar(region);
    const miss=[...MISSING[region]].sort();
    const box=document.getElementById('pp-error');
    if(miss.length){
      box.style.display='block';
      box.innerHTML=`<strong>Missing files for ${humanRegion(region)}:</strong><br>${miss.map(x=>`<code>/data/regions/${region}/${x}.json</code>`).join('<br>')}`;
    }else{
      box.style.display='none'; box.innerHTML='';
    }
  }

  function boot(){
    const sel=document.getElementById('pp-region');
    if(sel) sel.value=localStorage.getItem('pp-region')||'scotland';
    ['pp-search','pp-category','pp-this-month'].forEach(id=>{
      const el=document.getElementById(id); el && el.addEventListener(id==='pp-search'?'input':'change',renderAll);
    });
    sel && sel.addEventListener('change',renderAll);
    renderAll();
  }

  Promise.all(REGIONS.map(r=>assembleRegion(r).then(o=>DATA[r]=o))).then(boot);

  // Expose current selection for PDF generator
  window.PP_VIEW = {
    getSelection: () => ({
      region: document.getElementById('pp-region')?.value || 'scotland',
      category: document.getElementById('pp-category')?.value || 'all',
      q: (document.getElementById('pp-search')?.value || '').trim(),
      monthOnly: !!document.getElementById('pp-this-month')?.checked
    })
  };
})();
