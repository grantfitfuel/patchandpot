/* Seasonal (final rollback)
   - Header from partials (header-loader.js) remains.
   - Emoji table (🌱 🌿 🧺), tall rows, crop names wrap.
   - Reads existing crop-first JSONs EXACTLY as-is (array OR {crops:[...]}).
   - Merges blocks: alliums, fruit, herbs, leafy, legumes, other, roots, softfruit.
   - Pest Watch shown if present. No PDF anywhere.
*/
(() => {
  const $ = s => document.querySelector(s);
  const regionSel = $('#regionSel'), catSel = $('#catSel'), searchBox = $('#searchBox'),
        monthOnly = $('#monthOnly'), statusEl = $('#status'), debugEl = $('#debug'),
        tbody = $('#tbody'), pwBox = $('#pestwatchBox'), pwTitle = $('#pwTitle'), pwList = $('#pwList');

  const BLOCKS = ['alliums','fruit','herbs','leafy','legumes','other','roots','softfruit'];
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const NAME_TO_IDX = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const M = new Date().getMonth();
  const EMO = { sow:'🌱', plant:'🌿', harvest:'🧺' };
  const Title = s => s.charAt(0).toUpperCase() + s.slice(1);
  const showDebug = msg => { debugEl.textContent = msg; debugEl.classList.add('show'); };
  const hideDebug = () => { debugEl.textContent = ''; debugEl.classList.remove('show'); };

  // Footer icon with 2-path fallback
  async function setFooterIcon(){
    const img = $('#potIcon'); if (!img) return;
    for (const p of ['/img/patchandpot-pot.png','img/patchandpot-pot.png']){
      try{ const r = await fetch(p, {cache:'no-store'}); if (r.ok){ img.src=p; return; } }catch(_){}
    }
    img.style.display='none';
  }

  async function fetchJSON(url){
    const r = await fetch(url+'?t='+Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
    return r.json();
  }

  function monthIdx(x){
    if (typeof x === 'number') return (x>=1&&x<=12)?x-1:((x>=0&&x<=11)?x:-1);
    const s = String(x||'').toLowerCase().trim();
    if (s in NAME_TO_IDX) return NAME_TO_IDX[s];
    const n = Number(s); return Number.isNaN(n) ? -1 : monthIdx(n);
  }
  function monthSet(v){
    if (v==null) return new Set();
    let arr = Array.isArray(v) ? v : (typeof v==='object' ? Object.keys(v) : String(v).split(','));
    return new Set(arr.map(monthIdx).filter(i=>i>=0&&i<=11));
  }

  function renderTable(crops){
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const c of crops){
      const tr = document.createElement('tr');
      const name = document.createElement('td'); name.textContent = c.name; tr.appendChild(name);
      const S = monthSet(c.months?.sow), P = monthSet(c.months?.plant), H = monthSet(c.months?.harvest);
      for(let i=0;i<12;i++){
        const td = document.createElement('td');
        const bits = []; if (S.has(i)) bits.push(EMO.sow); if (P.has(i)) bits.push(EMO.plant); if (H.has(i)) bits.push(EMO.harvest);
        td.innerHTML = bits.length ? `<span class="emoji">${bits.join(' ')}</span>` : '';
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
  }

  function applyFilters(all){
    const q = (searchBox.value||'').toLowerCase();
    const cat = (catSel.value||'all').toLowerCase();
    const only = monthOnly.checked;
    return all.filter(c=>{
      if (!c || !c.name) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (cat!=='all' && c._cat!==cat) return false;
      if (only){
        const s=monthSet(c.months?.sow).has(M), p=monthSet(c.months?.plant).has(M), h=monthSet(c.months?.harvest).has(M);
        if (!(s||p||h)) return false;
      }
      return true;
    });
  }

  async function renderPestWatch(region){
    try{
      const pw = await fetchJSON(`data/regions/${region}/pestwatch.json`);
      const key = MONTHS[M];
      const entry = pw[String(M)] ?? pw[key] ?? pw[key.toUpperCase()] ?? {};
      const items = Array.isArray(entry.items) ? entry.items : (Array.isArray(entry) ? entry : []);
      pwTitle.textContent = `Pest Watch — ${Title(key)} (${Title(region)})`;
      pwList.innerHTML = '';
      (items.length?items:['No major alerts this month.']).forEach(t=>{
        const li = document.createElement('li'); li.textContent = t; pwList.appendChild(li);
      });
      pwBox.hidden = false;
    }catch{ pwBox.hidden = true; }
  }

  async function load(){
    const region = (regionSel.value||'scotland').toLowerCase();
    hideDebug(); statusEl.textContent = 'Loading…';

    const tried=[], missing=[];
    const results = await Promise.allSettled(BLOCKS.map(async block=>{
      const url = `data/regions/${region}/${block}.json`; tried.push(url);
      try{
        const data = await fetchJSON(url);
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.crops) ? data.crops : []);
        return arr.filter(c=>c&&c.name).map(c=>({...c, _cat:block}));
      }catch{ missing.push(url); return []; }
    }));

    let all=[]; results.forEach(r=>{ if(r.status==='fulfilled') all=all.concat(r.value); });

    renderPestWatch(region).catch(()=>{});

    const filtered = applyFilters(all).sort((a,b)=> a.name.localeCompare(b.name));
    renderTable(filtered);
    statusEl.textContent = `${region[0].toUpperCase()+region.slice(1)} — ${filtered.length} crop${filtered.length===1?'':'s'} shown`;
    if (missing.length) showDebug('Missing files (skipped):\n'+missing.map(u=>' • '+u).join('\n')+'\n\nTried:\n'+tried.map(u=>' • '+u).join('\n'));
  }

  regionSel.addEventListener('change', load);
  catSel.addEventListener('change', load);
  searchBox.addEventListener('input', () => load());
  monthOnly.addEventListener('change', load);

  document.addEventListener('DOMContentLoaded', () => { setFooterIcon(); load(); });
})();
