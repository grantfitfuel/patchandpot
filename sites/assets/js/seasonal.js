/* Patch & Pot — Seasonal Calendar (LOCKED blocks; STRICT month-first; NO PDF) */
(() => {
  const $ = s => document.querySelector(s);
  const monthsEl = $('#months');
  const regionSel = $('#regionSel');
  const blockSel  = $('#blockSel');
  const loadBtn   = $('#loadBtn');
  const statusEl  = $('#status');
  const debugEl   = $('#debug');

  // Canonical blocks — must match files present in every region
  const BLOCKS = Object.freeze(['alliums','fruit','herbs','leafy','legumes','other','roots','softfruit']);
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const Title = s => s.charAt(0).toUpperCase() + s.slice(1);

  // If the dropdown ever includes a non-canonical value, surface it immediately
  document.addEventListener('DOMContentLoaded', () => {
    const extra = Array.from(blockSel.options).map(o=>o.value).filter(v=>!BLOCKS.includes(v));
    if (extra.length) showDebug(`ERROR: Unknown block(s) in dropdown: ${extra.join(', ')}\nAllowed: ${BLOCKS.join(', ')}`);
  });

  async function fetchJSON(url){
    const res = await fetch(url + '?t=' + Date.now(), {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
  }

  function clearMonths(){ monthsEl.innerHTML = ''; }
  function showDebug(msg){ debugEl.textContent = msg; debugEl.classList.add('show'); }
  function hideDebug(){ debugEl.textContent = ''; debugEl.classList.remove('show'); }

  function renderMonth(key, m){
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
      const list = Array.isArray(m?.[kind]) ? m[kind] : [];
      if(!list.length){
        const d = document.createElement('div');
        d.className = 'empty';
        d.textContent = `No ${kind}`;
        rows[kind].appendChild(d);
      }else{
        list.forEach(name=>{
          const pill = document.createElement('span');
          pill.className = `pill ${kind}`;
          pill.textContent = String(name);
          rows[kind].appendChild(pill);
        });
      }
    });
    monthsEl.appendChild(el);
  }

  async function load(){
    const region = (regionSel.value||'scotland').toLowerCase();
    const block  = (blockSel.value||'herbs').toLowerCase();

    if (!BLOCKS.includes(block)) {
      statusEl.textContent = 'Invalid block';
      showDebug(`"${block}" is not allowed. Allowed: ${BLOCKS.join(', ')}`);
      return;
    }

    const url = `data/regions/${region}/${block}.json`;

    clearMonths();
    statusEl.textContent = 'Loading…';
    hideDebug();

    try{
      const json = await fetchJSON(url);

      // STRICT month-first schema:
      // { "months": { "jan": { "sow":[], "plant":[], "harvest":[] }, ... } }
      const months = (json && typeof json === 'object' && json.months) ? json.months : null;
      if (!months) {
        statusEl.textContent = 'Loaded (wrong shape)';
        showDebug(
          `Loaded ${url} but expected:\n{\n  "months": {\n    "jan": { "sow":[], "plant":[], "harvest":[] },\n    "feb": { ... },\n    ...\n  }\n}`
        );
        return;
      }

      MONTHS.forEach(k => renderMonth(k, months[k] || months[k.toUpperCase()] || {}));
      statusEl.textContent = `${Title(region)} — ${Title(block)} loaded`;
    }catch(err){
      statusEl.textContent = 'Failed to load';
      showDebug(`${err.message}\nExpected at: ${url}`);
    }
  }

  loadBtn.addEventListener('click', load);
  document.addEventListener('DOMContentLoaded', load);
})();
