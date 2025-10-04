/* Patch & Pot – PDF generator (A4, multi-page) */
(function(){
  const PP_MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const BLOCKS_META=['basics','pestwatch'];
  const BLOCKS_CROPS=['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'];

  function html(tag, attrs={}, content=''){
    const el=document.createElement(tag);
    Object.entries(attrs||{}).forEach(([k,v])=>{ if(v!=null) el.setAttribute(k,v); });
    if(typeof content==='string') el.innerHTML=content;
    else if(Array.isArray(content)) content.forEach(c=>el.appendChild(c));
    else if(content instanceof Node) el.appendChild(content);
    return el;
  }

  async function fetchJSON(url){
    const res = await fetch(url+`?v=${Date.now()}`,{cache:'no-store'});
    if(!res.ok) throw new Error('fetch:'+url);
    return res.json();
  }

  async function loadRegion(regionKey){
    // meta
    const [basics,pest]=await Promise.all([
      fetchJSON(`data/regions/${regionKey}/basics.json`).catch(()=>({})),
      fetchJSON(`data/regions/${regionKey}/pestwatch.json`).catch(()=>({}))
    ]);
    // crops from all blocks
    const parts = await Promise.all(
      BLOCKS_CROPS.map(b=>fetchJSON(`data/regions/${regionKey}/${b}.json`).catch(()=>[]))
    );
    const crops = parts.flat().filter(c=>c && c.name);
    return { basics, pestwatch:pest, crops };
  }

  function buildGridDoc(doc, crops, opts){
    // Title bar
    const title = html('div',{class:'pdf-titlebar'},
      `<h2 class="pdf-title">Seasonal Planting — ${opts.regionName}</h2>
       <p class="pdf-sub">Filter: ${opts.category==='all'?'All categories':opts.category}</p>`
    );
    doc.appendChild(title);

    // Legend
    doc.appendChild(html('div',{class:'pdf-legend'},
      `<span>🌱 <em>Sow</em></span><span>🪴 <em>Plant</em></span><span>🥕 <em>Harvest</em></span>`
    ));

    // Grid
    const grid=html('div',{class:'pdf-grid'});
    // header row
    const headRow=html('div',{class:'pdf-row'});
    headRow.appendChild(html('div',{class:'pdf-headcell'},'Crop'));
    PP_MONTHS.forEach(m=> headRow.appendChild(html('div',{class:'pdf-headcell'}, m)) );
    grid.appendChild(headRow);

    // rows
    crops.forEach(c=>{
      const r=html('div',{class:'pdf-row'});
      const tag=c.category?c.category:inferCategory(c.name);
      r.appendChild(html('div',{class:'pdf-cell pdf-crop'},
        `<span>${c.name}</span><span class="pdf-tag">(${tag})</span>`
      ));
      PP_MONTHS.forEach((_,i)=>{
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        r.appendChild(html('div',{class:'pdf-cell'}, `${s?"🌱 ":""}${p?"🪴 ":""}${h?"🥕":""}`.trim()));
      });
      grid.appendChild(r);
    });
    doc.appendChild(grid);

    // Branding footer
    const foot=html('div',{class:'pdf-footer'},`
      <span class="brandline">
        <img src="img/patchandpot-icon.png" onerror="this.style.display='none'"/>
        © 2025 Patch &amp; Pot | Created by Grant Cameron Anthony
      </span>`);
    doc.appendChild(foot);
  }

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return"other";
  }

  function applyFilters(allCrops, sel){
    const q=(sel.q||'').trim().toLowerCase();
    return allCrops.filter(c=>{
      if(!c?.name) return false;
      if(q && !c.name.toLowerCase().includes(q)) return false;
      if(sel.category && sel.category!=='all'){
        const cat=c.category||inferCategory(c.name);
        if(cat!==sel.category) return false;
      }
      return true;
    });
  }

  async function buildSheets(selection){
    const {region,category,q,includeMeta,orient}=selection;
    const regionName = region[0].toUpperCase()+region.slice(1);
    const data = await loadRegion(region);

    const sheets=[];
    const sheet = html('section',{class:'pdf-sheet', 'data-orient':orient});

    // Optional Basics & Pest (first page, compact)
    if(includeMeta){
      const basics = data.basics?.text || "Good hygiene, drainage, right pot size, and consistent watering.";
      const month= new Date().getMonth();
      const pestItems = (data.pestwatch && data.pestwatch[String(month)]?.items) || ["No major alerts this month. Keep an eye on slugs after rain."];

      const info = html('div',{class:'info-card'});
      info.appendChild(html('h4',{},'Basics'));
      info.appendChild(html('div',{}, basics));
      info.appendChild(html('h4',{}, 'Pest Watch – ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month]));
      const ul=html('ul',{},'');
      pestItems.forEach(i=> ul.appendChild(html('li',{},i)) );
      info.appendChild(ul);
      sheet.appendChild(info);
    }

    const crops = applyFilters(data.crops, {category,q});
    buildGridDoc(sheet, crops, {regionName,category});
    sheets.push(sheet);
    return sheets;
  }

  async function renderToPDF(selection){
    const sheets = await buildSheets(selection);

    // Render each sheet via html2canvas → add to jsPDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: (selection.orient==='landscape'?'landscape':'portrait'), unit:'pt', format:'a4' });

    for(let i=0;i<sheets.length;i++){
      const node=sheets[i];
      document.body.appendChild(node); // must be in DOM for html2canvas
      // scale canvas to page width while keeping aspect
      const canvas = await html2canvas(node, { backgroundColor:'#ffffff', scale:2, useCORS:true });
      const img = canvas.toDataURL('image/png');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW/canvas.width, pageH/canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      const x = (pageW - w)/2, y=(pageH - h)/2;
      if(i>0) pdf.addPage();
      pdf.addImage(img, 'PNG', x, y, w, h, undefined, 'FAST');
      node.remove();
    }
    pdf.save(`patchandpot-seasonal-${selection.region}.pdf`);
  }

  window.PP_PDF = {
    generate: async (sel)=>{ await renderToPDF(sel); }
  };
})();
