/* Patch & Pot — Seasonal Calendar (strict pulls; supports both JSON schemas; no PDF) */
(() => {
  const $ = s => document.querySelector(s);
  const monthsEl = $('#months');
  const regionSel = $('#regionSel');
  const blockSel  = $('#blockSel');
  const loadBtn   = $('#loadBtn');
  const statusEl  = $('#status');
  const debugEl   = $('#debug');

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const NAME_TO_IDX = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const Title = s => s.charAt(0).toUpperCase() + s.slice(1);

  async function fetchJSON(url){
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
  }

  function clearMonths(){ monthsEl.innerHTML = ''; }

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

  // --- Normalise to month-first: { jan:{sow:[names],plant:[names],harvest:[names]}, ... }
  function toMonthFirst(json){
    // Schema A: already month-first
    if (json && typeof json === 'object' && json.months) {
      const out = {};
      MONTHS.forEach(k=>{
        const m = json.months[k] || json.months[k.toUpperCase()] || {};
        out[k] = {
          sow:     Array.isArray(m.sow)     ? m.sow     : [],
          plant:   Array.isArray(m.plant)   ? m.plant   : [],
          harvest: Array.isArray(m.harvest) ? m.harvest : []
        };
      });
      return {schema:'month-first', months:out};
    }

    // Schema B: crop-first array
    if (Array.isArray(json)) {
      const out = {};
      MONTHS.forEach(k=> out[k] = {sow:[], plant:[], harvest:[]});
      json.forEach(crop=>{
        if (!crop || !crop.name) return;
        const m = crop.months || {};
        const kinds = ['sow','plant','harvest'];
        kinds.forEach(kind=>{
          const raw = m[kind];
          let arr = [];
          if (Array.isArray(raw)) arr = raw;
          else if (typeof raw === 'object' && raw) arr = Object.keys(raw);
          else if (typeof raw === 'string') arr = raw.split(',').map(s=>s.trim());
          arr.map(monthIdx).filter(i=>i>=0&&i<=11).forEach(i=>{
            out[MONTHS[i]][kind].push(crop.name);
          });
        });
      });
      return {schema:'crop-first', months:out};
    }

    return {schema:'unknown', months:{}};
  }

  function renderMonth(key, data){
    const el = document.createElement('div');
    el.className = 'month';
    el.setAttribute('role','listitem');
    el.innerHTML = `
      <h3>${Title(key)}</h3>
      <div class="row sow"></div>
      <div class="row plant"></div>
      <div class="row harvest"></div>
    `;
    const rows = {
      sow: el.querySelector('.row.sow'),
      plant: el.querySelector('.row.plant'),
      harvest: el.querySelector('.row.harvest')
    };
    ['sow','plant','harvest'].forEach(kind=>{
      const arr = Array.isArray(data?.[kind]) ? data[kind] : [];
      if (!arr.length){
        const em = document.createElement('div');
        em.className = 'empty';
        em.textContent = `No ${kind}`;
        rows[kind].appendChild(em);
      } else {
        arr.forEach(name=>{
          const pill = document.createElement('span');
          pill.className = `pill ${kind}`;
          pill.textContent = name;
          rows[kind].appendChild(pill);
        });
      }
    });
    monthsEl.appendChild(el);
  }

  async function load(){
    const region = (regionSel.value||'scotland').toLowerCase();
    const block  = (blockSel.value||'herbs').toLowerCase();
    const url = `data/regions/${region}/${block}.json`;

    clearMonths();
    statusEl.textContent = 'Loading…';
    debugEl.textContent = '';
    debugEl.classList.remove('show');

    try{
      const raw = await fetchJSON(url);
      const {schema, months} = toMonthFirst(raw);

      if (!months || !Object.keys(months).length){
        statusEl.textContent = 'Loaded (no data)';
        debugEl.textContent = `Loaded ${url} but found no months. Schema detected: ${schema}.`;
        debugEl.classList.add('show');
        return;
      }

      MONTHS.forEach(k => renderMonth(k, months[k] || {}));
      statusEl.textContent = `${Title(region)} — ${Title(block)} loaded`;
      // If schema was crop-first, you’ll now see crop names under each month.
    }catch(err){
      statusEl.textContent = 'Failed to load';
      debugEl.textContent = `${err.message}\nExpected at: ${url}`;
      debugEl.classList.add('show');
    }
  }

  loadBtn.addEventListener('click', load);
  document.addEventListener('DOMContentLoaded', load);
})();
