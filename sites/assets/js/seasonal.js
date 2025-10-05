/* Patch & Pot — Seasonal (final, no PDF)
   - Locked blocks: alliums, fruit, herbs, leafy, legumes, other, roots, softfruit
   - Month-first JSON only; merges all blocks for selected region
   - Search + Category + "This month only"
   - Pest Watch panel from pestwatch.json
   - Debug panel shows missing/invalid files
*/
(() => {
  const $ = s => document.querySelector(s);
  const regionSel = $('#regionSel');
  const catSel    = $('#catSel');
  const searchBox = $('#searchBox');
  const monthOnly = $('#monthOnly');
  const monthsWrap= $('#months');
  const statusEl  = $('#status');
  const debugEl   = $('#debug');
  const pwBox     = $('#pestwatchBox');
  const pwTitle   = $('#pwTitle');
  const pwList    = $('#pwList');
  const helpBtn   = $('#helpBtn');
  const helpModal = $('#helpModal');
  const closeHelp = $('#closeHelp');

  const BLOCKS = ['alliums','fruit','herbs','leafy','legumes','other','roots','softfruit'];
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const Title  = s => s.charAt(0).toUpperCase() + s.slice(1);
  const nowIdx = (new Date()).getMonth();

  // ---------- Utilities ----------
  function showDebug(msg){ debugEl.textContent = msg; debugEl.classList.add('show'); }
  function hideDebug(){ debugEl.textContent = ''; debugEl.classList.remove('show'); }
  async function fetchJSON(url){
    const r = await fetch(url + '?t=' + Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
    return r.json();
  }

  function clearMonths(){ monthsWrap.innerHTML = ''; }

  // ---------- Merge month-first blocks into month map with categories ----------
  function newMonthMap(){
    const out = {};
    MONTHS.forEach(k => out[k] = { sow:[], plant:[], harvest:[] });
    return out;
  }
  function pushUnique(arr, item){
    // item = {name, cat}
    if (!arr.some(x => x.name === item.name && x.cat === item.cat)) arr.push(item);
  }

  // Render one month card
  function renderMonthCard(mKey, data, filters){
    const card = document.createElement('div');
    card.className = 'month';
    card.setAttribute('role','listitem');
    card.innerHTML = `
      <h3>${Title(mKey)}</h3>
      <div class="row sow"></div>
      <div class="row plant"></div>
      <div class="row harvest"></div>
    `;
    const rows = {
      sow: card.querySelector('.row.sow'),
      plant: card.querySelector('.row.plant'),
      harvest: card.querySelector('.row.harvest')
    };

    const q = (filters.q || '').toLowerCase();
    const cat = (filters.cat || 'all').toLowerCase();

    ['sow','plant','harvest'].forEach(kind=>{
      const list = Array.isArray(data[kind]) ? data[kind] : [];
      const filtered = list.filter(it => {
        if (q && !it.name.toLowerCase().includes(q)) return false;
        if (cat !== 'all' && it.cat !== cat) return false;
        return true;
      });

      if (!filtered.length){
        const em = document.createElement('div');
        em.className = 'empty';
        em.textContent = `No ${kind}`;
        rows[kind].appendChild(em);
      } else {
        filtered.forEach(it=>{
          const pill = document.createElement('span');
          pill.className = `pill ${kind}`;
          pill.textContent = it.name;
          rows[kind].appendChild(pill);
        });
      }
    });

    monthsWrap.appendChild(card);
  }

  // ---------- Pest Watch ----------
  async function renderPestWatch(region){
    try{
      const pw = await fetchJSON(`data/regions/${region}/pestwatch.json`);
      const entry = pw[String(nowIdx)] || pw[String(nowIdx+1)] || pw[MONTHS[nowIdx]] || pw[MONTHS[nowIdx].toUpperCase()] || {};
      const items = Array.isArray(entry.items) ? entry.items : (Array.isArray(entry) ? entry : []);
      pwTitle.textContent = `Pest Watch — ${Title(MONTHS[nowIdx])} (${Title(region)})`;
      pwList.innerHTML = '';
      (items.length ? items : ['No major alerts this month.']).forEach(t=>{
        const li = document.createElement('li'); li.textContent = t; pwList.appendChild(li);
      });
      pwBox.hidden = false;
    }catch(err){
      pwBox.hidden = true; // hide if file missing
    }
  }

  // ---------- Main load ----------
  async function load(){
    const region = (regionSel.value||'scotland').toLowerCase();

    statusEl.textContent = 'Loading…';
    hideDebug();
    clearMonths();

    // Merge all known blocks for the region
    const monthMap = newMonthMap();
    const tried = [];
    const missing = [];

    for (const block of BLOCKS){
      const url = `data/regions/${region}/${block}.json`;
      tried.push(url);
      try{
        const json = await fetchJSON(url);
        const months = (json && json.months) ? json.months : null;
        if(!months){ missing.push(url + ' (wrong shape)'); continue; }

        // Add items with category = block
        MONTHS.forEach((mk, mi)=>{
          const m = months[mk] || months[mk.toUpperCase()] || {};
          const add = (kind) => {
            const src = Array.isArray(m[kind]) ? m[kind] : [];
            src.forEach(name => pushUnique(monthMap[mk][kind], {name: String(name), cat: block}));
          };
          add('sow'); add('plant'); add('harvest');
        });
      }catch(_){
        missing.push(url);
      }
    }

    // Render Pest Watch
    renderPestWatch(region).catch(()=>{});

    // Render months (optionally only current month)
    const q = searchBox.value || '';
    const cat = catSel.value || 'all';
    const filters = { q, cat };

    const toRender = monthOnly.checked ? [MONTHS[nowIdx]] : MONTHS;
    toRender.forEach(mk => renderMonthCard(mk, monthMap[mk], filters));

    statusEl.textContent = `${Title(region)} — calendar loaded`;

    if (missing.length){
      showDebug('Missing or invalid files:\n' + missing.map(x=>' • '+x).join('\n') + '\n\nTried:\n' + tried.map(x=>' • '+x).join('\n'));
    }
  }

  // ---------- Events ----------
  regionSel.addEventListener('change', load);
  searchBox.addEventListener('input', () => load());
  catSel.addEventListener('change', load);
  monthOnly.addEventListener('change', load);

  helpBtn.addEventListener('click', ()=> helpModal.classList.add('show'));
  closeHelp.addEventListener('click', ()=> helpModal.classList.remove('show'));
  helpModal.addEventListener('click', (e)=>{ if(e.target===helpModal) helpModal.classList.remove('show'); });

  // First paint
  document.addEventListener('DOMContentLoaded', load);
})();
