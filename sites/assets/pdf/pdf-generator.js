/* Patch & Pot • PDF generator (html2pdf)
   - Independent of seasonal renderers
   - Reads current region/category/filter directly from DOM + DATA
   - Produces A4 portrait or landscape
*/

(function(){
  if (!window.html2pdf || !window.jspdf) {
    console.error('html2pdf / jsPDF not loaded');
    return;
  }

  // helper: current UI state (works on seasonal.html)
  function currentState(){
    const selRegion   = document.getElementById('pp-region');
    const selCat      = document.getElementById('pp-category');
    const searchEl    = document.getElementById('pp-search');
    const monthOnlyEl = document.getElementById('pp-this-month');
    const orientEl    = document.getElementById('pp-orient');

    const region = (selRegion?.value || 'scotland');
    const category = (selCat?.value || 'all');
    const q = (searchEl?.value || '').trim().toLowerCase();
    const thisMonthOnly = !!(monthOnlyEl?.checked);
    const orient = (orientEl?.value || 'portrait').toLowerCase();

    return { region, category, q, thisMonthOnly, orient };
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CUR_M = new Date().getMonth();

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo|cape gooseberry)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return"other";
  }

  function filterCrops(all, state){
    const list = (all||[]).filter(c=>c && c.name);
    return list.filter(c=>{
      const cat=(c.category||inferCategory(c.name));
      if(state.category!=='all' && cat!==state.category) return false;
      if(state.q && !c.name.toLowerCase().includes(state.q)) return false;
      if(state.thisMonthOnly){
        const s=(c.months?.sow||[]).includes(CUR_M);
        const p=(c.months?.plant||[]).includes(CUR_M);
        const h=(c.months?.harvest||[]).includes(CUR_M);
        if(!(s||p||h)) return false;
      }
      return true;
    });
  }

  // Build the entire A4 sheet (list + compact grid)
  function buildSheet(state, regionData){
    const crops = filterCrops(regionData.crops, state);

    const host = document.createElement('div');
    host.className = 'pdf-sheet';
    host.setAttribute('role','document');

    // Header
    const h = document.createElement('div');
    h.className = 'pdf-head';
    h.innerHTML = `
      <div>
        <h1 class="pdf-title">Patch &amp; Pot — ${regionData.region} (${MONTHS[CUR_M]})</h1>
        <p class="pdf-sub">${state.category==='all'?'All categories':state.category} • ${
          state.thisMonthOnly ? 'This month only' : 'Full year'
        }${state.q ? ` • Filter: “${state.q}”` : ''}</p>
      </div>
      <div class="legend" aria-label="Legend">
        <span><span class="mark sow">S</span> Sow</span>
        <span><span class="mark plant">P</span> Plant</span>
        <span><span class="mark harv">H</span> Harvest</span>
      </div>
    `;
    host.appendChild(h);

    // ---------- LIST ----------
    const listSec = document.createElement('section');
    listSec.className = 'section avoid-split';
    listSec.innerHTML = `<h2>What to grow</h2><small>Crop • (category)</small>`;
    const list = document.createElement('div');
    list.className = 'list';
    crops.forEach(c=>{
      const cat = c.category || inferCategory(c.name);
      const li = document.createElement('div');
      li.className = 'list-item';
      li.textContent = c.name + ' ';
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = `(${cat})`;
      li.appendChild(tag);
      list.appendChild(li);
    });
    listSec.appendChild(list);
    host.appendChild(listSec);

    // Page break before grid if list is long
    const br = document.createElement('div');
    br.className = 'page-break';
    host.appendChild(br);

    // ---------- GRID ----------
    const gridSec = document.createElement('section');
    gridSec.className = 'section';
    gridSec.innerHTML = `<h2>Seasonal calendar</h2><small>S= Sow • P= Plant • H= Harvest</small>`;

    const gridWrap = document.createElement('div');
    gridWrap.className = 'grid';

    // header row
    const headCrop = document.createElement('div');
    headCrop.className = 'hc';
    headCrop.textContent = 'Crop';
    gridWrap.appendChild(headCrop);
    MONTHS.forEach(m=>{
      const hc = document.createElement('div');
      hc.className = 'hc';
      hc.textContent = m;
      gridWrap.appendChild(hc);
    });

    // rows
    crops.forEach(c=>{
      const cat = c.category || inferCategory(c.name);
      const nameCell = document.createElement('div');
      nameCell.className = 'crop';
      nameCell.innerHTML = `<div>${c.name}</div><div class="meta">(${cat})</div>`;
      gridWrap.appendChild(nameCell);

      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const cell = document.createElement('div');
        cell.className = 'cell';
        // letters instead of emoji for universal PDF rendering
        cell.innerHTML = `${s?'<span class="sow">S</span>':''}${p?' <span class="plant">P</span>':''}${h?' <span class="harv">H</span>':''}`;
        gridWrap.appendChild(cell);
      }
    });

    gridSec.appendChild(gridWrap);
    host.appendChild(gridSec);

    // Watercolour wash (overall, by first crop category if filtered to single cat)
    const catForWash = (state.category!=='all' ? state.category : inferCategory(crops[0]?.name||'other')) || 'other';
    const wash = document.createElement('div');
    wash.className = `wash wash-${catForWash}`;
    host.appendChild(wash);

    document.body.appendChild(host);
    return host;
  }

  async function generate(){
    try{
      const st = currentState();
      const data = (window.DATA && window.DATA[st.region]);
      if(!data || !Array.isArray(data.crops)){
        throw new Error('DATA for region not available yet');
      }

      const sheet = buildSheet(st, data);

      const opt = {
        margin:       [10,15,12,15], // top, left, bottom, right in mm
        filename:     `patchandpot-${st.region}-${MONTHS[CUR_M]}-${st.category}.pdf`,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: st.orient },
        pagebreak:    { mode: ['css','legacy'] }
      };

      await html2pdf().set(opt).from(sheet).save();

      // cleanup
      sheet.remove();
    }catch(err){
      console.error('PDF generation failed:', err);
      alert('Sorry, PDF generation failed. Check the console for details.');
    }
  }

  // public API + wire button
  window.PP_PDF = {
    init(){
      const btn = document.getElementById('pp-pdf-btn');
      if(btn){
        btn.addEventListener('click', generate);
      }
    },
    generate // exposed in case you want to call manually
  };

  // Auto-init if button exists
  if (document.getElementById('pp-pdf-btn')) {
    window.PP_PDF.init();
  }
})();
