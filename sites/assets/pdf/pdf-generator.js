/* Patch & Pot – PDF generator (locked) */
(function(){
  const BRAND = {
    ink: '#1a1f1c',
    line: '#d9e3dc',
    wash: '#eef5ef',
    green: '#2f8f4a',
    inkSoft: '#4c5a53'
  };

  function monthName(i){ return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]; }

  function el(tag, cls, html){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(html!=null) e.innerHTML=html;
    return e;
  }

  function buildSheet(state){
    // state: { region, category, q, thisMonth, data }
    const {region, category, q, data} = state;
    const sheet=el('section','pdf-sheet');

    // soft background wash
    const wash=el('div','wash wash-other'); // neutral wash
    sheet.appendChild(wash);

    // HEADER
    const head=el('div','pdf-head');
    const title=el('h1','pdf-title',`Seasonal Planting — ${region[0].toUpperCase()+region.slice(1)}`);
    const meta=el('div','pdf-meta',`All categories • Generated ${new Date().toLocaleDateString('en-GB')}`);
    head.append(title, meta);
    sheet.appendChild(head);

    // Legend
    const legend=el('div','legend');
    legend.innerHTML = `<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>`;
    sheet.appendChild(legend);

    // BASICS + PEST WATCH (compact)
    const basicsBox=el('div','pp-box');
    const basicsTitle=el('h3',null,'Basics');
    const basicsText=el('p','pdf-meta', (data?.basics?.tips && data.basics.tips.join(' • ')) || 'Good hygiene, drainage, right pot size, and consistent watering.');
    basicsBox.append(basicsTitle, basicsText);

    const month = (new Date()).getMonth();
    const pwEntry = (data?.pestwatch && data.pestwatch[String(month)]) || { items: ['Keep an eye on slugs after rain.'] };
    const pwTitle = el('h3',null,`Pest Watch – ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month]}`);
    const pwList = el('ul',null, pwEntry.items.map(i=>`<li>${i}</li>`).join(''));
    const pwBox = el('div','pp-box');
    pwBox.append(pwTitle, pwList);

    const headerStack=el('div','pp-stack'); headerStack.append(basicsBox,pwBox);
    sheet.appendChild(headerStack);

    // GRID
    const grid=el('div','pdf-grid');
    const headRow=el('div','pdf-row');
    headRow.append(el('div','pdf-headcell','Crop'));
    for(let i=0;i<12;i++) headRow.append(el('div','pdf-headcell',monthName(i)));
    grid.append(headRow);

    // filter crops per current UI state
    const crops=(data?.crops||[]).filter(c=>{
      if(!c||!c.name) return false;
      if(category && category!=='all'){
        const inferred = inferCategory(c.name);
        if(inferred!==category) return false;
      }
      if(q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });

    crops.forEach(c=>{
      const row=el('div','pdf-row');
      const tag = `(${inferCategory(c.name)})`;
      const cropCell=el('div','pdf-cell pdf-crop',`<div><strong>${c.name}</strong></div><div class="pdf-tag">${tag}</div>`);
      row.append(cropCell);
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

    // FOOTER (brand)
    const foot=el('div','pdf-foot',`
      <span class="brand">© 2025 Patch &amp; Pot</span>
      <span class="sep">|</span>
      <span>Created by Grant Cameron Anthony</span>
    `);
    sheet.appendChild(foot);
    return sheet;
  }

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

  async function toPDF(sheet, filename){
    const { jsPDF } = window.jspdf;
    const a4 = { w: 210, h: 297 }; // mm
    // render the sheet at good DPR
    const canvas = await html2canvas(sheet, { backgroundColor:'#ffffff', scale:2 });
    const img = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });

    // fit image to A4 width
    const imgW=a4.w-20, imgH=imgW*canvas.height/canvas.width;
    let y=10;
    if(imgH<=a4.h-20){
      pdf.addImage(img,'JPEG',10,y,imgW,imgH,'','FAST');
    }else{
      // split vertically into pages
      let sY=0;
      const pagePxHeight = canvas.height*( (a4.h-20)/imgH );
      while(sY < canvas.height){
        const cut = document.createElement('canvas');
        cut.width = canvas.width;
        cut.height = Math.min(pagePxHeight, canvas.height - sY);
        const ctx = cut.getContext('2d');
        ctx.drawImage(canvas, 0, sY, canvas.width, cut.height, 0, 0, canvas.width, cut.height);
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
      if(!state || !state.data) throw new Error('No data in memory for selected region.');
      // build a single page per current view (the grid will paginate itself in toPDF if tall)
      const host=document.createElement('div');
      host.style.position='fixed'; host.style.left='-99999px'; host.style.top='0';
      document.body.appendChild(host);
      const sheet=buildSheet(state);
      host.appendChild(sheet);
      const fname=`Seasonal_${state.region}_${new Date().toISOString().slice(0,10)}.pdf`;
      try{
        await toPDF(sheet, fname);
      } finally {
        document.body.removeChild(host);
      }
    }
  };
})();
