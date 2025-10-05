/* Patch & Pot — Seasonal (emoji table rollback; NO PDF)
   Uses existing crop-first JSONs exactly as-is:
   [
     { "name":"Carrot", "months":{ "sow":[2,3], "plant":["apr"], "harvest":[9,10] } },
     ...
   ]
   - Merges blocks: alliums, fruit, herbs, leafy, legumes, other, roots, softfruit
   - Search, category filter, and "this month only"
   - Pest Watch panel from pestwatch.json
*/
(() => {
  const $ = s => document.querySelector(s);
  const regionSel = $('#regionSel');
  const catSel    = $('#catSel');
  const searchBox = $('#searchBox');
  const monthOnly = $('#monthOnly');
  const statusEl  = $('#status');
  const debugEl   = $('#debug');
  const tbody     = $('#tbody');
  const pwBox     = $('#pestwatchBox');
  const pwTitle   = $('#pwTitle');
  const pwList    = $('#pwList');
  const helpBtn   = $('#helpBtn');
  const helpModal = $('#helpModal');
  const closeHelp = $('#closeHelp');

  const BLOCKS = ['alliums','fruit','herbs','leafy','legumes','other','roots','softfruit'];
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const NAME_TO_IDX = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const M = new Date().getMonth();

  const EMO = { sow:'🌱', plant:'🌿', harvest:'🧺' }; // emojis you preferred

  const Title = s => s.charAt(0).toUpperCase() + s.slice(1);
  function showDebug(msg){ debugEl.textContent = msg; debugEl.classList.add('show'); }
  function hideDebug(){ debugEl.textContent = ''; debugEl.classList.remove('show'); }

  async function fetchJSON(url){
    const r = await fetch(url + '?t=' + Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
    return r.json();
  }

  function monthIdx(x){
    if (typeof x === 'number') {
      if (x>=0 && x<=11) return x;
      if (x>=1 && x<=12) return x-1;
      return -1;
    }
    const s = String(x||'').trim().toLowerCase();
    if (s in NAME_TO_IDX) return NAME_TO_IDX[s];
    const n = Number(s);
    return Number.isNaN(n) ? -1 : monthIdx(n);
  }

  // Convert crop.months lists into a Set for quick lookup
  function monthSet(v){
    if (v == null) return new Set();
    let arr = [];
    if (Array.isArray(v)) arr = v;
    else if (typeof v === 'object') arr = Object.keys(v);
    else if (typeof v === 'string') arr = v.split(',').map(s=>s.trim());
    return new Set(arr.map(monthIdx).filter(i=>i>=0 && i<=11));
  }

  function renderTable(crops){
    tbody.innerHTML = '';
    crops.forEach(c=>{
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.textContent = c.name;
      tr.appendChild(name);

      const S = monthSet(c.months?.sow),
            P = monthSet(c.months?.plant),
            H = monthSet(c.months?.harvest);

      for(let i=0;i<12;i++){
        const td = document.createElement('td');
        const bits = [];
        if (S.has(i)) bits.push(EMO.sow);
        if (P.has(i)) bits.push(EMO.plant);
        if (H.has(i)) bits.push(EMO.harvest);
        td.innerHTML = bits.length ? `<span class="emoji">${bits.join(' ')}</span>` : '';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  function applyFilters(allCrops){
    const q = (searchBox.value||'').toLowerCase();
    const cat = (catSel.value||'all').toLowerCase();
    const only = monthOnly.checked;

    return allCrops.filter(c=>{
      if (!c || !c.name) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (cat !== 'all' && c._cat !== cat) return false;
      if (only){
        const s=monthSet(c.months?.sow).has(M);
        const p=monthSet(c.months?.plant).has(M);
        const h=monthSet(c.months?.harvest).has(M);
        if (!(s||p||h)) return false;
      }
      return true;
    });
  }

  async function renderPestWatch(region){
    try{
      const pw = await fetchJSON(`data/regions/${region}/pestwatch.json`);
      const entry = pw[String(M)] ?? pw[String(M+1)] ?? pw[MONTHS[M]] ?? pw[MONTHS[M].toUpperCase()] ?? {};
      const items = Array.isArray(entry.items) ? entry.items : (Array.isArray(entry) ? entry : []);
      pwTitle.textContent = `Pest Watch — ${Title(MONTHS[M])} (${Title(region)})`;
      pwList.innerHTML = '';
      (items.length ? items : ['No major alerts this month.']).forEach(t=>{
        const li = document.createElement('li'); li.textContent = t; pwList.appendChild(li);
      });
      pwBox.hidden = false;
    }catch(_){ pwBox.hidden = true; }
  }

  async function load(){
    const region = (regionSel.value||'scotland').toLowerCase();
    hideDebug();
    statusEl.textContent = 'Loading…';

    const tried=[], missing=[];
    let allCrops = [];

    // Merge crops from each existing block, tagging category as the block filename
    for (const block of BLOCKS){
      const url = `data/regions/${region}/${block}.json`;
      tried.push(url);
      try{
        const part = await fetchJSON(url);
        const arr = Array.isArray(part) ? part
                  : Array.isArray(part?.crops) ? part.crops
                  : [];
        // tag category = block (so filters can work)
        arr.forEach(c => { if (c && c.name) allCrops.push({...c, _cat:block}); });
      }catch(_){ missing.push(url); }
    }

    // Pest Watch
    renderPestWatch(region).catch(()=>{});

    // Filters + render
    const filtered = applyFilters(allCrops).sort((a,b)=> a.name.localeCompare(b.name));
    renderTable(filtered);

    statusEl.textContent = `${Title(region)} — ${filtered.length} crop${filtered.length===1?'':'s'} shown`;

    if (missing.length){
      showDebug('Missing files (skipped):\n' + missing.map(u=>' • '+u).join('\n') + '\n\nTried:\n' + tried.map(u=>' • '+u).join('\n'));
    }
  }

  // Events
  regionSel.addEventListener('change', load);
  catSel.addEventListener('change', load);
  searchBox.addEventListener('input', () => load());
  monthOnly.addEventListener('change', load);

  helpBtn.addEventListener('click', ()=> helpModal.style.display='flex');
  closeHelp.addEventListener('click', ()=> helpModal.style.display='none');
  helpModal.addEventListener('click', e=>{ if(e.target===helpModal) helpModal.style.display='none'; });

  document.addEventListener('DOMContentLoaded', load);
})();
