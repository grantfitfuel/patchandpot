/* Patch & Pot – Local PDF builder (native print → Save as PDF)
   No CDN, no external libs. Creates an offscreen A4 sheet, fills from JSON,
   opens system print dialog. Includes Basics + Pest Watch + Calendar grid.
*/
(function(global){
  // tiny base64 pot icon (green pot glyph). Replace with your brand asset if you prefer.
  const POT_BASE64 =
    "data:image/svg+xml;base64," +
    btoa(`<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>
      <rect width='64' height='64' fill='none'/>
      <path d='M10 14h44a4 4 0 0 1 0 8H10a4 4 0 0 1 0-8z' fill='#2E7D32'/>
      <path d='M16 24h32l-4 26a6 6 0 0 1-6 5H26a6 6 0 0 1-6-5L16 24z' fill='#7ed495'/>
    </svg>`);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Read current selection from the page (seasonal.html exposes this)
  function getSelection(){
    if(global.PP_VIEW && typeof global.PP_VIEW.getSelection === 'function'){
      return global.PP_VIEW.getSelection();
    }
    // Fallback
    const region = document.getElementById('pp-region')?.value || 'scotland';
    const category = document.getElementById('pp-category')?.value || 'all';
    const q = (document.getElementById('pp-search')?.value || '').trim();
    return { region, category, q };
  }

  // Fetch one block; returns {} for meta, [] for crops if missing
  function fetchBlock(region, block){
    const url = `data/regions/${region}/${block}.json?v=${Date.now()}`;
    return fetch(url, {cache:'no-store'})
      .then(r => r.ok ? r.json() : Promise.reject())
      .catch(()=> (block==='basics'||block==='pestwatch') ? {} : []);
  }

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return "other";
  }

  function applyFilters(crops, sel){
    const q = (sel.q||'').toLowerCase();
    const cat = sel.category || 'all';
    return (crops||[])
      .filter(c=>c && c.name)
      .filter(c=>{
        const nm = c.name.toLowerCase();
        const ccat = (c.category || inferCategory(c.name));
        if(q && !nm.includes(q)) return false;
        if(cat!=='all' && ccat!==cat) return false;
        return true;
      });
  }

  function el(tag, attrs={}, html){
    const e = document.createElement(tag);
    for(const k in attrs){
      if(k==='class') e.className = attrs[k];
      else if(k==='style') e.setAttribute('style', attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if(html!=null) e.innerHTML = html;
    return e;
  }

  function buildMetaBox(basics, pestwatch, region){
    const box = el('div', {class:'pp-pdf-meta'});
    const left = el('div');
    const right = el('div');

    // Basics (if present)
    left.appendChild(el('h4', {}, 'Basics'));
    const bl = el('ul');
    const basicsLines = [];
    // pick a couple of helpful keys if present
    if(basics?.containers?.length) basicsLines.push('Containers: ' + basics.containers.join(', '));
    if(basics?.soilTips?.length) basicsLines.push('Soil: ' + basics.soilTips.join(', '));
    if(basics?.protection?.length) basicsLines.push('Protection: ' + basics.protection.join(', '));
    if(basics?.watering?.length) basicsLines.push('Watering: ' + basics.watering.join(', '));
    if(basicsLines.length===0) basicsLines.push('Compact, well-drained compost; steady watering; shelter early/late in season.');
    basicsLines.slice(0,6).forEach(t=> bl.appendChild(el('li',{},t)));
    left.appendChild(bl);

    // Pest Watch (current month if present)
    right.appendChild(el('h4', {}, `Pest Watch – ${MONTHS[new Date().getMonth()]} (${region})`));
    const pr = el('ul');
    const month = String(new Date().getMonth());
    const items = (pestwatch && pestwatch[month] && pestwatch[month].items) || [
      'Slugs/snails after rain – hand pick or traps.',
      'Ventilate covered crops to prevent mould.',
      'Check for aphids; squash early colonies.'
    ];
    items.slice(0,6).forEach(t=> pr.appendChild(el('li',{},t)));
    right.appendChild(pr);

    box.appendChild(left); box.appendChild(right);
    return box;
  }

  function buildGrid(crops){
    const grid = el('div', {class:'pp-pdf-grid'});
    // head row
    const rowHead = el('div', {class:'pp-pdf-row'});
    grid.appendChild(rowHead);
    rowHead.appendChild(el('div',{class:'pp-pdf-headcell'},'Crop'));
    MONTHS.forEach(m=> rowHead.appendChild(el('div',{class:'pp-pdf-headcell small'},m)));

    // data rows
    crops.forEach(c=>{
      const row = el('div', {class:'pp-pdf-row'});
      const cat = c.category || inferCategory(c.name);
      const cropCell = el('div', {class:'pp-pdf-headcell pp-pdf-crop'});
      cropCell.appendChild(el('div',{},c.name));
      cropCell.appendChild(el('div',{class:'pp-pdf-tag'},`(${cat})`));
      row.appendChild(cropCell);

      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks = [s?'🌱':'', p?'🪴':'', h?'🥕':''].join(' ').trim();
        row.appendChild(el('div',{class:'pp-pdf-cell'}, marks || ''));
      }
      grid.appendChild(row);
    });
    return grid;
  }

  async function loadRegion(region){
    // meta
    const basics = await fetchBlock(region,'basics');
    const pestwatch = await fetchBlock(region,'pestwatch');
    // crop blocks
    const blocks = ['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'];
    const arrays = await Promise.all(blocks.map(b=> fetchBlock(region,b).then(x=>Array.isArray(x)?x:[])));
    const crops = arrays.flat().filter(c=>c && c.name);
    return { basics, pestwatch, crops };
  }

  function buildSheet(sel, data){
    const sheet = el('section', {class:'pp-pdf-sheet'});

    // Header
    const head = el('div', {class: 'pp-pdf-head'});
    const title = el('h1', {class:'pp-pdf-title'}, `Patch & Pot – ${sel.region[0].toUpperCase()+sel.region.slice(1)}`);
    const sub = el('p', {class:'pp-pdf-sub'}, `Selection: ${sel.category==='all'?'All categories':sel.category}${sel.q?` • Filter: “${sel.q}”`:''}`);
    head.appendChild(title); head.appendChild(sub);
    sheet.appendChild(head);

    // Legend
    const legend = el('div', {class:'pp-pdf-legend'});
    legend.innerHTML = `<span class="i">🌱 Sow</span><span class="i">🪴 Plant</span><span class="i">🥕 Harvest</span>`;
    sheet.appendChild(legend);

    // Basics + PestWatch
    sheet.appendChild(buildMetaBox(data.basics, data.pestwatch, sel.region[0].toUpperCase()+sel.region.slice(1)));

    // Filter crops and grid
    const list = applyFilters(data.crops, sel);
    sheet.appendChild(buildGrid(list));

    // Footer (logo + line)
    const foot = el('div',{class:'pp-pdf-footer'});
    const logo = el('img',{class:'pp-pdf-logo', src:POT_BASE64, alt:''});
    const line = el('div',{},'© 2025 Patch & Pot | Created by Grant Cameron Anthony');
    foot.appendChild(logo); foot.appendChild(line);
    sheet.appendChild(foot);

    document.body.appendChild(sheet);
    return sheet;
  }

  async function generate(selection){
    const sel = selection || getSelection();
    const data = await loadRegion(sel.region);

    // Build and print
    const sheet = buildSheet(sel, data);

    // Use a short timeout so layout paints before print dialog
    setTimeout(()=>{
      window.print();
      // Cleanup after print (give Safari/iOS a moment)
      setTimeout(()=>{ sheet.remove(); }, 500);
    }, 50);
  }

  global.PP_PDF = { generate };
})(window);
