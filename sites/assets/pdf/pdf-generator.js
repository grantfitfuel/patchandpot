/* Patch & Pot — PDF Generator (A4, portrait/landscape). Builds clean pages with green header,
   optional Basics & Pest Watch, emoji grid, branded footer. */
(function(){
  const PP_MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const POT_ICON='img/patchandpot-icon.png';

  // ---------- small DOM helpers ----------
  function el(tag, attrs={}, html){ const n=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v)); if(html!=null) n.innerHTML=html; return n; }
  const H=(t,a,h)=>el(t,a,h);

  // ---------- data loader (reads JSON from /sites/data/regions/<region>/) ----------
  function fetchJSON(url){ return fetch(url+`?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(url)); }

  async function loadRegion(region){
    const base=`data/regions/${region}/`;
    const basicsP = fetchJSON(base+'basics.json').catch(()=>({}));
    const pestP   = fetchJSON(base+'pestwatch.json').catch(()=>({}));
    const blocks  = ['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'];
    const blockPromises = blocks.map(b=>fetchJSON(base+`${b}.json`).catch(()=>[]));
    const [basics,pestwatch,...parts] = await Promise.all([basicsP,pestP,...blockPromises]);
    const crops = parts.flat().filter(c=>c && c.name);
    return { basics, pestwatch, crops };
  }

  // ---------- filtering used for grid ----------
  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return "other";
  }
  function applyFilters(crops,{category,q}){
    const qq=(q||'').toLowerCase();
    return (crops||[]).filter(c=>{
      const cat=c.category||inferCategory(c.name);
      if(category && category!=='all' && category!==cat) return false;
      if(qq && !(c.name||'').toLowerCase().includes(qq)) return false;
      return true;
    });
  }

  // ---------- build one table chunk to fit the page ----------
  function buildTableChunk(doc, cropsSlice){
    const tbl = H('table',{class:'table avoid-break'});
    const thead = H('thead');
    const hr = H('tr');
    hr.appendChild(H('th',{class:'crop'},'Crop'));
    PP_MONTHS.forEach(m=> hr.appendChild(H('th',{class:'month'},m)));
    thead.appendChild(hr); tbl.appendChild(thead);

    const tb = H('tbody');
    cropsSlice.forEach(c=>{
      const tr = H('tr');
      const cropCell = H('td',{class:'crop'}, c.name);
      tr.appendChild(cropCell);
      // months (emoji)
      PP_MONTHS.forEach((_,i)=>{
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks=[s?"🌱":"",p?"🪴":"",h?"🥕":""].join(' ').trim();
        tr.appendChild(H('td',{class:'month'}, marks));
      });
      tb.appendChild(tr);
      // small tags row (category) for extra height + clarity
      const tagTr = H('tr');
      const cat = c.category||inferCategory(c.name);
      tagTr.appendChild(H('td',{class:'tags muted',colspan:(1+PP_MONTHS.length)}, `(${cat})`));
      tb.appendChild(tagTr);
    });
    tbl.appendChild(tb);
    doc.appendChild(tbl);
  }

  // ---------- make one PDF page (DOM) ----------
  function makePage(container,{region,filterLabel,legend=true,headerTitle,basicsBlock,pestList}){
    const page = H('section',{class:'page'});
    // header bar
    const head = H('div',{class:'header'},
      `<div>${headerTitle}</div>
       <div class="legend">${legend?
        `<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>`:''}
        <span class="muted" style="margin-left:18px">Filter: ${filterLabel}</span>
       </div>`);
    page.appendChild(head);

    if(basicsBlock){
      const panel = H('div',{class:'panel avoid-break'});
      panel.innerHTML = `<h3>Basics</h3><div class="muted">${basicsBlock}</div>`;
      page.appendChild(panel);
    }
    if(pestList && pestList.length){
      const panel = H('div',{class:'panel avoid-break'});
      panel.innerHTML = `<h3>Pest Watch — ${PP_MONTHS[new Date().getMonth()]}</h3>`+
        `<ul>${pestList.map(i=>`<li>${i}</li>`).join('')}</ul>`;
      page.appendChild(panel);
    }

    container.appendChild(page);
    return page;
  }

  // ---------- render DOM → PDF with html2canvas + jsPDF ----------
  async function domToPdfAndDownload(root, orientation, filename){
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation, unit:'px', format:'a4', compress:true});
    const pages = Array.from(root.querySelectorAll('.page'));

    for(let i=0;i<pages.length;i++){
      const p=pages[i];
      // pad to avoid clipping shadows / radii
      const canvas = await html2canvas(p,{backgroundColor:'#ffffff', scale:2, useCORS:true});
      const img = canvas.toDataURL('image/jpeg',0.92);
      const pageW = orientation==='landscape' ? 1123 : 794;
      const pageH = orientation==='landscape' ? 794 : 1123;
      if(i>0) pdf.addPage([pageW,pageH], orientation);
      pdf.addImage(img,'JPEG',0,0,pageW,pageH);
      // footer branding
      pdf.setFontSize(10);
      pdf.setTextColor(74,90,82);
      const y = pageH - 20;
      pdf.text('© 2025 Patch & Pot | Created by Grant Cameron Anthony', pageW/2, y, {align:'center'});
      // tiny pot icon centered (optional)
      try{
        const pot = await (await fetch(POT_ICON)).blob();
        const potUrl = await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(pot); });
        pdf.addImage(potUrl,'PNG', (pageW/2)-60, y-10, 12, 12);
      }catch(_){}
    }
    pdf.save(filename);
  }

  // ---------- main: build all pages then export ----------
  async function generate({region='scotland',category='all',q='',page='portrait',includeMeta=true}){
    // Load selection data fresh (so Basics/Pest are always available)
    const data = await loadRegion(region);
    const crops = applyFilters(data.crops,{category,q});

    // Build hidden render root
    const container = H('div',{class:`ppdf ${page==='landscape'?'land':''}`, style:'position:fixed;left:-99999px;top:0;z-index:-1'});
    document.body.appendChild(container);

    const title = `Seasonal Planting — ${region[0].toUpperCase()+region.slice(1)}`;
    const filterLabel = category==='all' ? 'All categories' : category;

    // Page 1: meta (optional)
    if(includeMeta){
      const p1 = makePage(container,{region,filterLabel,headerTitle:
        `<span>${title}</span><span class="muted" style="font-weight:600">• Generated ${new Date().toLocaleDateString('en-GB')}</span>`});

      // Basics text (if present)
      const basicsText = (data.basics && data.basics.text) ? data.basics.text
        : 'Good hygiene, drainage, right pot size, and consistent watering.';
      const pest = (data.pestwatch && data.pestwatch[String(new Date().getMonth())] && data.pestwatch[String(new Date().getMonth())].items) || [];

      // panels
      const basicsPanel = H('div',{class:'panel avoid-break'});
      basicsPanel.innerHTML = `<h3>Basics</h3><div class="muted">${basicsText}</div>`;
      p1.appendChild(basicsPanel);

      if(pest.length){
        const pestPanel = H('div',{class:'panel avoid-break'});
        pestPanel.innerHTML = `<h3>Pest Watch — ${PP_MONTHS[new Date().getMonth()]}</h3><ul>${pest.map(i=>`<li>${i}</li>`).join('')}</ul>`;
        p1.appendChild(pestPanel);
      }
    }

    // Grid pages (paginate)
    const rowsPerPage = page==='landscape' ? 18 : 15; // each crop uses 2 rows (name+tags)
    for(let i=0;i<crops.length;i+=rowsPerPage){
      const chunk = crops.slice(i,i+rowsPerPage);
      const pg = makePage(container,{region,filterLabel,headerTitle:
        `<span>${title}</span><span class="muted">• Legend: 🌱 Sow  🪴 Plant  🥕 Harvest</span>`});
      buildTableChunk(pg, chunk);
    }

    // Export to PDF
    const fn = `Seasonal-Planting-${region}-${new Date().toISOString().slice(0,10)}.pdf`;
    await domToPdfAndDownload(container, page==='landscape'?'landscape':'portrait', fn);

    // Clean up
    container.remove();
  }

  // expose
  window.PP_PDF = { generate };
})();
