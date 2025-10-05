// Seasonal — robust renderer with block-aware filtering
// Expects data at: data/regions/<region>/{alliums,fruit,herbs,leafy,legumes,other,roots,softfruit}.json
// Optional: data/regions/<region>/pestwatch.json
(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const EMO = { sow:"🌱", plant:"🌿", harvest:"🧺" };

  const els = {
    region:    document.getElementById('regionSel'),
    cat:       document.getElementById('catSel'),
    search:    document.getElementById('searchBox'),
    monthOnly: document.getElementById('monthOnly'),
    status:    document.getElementById('status'),
    tbody:     document.getElementById('tbody'),
    pestBox:   document.getElementById('pestBox'),
    pestTitle: document.getElementById('pestTitle'),
    pestList:  document.getElementById('pestList')
  };

  // ---- fetch helpers
  function bust(url){ return `${url}${url.includes('?')?'&':'?'}v=${Date.now()}`; }
  async function fetchJSON(url){
    try{
      const r = await fetch(bust(url), { cache:'no-store' });
      if(!r.ok) throw 0;
      return await r.json();
    }catch(_){ return null; }
  }

  // ---- load region: merge all blocks, annotate crops with their source block
  async function loadRegion(region){
    const base = `data/regions/${region}`;
    const blocks = ['alliums','fruit','herbs','leafy','legumes','other','roots','softfruit'];

    const parts = await Promise.all(blocks.map(async (block) => {
      const arr = await fetchJSON(`${base}/${block}.json`);
      if (!Array.isArray(arr)) return [];
      return arr.map(c => {
        const crop = { ...c };
        crop._block = block;                        // always know the source file
        if (!crop.category) crop.category = block;  // ensure category exists for filters
        return crop;
      });
    }));

    const crops = parts.flat().filter(Boolean).filter(c => c.name);
    const pest  = await fetchJSON(`${base}/pestwatch.json`);
    return { crops, pest };
  }

  // ---- filtering
  function filterCrops(crops){
    const q = (els.search?.value || '').toLowerCase().trim();
    const cat = (els.cat?.value || 'all').toLowerCase();
    const mOnly = !!els.monthOnly?.checked;
    const m = (new Date()).getMonth();

    return (crops||[]).filter(c=>{
      if (q && !c.name.toLowerCase().includes(q)) return false;

      if (cat !== 'all') {
        // accept a match by either declared category OR source block
        const cc = (c.category || '').toLowerCase();
        const bb = (c._block   || '').toLowerCase();
        if (cc !== cat && bb !== cat) return false;
      }

      if (mOnly){
        const s=(c.months?.sow||[]).includes(m);
        const p=(c.months?.plant||[]).includes(m);
        const h=(c.months?.harvest||[]).includes(m);
        if (!(s||p||h)) return false;
      }
      return true;
    });
  }

  // ---- table rendering
  function cellMarks(c,m){
    const out=[];
    if ((c.months?.sow||[]).includes(m))     out.push(EMO.sow);
    if ((c.months?.plant||[]).includes(m))   out.push(EMO.plant);
    if ((c.months?.harvest||[]).includes(m)) out.push(EMO.harvest);
    return out.join(' ');
  }

  function renderTable(data){
    const crops = filterCrops(data.crops || []);
    if (els.status) els.status.textContent = `${titleCase(els.region?.value || 'scotland')} — ${crops.length} crops shown`;

    const frag = document.createDocumentFragment();
    crops.forEach(c=>{
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = c.name;
      tr.appendChild(tdName);

      for (let i=0;i<12;i++){
        const td = document.createElement('td');
        const marks = cellMarks(c,i);
        if (marks) td.textContent = marks;
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    });

    if (els.tbody){
      els.tbody.innerHTML = '';
      els.tbody.appendChild(frag);
    }
  }

  // ---- pest watch (current month)
  function renderPest(region, pest){
    if (!els.pestBox) return;
    if (!pest || typeof pest !== 'object'){ els.pestBox.hidden = true; return; }

    const m = String((new Date()).getMonth());
    const items = (pest[m]?.items) || [];

    if (els.pestTitle) els.pestTitle.textContent = `Pest Watch — ${MONTHS[+m]} (${titleCase(region)})`;
    if (els.pestList){
      els.pestList.innerHTML = '';
      if (!items.length){
        const li = document.createElement('li');
        li.textContent = 'No major alerts this month.';
        els.pestList.appendChild(li);
      } else {
        items.forEach(t => {
          const li = document.createElement('li');
          li.textContent = t;
          els.pestList.appendChild(li);
        });
      }
    }
    els.pestBox.hidden = false;
  }

  function titleCase(s){ return s ? s[0].toUpperCase() + s.slice(1) : s; }

  // ---- wiring
  let regionData = null;

  async function refresh(){
    const region = els.region?.value || 'scotland';

    // first load or region changed
    if (!regionData || regionData.region !== region){
      if (els.status) els.status.textContent = 'Loading…';
      const loaded = await loadRegion(region);
      regionData = { ...loaded, region };
      renderPest(region, loaded.pest);
    }

    renderTable(regionData);
  }

  // events
  if (els.region)    els.region.addEventListener('change', refresh);
  if (els.cat)       els.cat.addEventListener('change', refresh);
  if (els.monthOnly) els.monthOnly.addEventListener('change', refresh);
  if (els.search){
    let t=null;
    els.search.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(refresh,150); });
  }

  // init
  refresh();
})();
