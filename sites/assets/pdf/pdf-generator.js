/* Patch & Pot – PDF Generator (in-page, seasonal.html)
   - Reads region & category from #pp-region and #pp-category
   - Orientation from #pdf-orient; include toggles from checkboxes
   - Loads data from /sites/data/regions/<region>/...
   - Paginates rows (no crop splits), fixed month widths
   - Footer (logo above text) appears on the last page only
*/
(function(){
  const { jsPDF } = window.jspdf;

  // Seasonal controls:
  const elRegion = document.getElementById('pp-region');
  const elCat    = document.getElementById('pp-category');
  // PDF controls:
  const elOrient = document.getElementById('pdf-orient');
  const elIncB   = document.getElementById('pdf-inc-basics');
  const elIncP   = document.getElementById('pdf-inc-pest');
  const btn      = document.getElementById('pp-generate-pdf');
  // Offscreen page root:
  const root     = document.getElementById('pdf-sheets-root');

  if(!btn || !elRegion || !elCat || !root){
    console.warn('PDF controls not present; PDF generation disabled.');
    return;
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CUR_M = new Date().getMonth();
  const BLOCKS = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
  const CAT_ALIASES = { softfruit:"softfruit" };
  const RPP = { portrait: 26, landscape: 18 }; // rows per page (excludes header row that we add per page)

  function humanRegion(k){ return k ? k[0].toUpperCase()+k.slice(1) : ""; }
  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return "other";
  }

  function fetchJSON(url){
    return fetch(url + `?v=${Date.now()}`, { cache:'no-store' }).then(r=>{
      if(!r.ok) throw new Error(`Fetch failed: ${url}`);
      return r.json();
    });
  }
  async function loadRegion(region){
    const basics    = await fetchJSON(`data/regions/${region}/basics.json`).catch(()=>({}));
    const pestwatch = await fetchJSON(`data/regions/${region}/pestwatch.json`).catch(()=>({}));
    const arrays = await Promise.all(
      BLOCKS.map(b => fetchJSON(`data/regions/${region}/${b}.json`).catch(()=>[]))
    );
    const crops = arrays.flat().filter(c => c && c.name);
    return { basics, pestwatch, crops };
  }
  function filterCrops(all, category){
    if(category === 'all') return all;
    const want = CAT_ALIASES[category] || category;
    return all.filter(c => (c.category || inferCategory(c.name)) === want);
  }
  function chunkRows(rows, perPage){
    const out=[]; for(let i=0;i<rows.length;i+=perPage){ out.push(rows.slice(i,i+perPage)); } return out;
  }
  function makeGridRows(crops){
    return crops.map(c=>{
      const cells = MONTHS.map((_, i)=>{
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks = [s?"🌱":"",p?"🪴":"",h?"🥕":""].join(' ').trim();
        return `<div class="pdf-cell">${marks}</div>`;
      }).join('');
      const cat=c.category||inferCategory(c.name);
      return `<div class="pdf-row">
        <div class="pdf-crop"><span>${c.name}</span><span class="pdf-tag">(${cat})</span></div>
        ${cells}
      </div>`;
    });
  }

  function buildPage({region, category, includeBasics, includePest, basics, pestwatch, rowsChunk, isFirst, isLast, orient}){
    const page = document.createElement('section');
    page.className = 'pdf-sheet';
    if(orient==='landscape'){ page.style.width='1123px'; page.style.minHeight='794px'; page.style.padding='24px 26px 72px'; }

    const title = `UK Seasonal Planting Calendar`;
    const sub = `${humanRegion(region)} • ${category==='all'?'All categories':category[0].toUpperCase()+category.slice(1)}`;
    page.innerHTML = `
      <div class="pdf-head">
        <h1 class="pdf-title">${title}</h1>
        <div class="pdf-sub">${sub}</div>
      </div>
      <div class="legend" aria-hidden="true">
        <span>🌱 <em>Sow</em></span>
        <span>🪴 <em>Plant</em></span>
        <span>🥕 <em>Harvest</em></span>
      </div>
    `;

    if(isFirst){
      if(includeBasics && basics && basics.summary){
        const b=document.createElement('div'); b.className='block';
        b.innerHTML=`<h3>Basics</h3><p>${basics.summary}</p>`;
        page.appendChild(b);
      }
      if(includePest && pestwatch && pestwatch[String(CUR_M)]){
        const p=document.createElement('div'); p.className='block';
        const entry = pestwatch[String(CUR_M)];
        const items = (entry.items||[]).map(i=>`<li>${i}</li>`).join('');
        p.innerHTML = `<h3>Pest Watch – ${MONTHS[CUR_M]}</h3><ul>${items}</ul>`;
        page.appendChild(p);
      }
    }

    const gridWrap = document.createElement('div'); gridWrap.className='pdf-grid-wrap';
    const grid = document.createElement('div'); grid.className='pdf-grid';
    const head = document.createElement('div'); head.className='pdf-row';
    head.innerHTML = `<div class="pdf-headcell">Crop</div>${MONTHS.map(m=>`<div class="pdf-headcell">${m}</div>`).join('')}`;
    grid.appendChild(head);
    rowsChunk.forEach(html=>{ const tmp=document.createElement('div'); tmp.innerHTML=html; grid.appendChild(tmp.firstElementChild); });
    gridWrap.appendChild(grid);
    page.appendChild(gridWrap);

    if(isLast){
      const foot=document.createElement('div'); foot.className='pdf-footer';
      foot.innerHTML = `
        <img class="logo" src="img/patchandpot-icon.png" alt="Patch &amp; Pot">
        <p>© 2025 Patch &amp; Pot | Created by Grant Cameron Anthony</p>
      `;
      page.appendChild(foot);
    }
    return page;
  }

  async function makePDF(){
    btn.disabled=true;
    try{
      const region = elRegion.value;
      const category = elCat.value;
      const orient = (document.getElementById('pdf-orient')?.value || 'portrait');
      const includeBasics = !!document.getElementById('pdf-inc-basics')?.checked;
      const includePest   = !!document.getElementById('pdf-inc-pest')?.checked;

      localStorage.setItem('pp-region', region);

      const data = await loadRegion(region);
      const filtered = filterCrops(data.crops, category).sort((a,b)=>a.name.localeCompare(b.name));
      const rows = makeGridRows(filtered);
      const perPage = RPP[orient] || RPP.portrait;
      const chunks = chunkRows(rows, perPage);

      root.innerHTML='';

      chunks.forEach((chunk, idx)=>{
        const page = buildPage({
          region, category, includeBasics, includePest,
          basics:data.basics, pestwatch:data.pestwatch,
          rowsChunk:chunk, isFirst:idx===0, isLast:idx===chunks.length-1, orient
        });
        root.appendChild(page);
      });

      const pdf = new jsPDF({ orientation: orient, unit:'pt', format:'a4' });
      const pages = Array.from(root.querySelectorAll('.pdf-sheet'));
      for(let i=0;i<pages.length;i++){
        const node = pages[i];
        const canvas = await html2canvas(node, {
          backgroundColor:'#ffffff',
          scale:2,
          logging:false,
          useCORS:true,
          allowTaint:true,
          windowWidth: node.offsetWidth,
          windowHeight: node.offsetHeight
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
        if(i < pages.length-1) pdf.addPage();
      }
      pdf.save(`patchandpot-${region}-${category}-${orient}.pdf`);
    } catch(err){
      console.error(err);
      alert('PDF generation failed. Check JSON files and try again.');
    } finally {
      btn.disabled=false;
    }
  }

  btn.addEventListener('click', makePDF);
})();
