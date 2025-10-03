/* Patch & Pot – PDF generator (locked) */
(function(){
  function injectCriticalCssOnce(){
    if(document.getElementById('pp-pdf-critical')) return;
    const css = `
    .pdf-sheet{position:fixed;left:-99999px;top:0;width:794px;min-height:1123px;box-sizing:border-box;
      padding:28px 26px 30px;background:#fff;color:#1a1f1c;font:16px/1.45 system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif}
    .pdf-head{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 8px}
    .pdf-title{font-weight:800;font-size:26px;letter-spacing:.2px;margin:0}
    .pdf-sub{color:#4c5a53;margin:0 0 10px;font-size:14px}
    .legend{display:flex;gap:18px;align-items:center;font-size:14px;margin:6px 0 12px}
    .legend span{display:inline-flex;align-items:center;gap:.35rem}
    .pdf-grid{display:grid;grid-template-columns:minmax(210px,1.1fr) repeat(12,1fr);border:1px solid #d9e3dc;border-radius:12px;overflow:hidden}
    .pdf-row{display:contents}
    .pdf-headcell,.pdf-cell{border:1px solid #e5eee8;padding:8px 10px;font-size:13px}
    .pdf-headcell{font-weight:700;background:#f4f8f5}
    .pdf-crop{font-weight:700;background:#f7faf8;display:flex;flex-direction:column;gap:4px}
    .pdf-tag{font-weight:600;color:#6b7c73;font-size:12px}
    .pdf-meta{color:#4c5a53;font-size:12px}
    .wash{position:absolute;inset:0;pointer-events:none;opacity:.22;mix-blend-mode:multiply}
    .wash-other{background:
      radial-gradient(600px 340px at 14% 20%, #e7eee5 0, transparent 60%),
      radial-gradient(520px 300px at 88% 68%, #d8e5d4 0, transparent 65%),
      radial-gradient(420px 260px at 42% 90%, #f1f5f0 0, transparent 55%)}
    .pp-box{background:#131a16;color:#e6f0ea;border-radius:10px;padding:10px 12px;margin:6px 0;border:1px solid #2b332f}
    .pp-box h3{margin:.1rem 0 .35rem 0;font-size:16px}
    .pp-box ul{margin:.4rem 0 0;padding-left:1rem}
    .pp-stack{display:flex;flex-direction:column;gap:6px;margin:6px 0 10px}
    .pdf-foot{display:flex;justify-content:center;gap:8px;align-items:center;margin-top:12px;color:#4c5a53;font-size:12px}
    .pdf-foot .sep{opacity:.6}
    `;
    const tag=document.createElement('style');
    tag.id='pp-pdf-critical';
    tag.textContent=css;
    document.head.appendChild(tag);
  }

  function monthName(i){ return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]; }
  function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }

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

  function buildSheet(state){
    const {region, category, q, data} = state;
    const sheet=el('section','pdf-sheet');
    sheet.appendChild(el('div','wash wash-other',''));

    // header
    const head=el('div','pdf-head');
    head.append(el('h1','pdf-title',`Seasonal Planting — ${region[0].toUpperCase()+region.slice(1)}`));
    head.append(el('div','pdf-meta',`${category==='all'?'All categories':category} • Generated ${new Date().toLocaleDateString('en-GB')}`));
    sheet.appendChild(head);
    const legend=el('div','legend','<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>');
    sheet.appendChild(legend);

    // basics + pest watch
    const stack=el('div','pp-stack');
    const basicsBox=el('div','pp-box');
    basicsBox.append(el('h3',null,'Basics'));
    basicsBox.append(el('p','pdf-meta',(data?.basics?.tips && data.basics.tips.join(' • ')) || 'Good hygiene, drainage, right pot size, and consistent watering.'));
    const m=(new Date()).getMonth();
    const pwe=(data?.pestwatch && data.pestwatch[String(m)]) || { items: ['Keep an eye on slugs after rain.'] };
    const pwBox=el('div','pp-box');
    pwBox.append(el('h3',null,`Pest Watch – ${monthName(m)}`));
    pwBox.append(el('ul',null,pwe.items.map(i=>`<li>${i}</li>`).join('')));
    stack.append(basicsBox,pwBox);
    sheet.appendChild(stack);

    // grid
    const grid=el('div','pdf-grid');
    const headRow=el('div','pdf-row');
    headRow.append(el('div','pdf-headcell','Crop'));
    for(let i=0;i<12;i++) headRow.append(el('div','pdf-headcell',monthName(i)));
    grid.append(headRow);

    const crops=(data?.crops||[]).filter(c=>{
      if(!c||!c.name) return false;
      if(category && category!=='all'){ if(inferCategory(c.name)!==category) return false; }
      if(q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });

    crops.forEach(c=>{
      const row=el('div','pdf-row');
      const tag=`(${inferCategory(c.name)})`;
      row.append(el('div','pdf-cell pdf-crop',`<div><strong>${c.name}</strong></div><div class="pdf-tag">${tag}</div>`));
      for(let m=0;m<12;m++){
        const s=(c.months?.sow||[]).includes(m);
        const p=(c.months?.plant||[]).includes(m);
        const h=(c.months?.harvest||[]).includes(m);
        const marks=[s?'🌱':'',p?'🪴':'',h?'🥕':''].join(' ').trim();
        row.append(el('div','pdf-cell',marks));
      }
      grid.append(row);
    });

    sheet.appendChild(grid);

    // footer
    sheet.appendChild(el('div','pdf-foot','<span class="brand">© 2025 Patch &amp; Pot</span><span class="sep">|</span><span>Created by Grant Cameron Anthony</span>'));
    return sheet;
  }

  async function toPDF(sheet, filename){
    // wait fonts to avoid blank render
    if(document.fonts && document.fonts.ready){ try{ await document.fonts.ready; }catch{} }
    const { jsPDF } = window.jspdf;
    const a4 = { w: 210, h: 297 }; // mm

    const canvas = await html2canvas(sheet, { backgroundColor:'#ffffff', scale:2 });
    const img = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });

    const imgW=a4.w-20, imgH=imgW*canvas.height/canvas.width;
    if(imgH<=a4.h-20){
      pdf.addImage(img,'JPEG',10,10,imgW,imgH,'','FAST');
    }else{
      let sY=0;
      const pagePxHeight = canvas.height*((a4.h-20)/imgH);
      while(sY < canvas.height){
        const cut = document.createElement('canvas');
        cut.width = canvas.width;
        cut.height = Math.min(pagePxHeight, canvas.height - sY);
        cut.getContext('2d').drawImage(canvas,0,sY,canvas.width,cut.height,0,0,canvas.width,cut.height);
        const part = cut.toDataURL('image/jpeg',0.92);
        pdf.addImage(part,'JPEG',10,10,imgW,(a4.h-20),'','FAST');
        sY += cut.height;
        if(sY < canvas.height) pdf.addPage();
      }
    }
    pdf.save(filename);
  }

  window.PP_PDF = {
    async generate(state){
      if(!state){ throw new Error('No state'); }
      if(!state.data || !state.data.crops || !state.data.crops.length){
        throw new Error('No data for selected region.');
      }
      injectCriticalCssOnce();

      const host=document.createElement('div');
      host.style.position='fixed'; host.style.left='-99999px'; host.style.top='0';
      document.body.appendChild(host);

      const sheet=buildSheet(state);
      host.appendChild(sheet);

      const fname=`Seasonal_${state.region}_${new Date().toISOString().slice(0,10)}.pdf`;
      try{
        await toPDF(sheet,fname);
      } finally {
        document.body.removeChild(host);
      }
    }
  };
})();
