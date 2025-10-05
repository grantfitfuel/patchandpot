/* Seasonal page logic – final locked version
   - Hard white text handled in HTML/CSS.
   - Correct data paths: data/regions/<region>/*.json
   - Loads ALL blocks for every region.
   - Landscape + small screens: horizontal scroll + tighter grid.
*/
(function(){
  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CUR_M=(new Date()).getMonth();
  const REGIONS=["scotland","england","ireland","wales"];
  const CROP_BLOCKS=["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
  const META_BLOCKS=["basics","pestwatch"];

  const DATA={}; // region => {basics,pestwatch,crops:[]}
  const MISSING=Object.fromEntries(REGIONS.map(r=>[r,new Set()]));
  const TRIED   =Object.fromEntries(REGIONS.map(r=>[r,[]]));

  // helpers
  const $=sel=>document.querySelector(sel);
  function human(r){ return r? r[0].toUpperCase()+r.slice(1):""; }
  function fetchJSON(url){
    TRIED[currentRegion()].push(url);
    return fetch(url+'?v='+Date.now(),{cache:'no-store'})
      .then(r=> r.ok? r.json() : Promise.reject(url));
  }
  function currentRegion(){ return $('#pp-region')?.value || 'scotland'; }

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|courgette|cucumber|squash|pumpkin|melon|berry|strawber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|tarragon|marjoram|chervil|rosemary|bay|stevia|lem|balm)/.test(n))return"herbs";
    return"other";
  }

  function getFilters(){
    return {
      region: currentRegion(),
      q: ($('#pp-search')?.value||"").trim().toLowerCase(),
      cat: $('#pp-category')?.value || 'all',
      monthOnly: !!$('#pp-this-month')?.checked
    };
  }

  function applyFilters(list){
    const f=getFilters();
    return (list||[]).filter(c=>{
      if(!c || !c.name) return false;
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

  // UI renderers
  function setMonthHints(){
    $('#pp-month-name').textContent = MONTHS[CUR_M];
    $('#pp-month-hint').textContent = `Here’s what suits containers now in ${MONTHS[CUR_M]}.`;
  }

  function renderPestWatch(region){
    const entry = (DATA[region]?.pestwatch || {})[String(CUR_M)];
    const items = entry?.items || ["No major alerts this month. Keep an eye on slugs after rain."];
    $('#pp-region-name').textContent = human(region);
    $('#pp-pestwatch ul').innerHTML = items.map(i=>`<li>${i}</li>`).join('');
  }

  function renderToday(region){
    const list=$('#pp-today-list');
    const items=[];
    applyFilters(DATA[region]?.crops||[]).forEach(c=>{
      const s=(c.months?.sow||[]).includes(CUR_M);
      const p=(c.months?.plant||[]).includes(CUR_M);
      const h=(c.months?.harvest||[]).includes(CUR_M);
      if(s||p||h){
        const tag=c.category||inferCategory(c.name);
        items.push(`<li><strong>${c.name}</strong> ${s?"🌱":""}${p?" 🪴":""}${h?" 🥕":""} <span class="pp-tags">(${tag})</span></li>`);
      }
    });
    list.innerHTML = items.length? items.join('') : `<li>No items match your filters for ${MONTHS[CUR_M]}.</li>`;
  }

  function renderCalendar(region){
    const wrap = $('#pp-calendar');
    const head = `<div class="pp-row">
      <div class="pp-head">Crop</div>
      ${MONTHS.map(m=>`<div class="pp-head">${m}</div>`).join('')}
    </div>`;
    const rows = applyFilters(DATA[region]?.crops||[]).map(c=>{
      const cat = c.category || inferCategory(c.name);
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

    // ensure scroller shows full width after orientation change
    const scroller = document.querySelector('.cal-scroller');
    if (scroller) scroller.scrollLeft = 0;
  }

  function renderAll(){
    const {region}=getFilters();
    localStorage.setItem('pp-region', region);
    document.title=`Seasonal Planting (${human(region)}) • Patch & Pot`;
    setMonthHints();
    renderPestWatch(region);
    renderToday(region);
    renderCalendar(region);

    const miss=[...MISSING[region]].sort();
    const tried=TRIED[region]||[];
    const box=$('#pp-error');
    if(miss.length){
      box.style.display='block';
      box.innerHTML = `<strong>Missing for ${human(region)}:</strong><br>${miss.join('<br>')}
        <br><br><em>Tried endpoints:</em><br>${tried.map(x=>x.replace(/\?v=.*/,'')).join('<br>')}`;
    } else {
      box.style.display='none';
      box.innerHTML='';
    }
  }

  // Data loading
  async function loadRegion(region){
    MISSING[region].clear();
    TRIED[region]=[];

    const base = `data/regions/${region}/`;
    // meta
    const basicsP = fetchJSON(base+'basics.json').catch(()=>{ MISSING[region].add('basics.json'); return {}; });
    const pestP   = fetchJSON(base+'pestwatch.json').catch(()=>{ MISSING[region].add('pestwatch.json'); return {}; });

    // crops
    const cropParts = await Promise.all(
      CROP_BLOCKS.map(f => fetchJSON(base+f+'.json').catch(()=>{ MISSING[region].add(f+'.json'); return []; }))
    );
    const crops = cropParts.flat().filter(c=>c && c.name);

    const basics = await basicsP;
    const pestwatch = await pestP;

    DATA[region] = { basics, pestwatch, crops };
  }

  // boot
  async function boot(){
    // restore region selection
    const sel=$('#pp-region');
    if(sel) sel.value = localStorage.getItem('pp-region') || 'scotland';

    // listeners
    ['#pp-search','#pp-category','#pp-this-month'].forEach(id=>{
      const el=$(id);
      el && el.addEventListener(id==='#pp-search'?'input':'change', renderAll);
    });
    sel && sel.addEventListener('change', async ()=>{
      await loadRegion(currentRegion());
      renderAll();
    });

    // initial loads for all regions (so switching is instant)
    for (const r of REGIONS) { await loadRegion(r); }
    renderAll();

    // expose selection for a PDF generator (if/when you add it)
    window.PP_VIEW = {
      getSelection: () => ({
        region: currentRegion(),
        q: ($('#pp-search')?.value||'').trim(),
        category: $('#pp-category')?.value || 'all',
        monthOnly: !!$('#pp-this-month')?.checked
      })
    };

    // keep months visible after rotate
    window.addEventListener('orientationchange', ()=>{
      setTimeout(()=> renderCalendar(currentRegion()), 250);
    });
    window.addEventListener('resize', ()=>{
      // if width changed a lot, re-render grid for correct min-widths
      renderCalendar(currentRegion());
    });
  }

  // kick off
  boot();
})();
