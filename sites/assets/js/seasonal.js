/* Seasonal (rollback: emoji table; NO PDF)
   - Uses your existing crop-first JSONs EXACTLY as they are.
   - Merges blocks per region: alliums, fruit, herbs, leafy, legumes, other, roots, softfruit.
   - Renders crop rows × months (🌱, 🌿, 🧺 in cells).
   - Search, Category, "This month only" filter.
   - Pest Watch panel (non-blocking).
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

  const pwBox   = $('#pestwatchBox');
  const pwTitle = $('#pwTitle');
  const pwList  = $('#pwList');

  const BLOCKS = ['alliums','fruit','herbs','leafy','legumes','other','roots','softfruit'];
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const NAME_TO_IDX = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const M = (new Date()).getMonth();

  const EMO = { sow:'🌱', plant:'🌿', harvest:'🧺' };

  const Title = s => s.charAt(0).toUpperCase() + s.slice(1);
  const showDebug = msg => { debugEl.textContent = msg; debugEl.classList.add('show'); };
  const hideDebug = () => { debugEl.textContent = ''; debugEl.classList.remove('show'); };

  async function fetchJSON(url){
    const r = await fetch(url + '?t=' + Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
    return r.json();
  }

  // --- helpers to digest months values (0–11, 1–12, or "jan" etc.)
  function monthIdx(x){
    if (typeof x === 'number') return (x>=1 && x<=12) ? x-1 : (x>=0 && x<=11 ? x : -1);
    const s = String(x||'').trim().toLowerCase();
    if (s in NAME_TO_IDX) return NAME_TO_IDX[s];
    const n = Number(s);
    return Number.isNaN(n) ? -1 : monthIdx(n);
  }
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
    const frag = document.createDocumentFragment();

    crops.forEach(c=>{
      const tr = document.createElement('tr');

      // name cell
      const name = document.createElement('td');
      name.textContent = c.name;
      tr.appendChild(name);

      const S = monthSet(c.months?.sow);
      const P = monthSet(c.months?.plant);
      const H = monthSet(c.months?.harvest);

      for (let i=0;i<12;i++){
        const td = document.createElement('td');
        const bits = [];
        if (S.has(i)) bits.push(EMO.sow);
        if (P.has(i)) bits.push(EMO.plant);
        if (H.has(i)) bits.push(EMO.harvest);
        td.innerHTML = bits.length ? `<span class="emoji">${bits.join(' ')}</span>` : '';
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
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

  // Pest Watch (non-blocking)
  async function renderPestWatch(region){
    try{
      const pw = await fetchJSON(`data/regions/${region}/pestwatch.json`);
      const key = MONTHS[M];
      const entry = pw[String(M)] ?? pw[String(M+1)] ?? pw[key] ?? pw[key.toUpperCase()] ?? {};
      const items = Array.isArray(entry.items) ? entry.items : (Array.isArray(entry) ? entry : []);
      pwTitle.textContent = `Pest Watch — ${Title(key)} (${Title(region)})`;
      pwList.innerHTML = '';
      (items.length ? items : ['No major alerts this month.']).forEach(t=>{
        const li = document.createElement('li'); li.textContent = t; pwList.appendChild(li);
      });
      document.getElementById('pestwatchBox').hidden = false;
    }catch(_){
      document.getElementById('pestwatchBox').hidden = true;
    }
  }

  async function load(){
    const region = (regionSel.value||'scotland').toLowerCase();

    hideDebug();
    statusEl.textContent = 'Loading…';

    // Fetch all blocks, but never fail the render if any one file is missing
    const tried = [];
    const missing = [];

    const results = await Promise.allSettled(
      BLOCKS.map(async block => {
        const url = `data/regions/${region}/${block}.json`;
        tried.push(url);
        try{
          const data = await fetchJSON(url);
          const arr = Array.isArray(data) ? data : (Array.isArray(data?.crops) ? data.crops : []);
          return arr.filter(c => c && c.name).map(c => ({...c, _cat:block}));
        }catch{
          missing.push(url);
          return [];
        }
      })
    );

    // Merge crops (flat)
    let allCrops = [];
    results.forEach(r => { if (r.status === 'fulfilled') allCrops = allCrops.concat(r.value); });

    // Render Pest Watch (doesn't block)
    renderPestWatch(region).catch(()=>{});

    // Apply filters and render table
    const filtered = applyFilters(allCrops).sort((a,b)=> a.name.localeCompare(b.name));
    renderTable(filtered);

    statusEl.textContent = `${Title(region)} — ${filtered.length} crop${filtered.length===1?'':'s'} shown`;

    if (missing.length){
      showDebug('Missing files (skipped):\n' + missing.map(u=>' • '+u).join('\n') +
                '\n\nTried:\n' + tried.map(u=>' • '+u).join('\n'));
    }
  }

  // events
  regionSel.addEventListener('change', load);
  catSel.addEventListener('change', load);
  searchBox.addEventListener('input', () => load());
  monthOnly.addEventListener('change', load);

  // help modal (non-intrusive)
  document.getElementById('helpBtn').addEventListener('click', () => {
    const m = document.getElementById('helpModal'); if (m) m.style.display='flex';
  });
  const hm = document.getElementById('helpModal');
  if (hm){
    hm.addEventListener('click', e=>{ if(e.target===hm) hm.style.display='none'; });
    const ch = document.getElementById('closeHelp');
    if (ch) ch.addEventListener('click', ()=> hm.style.display='none');
  }

  document.addEventListener('DOMContentLoaded', load);
})();
