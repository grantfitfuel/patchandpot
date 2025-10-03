/* Patch & Pot – robust PDF generator (self-fetching) */
(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function inferCategory(name){
    const n=(name||'').toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return"other";
  }

  function cssCritical(){
    if(document.getElementById('pp-pdf-critical')) return;
    const s=document.createElement('style'); s.id='pp-pdf-critical';
    s.textContent = `
    .pdf-host{position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;z-index:-1}
    .pdf-sheet{position:relative;width:794px;min-height:1123px;box-sizing:border-box;padding:28px 26px 30px;background:#fff;color:#1a1f1c;font:16px/1.45 system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif}
    .pdf-head{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 8px}
    .pdf-title{font-weight:800;font-size:26px;letter-spacing:.2px;margin:0}
    .pdf-sub{color:#4c5a53;margin:0 0 10px;font-size:14px}
    .legend{display:flex;gap:18px;align-items:center;font-size:14px;margin:6px 0 12px}
    .legend span{display:inline-flex;align-items:center;gap:.35rem}
    .pdf-grid{display:grid;grid-template-columns:minmax(210px,1.1fr) repeat(12,1fr);border:1px solid #d9e3dc;border-radius:12px;overflow:hidden}
    .pdf-row{display:contents}
    .pdf-headcell,.pdf-cell{border:1px solid #e5eee8;padding:8px 10px;font-size:13px}
    .pdf-headcell{font-weight:700;background:#f4f8f5;white-space:nowrap}
    .pdf-crop{font-weight:700;background:#f7faf8;display:flex;flex-direction:column;gap:4px}
    .pdf-tag{font-weight:600;color:#6b7c73;font-size:12px}
    .pp-box{background:#131a16;color:#e6f0ea;border-radius:10px;padding:10px 12px;margin:8px 0;border:1px solid #2b332f}
    .pp-box h3{margin:.1rem 0 .35rem 0;font-size:16px}
    .pp-box ul{margin:.4rem 0 0;padding-left:1rem}
    .pdf-foot{display:flex;justify-content:center;gap:8px;align-items:center;margin-top:12px;color:#4c5a53;font-size:12px}
    .pdf-foot .sep{opacity:.6}
    `;
    document.head.appendChild(s);
  }

  function E(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  const monthName = i => MONTHS[i];

  async function fetchJSON(url){
    const r = await fetch(url+`?v=${Date.now()}`, {cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status+' '+url);
    return r.json();
  }
  async function fetchRegion(region){
    const base = `data/regions/${region}`;
    const basics    = await fetchJSON(`${base}/basics.json`).catch(()=>({tips:[]}));
    const pestwatch = await fetchJSON(`${base}/pestwatch.json`).catch(()=>({}));
    const parts = await Promise.all(['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other']
                  .map(b => fetchJSON(`${base}/${b}.json`).catch(()=>[])));
    const crops = parts.flat().filter(c=>c && c.name);
    return { basics, pestwatch, crops };
  }

  function buildSheet({ region, category, q, data }){
    cssCritical();
    const host = E('div','pdf-host'); document.body.appendChild(host);

    const sheet = E('section','pdf-sheet');
    const head = E('div','pdf-head');
    head.append(E('h1','pdf-title',`Seasonal Planting — ${region[0].toUpperCase()+region.slice(1)}`));
    head.append(E('div','pdf-sub',`${category==='all'?'All categories':category} • Generated ${new Date().toLocaleDateString('en-GB')}`));
    sheet.appendChild(head);

    sheet.appendChild(E('div','legend','<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>'));

    // Basics & Pest Watch (one compact bar)
    const m=(new Date()).getMonth();
    const basics = (data.basics?.tips && data.basics.tips.length) ? data.basics.tips.join(' • ') : 'Good hygiene, drainage, right pot size, and consistent watering.';
    const items  = (data.pestwatch && data.pestwatch[String(m)] && data.pestwatch[String(m)].items) || ['Keep an eye on slugs after rain.'];
    const blk = E('div','pp-box');
    blk.innerHTML = `<h3>Basics</h3><p style="margin:.2rem 0 .4rem 0">${basics}</p><h3>Pest Watch – ${monthName(m)}</h3><ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
    sheet.appendChild(blk);

    // Grid
    const grid = E('div','pdf-grid');
    const headRow = E('div','pdf-row');
    headRow.append(E('div','pdf-headcell','Crop'));
    for(let i=0;i<12;i++) headRow.append(E('div','pdf-headcell',monthName(i)));
    grid.append(headRow);

    const filterQ = (q||'').trim().toLowerCase();
    const rows = data.crops.filter(c=>{
      if(!c||!c.name) return false;
      const cat = inferCategory(c.name);
      if(category!=='all' && cat!==category) return false;
      if(filterQ && !c.name.toLowerCase().includes(filterQ)) return false;
      return true;
    });

    rows.forEach(c=>{
      const row=E('div','pdf-row');
      const cat=inferCategory(c.name);
      row.append(E('div','pdf-cell pdf-crop',`<div><strong>${c.name}</strong></div><div class="pdf-tag">(${cat})</div>`));
      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        row.append(E('div','pdf-cell',[s?'🌱':'',p?'🪴':'',h?'🥕':''].join(' ').trim()));
      }
      grid.append(row);
    });

    sheet.appendChild(grid);
    sheet.appendChild(E('div','pdf-foot','<span>© 2025 Patch &amp; Pot</span><span class="sep">|</span><span>Created by Grant Cameron Anthony</span>'));

    host.appendChild(sheet);
    return { host, sheet };
  }

  async function renderToPDF(sheet, filename){
    // iOS/Safari: keep element in DOM & visible for html2canvas, but hide via visibility
    if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch{} }
    const { jsPDF } = window.jspdf;
    const a4 = { w:210, h:297 };

    // ensure top-left to avoid transforms messing capture
    window.scrollTo(0,0);

    const canvas = await html2canvas(sheet,{
      scale:2,
      backgroundColor:'#ffffff',
      useCORS:true,
      allowTaint:true,
      windowWidth: sheet.offsetWidth,
      windowHeight: sheet.offsetHeight
    });

    const img = canvas.toDataURL('image/jpeg',0.92);
    const pdf = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });
    const margin=10;
    const imgW=a4.w-2*margin;
    const imgH=imgW*canvas.height/canvas.width;

    if(imgH<=a4.h-2*margin){
      pdf.addImage(img,'JPEG',margin,margin,imgW,imgH,'','FAST');
    }else{
      // paginate vertically
      let y=0;
      const pagePx = Math.floor(canvas.height*((a4.h-2*margin)/imgH));
      while(y<canvas.height){
        const part=document.createElement('canvas');
        part.width=canvas.width;
        part.height=Math.min(pagePx, canvas.height-y);
        part.getContext('2d').drawImage(canvas,0,y,canvas.width,part.height,0,0,canvas.width,part.height);
        const data=part.toDataURL('image/jpeg',0.92);
        pdf.addImage(data,'JPEG',margin,margin,imgW,(a4.h-2*margin),'','FAST');
        y+=part.height;
        if(y<canvas.height) pdf.addPage();
      }
    }
    pdf.save(filename);
  }

  window.PP_PDF = {
    async generate(sel){
      try{
        const region = (sel.region||'scotland').toLowerCase();
        const category = sel.category||'all';
        const q = sel.q||'';

        // fetch region data fresh (decoupled from page timing)
        const data = await fetchRegion(region);
        if(!data.crops || !data.crops.length){ alert('No crops found for region.'); return; }

        const { host, sheet } = buildSheet({region, category, q, data});
        try{
          const fname=`Seasonal_${region}_${new Date().toISOString().slice(0,10)}.pdf`;
          await renderToPDF(sheet,fname);
        } finally {
          document.body.removeChild(host);
        }
      } catch(err){
        alert('Sorry, PDF generation failed.');
      }
    }
  };
})();
