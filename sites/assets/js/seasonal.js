/* Patch & Pot — Seasonal Calendar (strict, no PDF, no extra blocks) */
(() => {
  const $ = s => document.querySelector(s);
  const monthsEl = $('#months');
  const regionSel = $('#regionSel');
  const blockSel  = $('#blockSel');
  const loadBtn   = $('#loadBtn');
  const statusEl  = $('#status');
  const debugEl   = $('#debug');

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const Title = s => s.charAt(0).toUpperCase() + s.slice(1);

  async function fetchJSON(url){
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error(`Missing or invalid JSON: ${url} (HTTP ${res.status})`);
    return res.json();
  }

  function clearMonths(){ monthsEl.innerHTML = ''; }

  function renderMonth(key, data){
    const wrap = document.createElement('div');
    wrap.className = 'month';
    wrap.setAttribute('role','listitem');
    wrap.innerHTML = `
      <h3>${Title(key)}</h3>
      <div class="row sow"></div>
      <div class="row plant"></div>
      <div class="row harvest"></div>
    `;
    const rows = {
      sow: wrap.querySelector('.row.sow'),
      plant: wrap.querySelector('.row.plant'),
      harvest: wrap.querySelector('.row.harvest')
    };

    ['sow','plant','harvest'].forEach(kind=>{
      const arr = Array.isArray(data?.[kind]) ? data[kind] : [];
      if(arr.length === 0){
        const em = document.createElement('div');
        em.className = 'empty';
        em.textContent = `No ${kind}`;
        rows[kind].appendChild(em);
      }else{
        arr.forEach(name=>{
          const pill = document.createElement('span');
          pill.className = `pill ${kind}`;
          pill.textContent = name;
          rows[kind].appendChild(pill);
        });
      }
    });

    monthsEl.appendChild(wrap);
  }

  async function load(){
    const region = (regionSel.value||'scotland').toLowerCase();
    const block  = (blockSel.value||'herbs').toLowerCase();
    // exact file path per your repo structure
    const url = `data/regions/${region}/${block}.json`;

    clearMonths();
    statusEl.textContent = 'Loading…';
    debugEl.textContent = '';
    debugEl.classList.remove('show');

    try{
      const json = await fetchJSON(url);
      const months = json?.months || {};
      // Render Jan → Dec in order. If a month key is missing, show empty.
      let rendered = 0;
      for (const m of MONTHS){
        renderMonth(m, months[m] || months[m.toUpperCase()] || {});
        rendered++;
      }
      statusEl.textContent = `${Title(region)} — ${Title(block)} loaded`;
      if (!rendered) {
        debugEl.textContent = `Loaded ${url} but it contained no months data.`;
        debugEl.classList.add('show');
      }
    }catch(err){
      statusEl.textContent = 'Failed to load';
      debugEl.textContent = err.message + '\n(Ensure the file exists exactly at: ' + url + ')';
      debugEl.classList.add('show');
    }
  }

  loadBtn.addEventListener('click', load);
  document.addEventListener('DOMContentLoaded', load);
})();
