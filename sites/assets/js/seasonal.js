/* Patch & Pot — Seasonal Generator (final-lock-3)
   - Loads JSON from data/regions/{region}/{block}.json
   - Renders Jan–Dec with Sow / Plant / Harvest
   - Works for all regions (not just herbs)
   - Debug panel prints *missing* and *tried* endpoints
   - PDF button uses print stylesheet in seasonal.html
*/

(() => {
  const $ = s => document.querySelector(s);
  const monthsEl = $('#months');
  const regionSel = $('#regionSel');
  const blockSel  = $('#blockSel');
  const loadBtn   = $('#loadBtn');
  const pdfBtn    = $('#pdfBtn');
  const statusEl  = $('#status');
  const debugEl   = $('#debug');

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const titleCase = s => (s||'').replace(/\b\w/g, c => c.toUpperCase());

  // ---- RENDER ----
  function clearMonths(){
    monthsEl.innerHTML = '';
  }
  function renderMonth(name, data){
    const div = document.createElement('div');
    div.className = 'month';
    div.setAttribute('role','listitem');
    div.innerHTML = `
      <h3>${titleCase(name)}</h3>
      <div class="row sow"></div>
      <div class="row plant"></div>
      <div class="row harvest"></div>
    `;
    const rows = {
      sow: div.querySelector('.row.sow'),
      plant: div.querySelector('.row.plant'),
      harvest: div.querySelector('.row.harvest')
    };
    const m = normaliseMonth(data);
    ['sow','plant','harvest'].forEach(kind => {
      const arr = Array.isArray(m[kind]) ? m[kind] : [];
      if(arr.length === 0){
        const em = document.createElement('div');
        em.className = 'empty';
        em.textContent = `No ${kind}`;
        rows[kind].appendChild(em);
      } else {
        arr.forEach(item => {
          const span = document.createElement('span');
          span.className = `pill ${kind}`;
          span.textContent = item;
          rows[kind].appendChild(span);
        });
      }
    });
    monthsEl.appendChild(div);
  }

  function normaliseMonth(x){
    // Accepts { sow:[], plant:[], harvest:[] } but also tolerates
    // alternative keys/casing like SOW/Plant/Harvest
    const out = {sow:[], plant:[], harvest:[]};
    if(!x || typeof x !== 'object') return out;
    const map = {};
    Object.keys(x).forEach(k => map[k.trim().toLowerCase()] = x[k]);
    out.sow = toArray(map.sow);
    out.plant = toArray(map.plant);
    out.harvest = toArray(map.harvest);
    return out;
  }
  function toArray(v){
    if(Array.isArray(v)) return v;
    if(v == null) return [];
    if(typeof v === 'string') return v.split(',').map(s=>s.trim()).filter(Boolean);
    return [];
  }

  // ---- DATA LOAD ----
  async function load(){
    const region = (regionSel.value||'scotland').toLowerCase();
    const block  = (blockSel.value||'herbs').toLowerCase();

    clearMonths();
    statusEl.textContent = 'Loading…';
    debugEl.classList.remove('show');
    debugEl.textContent = '';

    const base = 'data/regions';
    const url = `${base}/${region}/${block}.json`;
    const tried = [url];

    let json;
    try{
      json = await fetchJSON(url);
    }catch(err){
      // Keep to the *exact* path rule, but report clearly.
      showDebug({ missing:[url], tried });
      statusEl.textContent = 'Some files are missing. See debug below.';
      return;
    }

    const months = (json.months || json || {});
    MONTHS.forEach(m => {
      renderMonth(m, months[m] || months[m.toUpperCase()] || {});
    });

    statusEl.textContent = `${titleCase(region)} — ${titleCase(block)} loaded`;
  }

  async function fetchJSON(url){
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function showDebug({missing=[], tried=[]}){
    const lines = [];
    if(missing.length){
      lines.push('Missing for:');
      missing.forEach(u => lines.push('  • ' + u));
    }
    if(tried.length){
      if(lines.length) lines.push('');
      lines.push('Tried endpoints:');
      tried.forEach(u => lines.push('  • ' + u));
    }
    debugEl.textContent = lines.join('\n');
    debugEl.classList.add('show');
  }

  // ---- EVENTS ----
  loadBtn.addEventListener('click', load);
  pdfBtn.addEventListener('click', () => window.print());

  // First paint
  document.addEventListener('DOMContentLoaded', load);
})();
