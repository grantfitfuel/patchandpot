/* Patch & Pot – PDF generator (A4) */
window.PP_PDF = (function(){
  const { jsPDF } = window.jspdf || {};
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const $ = (s,r=document)=>r.querySelector(s);
  const $el = (t,a={})=>Object.assign(document.createElement(t),a);

  function ensureModal(){
    let m=document.getElementById('pp-pdf-modal');
    if(m) return m;
    m=$el('div',{id:'pp-pdf-modal'});
    m.innerHTML=`
      <style>
        #pp-pdf-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
        #pp-pdf-modal .box{background:#0e1311;color:#e6f0ea;border:1px solid #2b332f;border-radius:14px;width:min(520px,92vw);padding:16px}
        #pp-pdf-modal h3{margin:.1rem 0 .6rem;font-size:1.2rem}
        #pp-pdf-modal .row{display:flex;gap:10px;align-items:center;margin:.6rem 0}
        #pp-pdf-modal label{display:inline-flex;gap:.4rem;align-items:center;background:#151d19;border:1px solid #2b332f;border-radius:10px;padding:.5rem .7rem}
        #pp-pdf-modal .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:.8rem}
        #pp-pdf-modal button{border:none;border-radius:999px;padding:.6rem .95rem;font-weight:800;cursor:pointer}
        #pp-pdf-modal .go{background:#35c26a;color:#061007}
        #pp-pdf-modal .cancel{background:#2b332f;color:#e6f0ea}
      </style>
      <div class="box" role="dialog" aria-modal="true" aria-labelledby="pp-pdf-title">
        <h3 id="pp-pdf-title">Create PDF</h3>
        <div class="row">
          <strong style="min-width:120px">Orientation:</strong>
          <label><input type="radio" name="pp-orient" value="p" checked> Portrait</label>
          <label><input type="radio" name="pp-orient" value="l"> Landscape</label>
        </div>
        <div class="actions">
          <button class="cancel" type="button">Cancel</button>
          <button class="go" type="button">Generate</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('.cancel').addEventListener('click',()=>m.remove());
    return m;
  }
  const askOrientation=()=>new Promise(res=>{
    const modal=ensureModal();
    modal.querySelector('.go').onclick=()=>{
      const v=modal.querySelector('input[name="pp-orient"]:checked').value||'p';
      modal.remove(); res(v);
    };
  });

  function currentFilters(){
    const region = ($('#pp-region')?.value || 'scotland').toLowerCase();
    const cat = ($('#pp-category')?.value || 'all').toLowerCase();
    const thisMonth = !!$('#pp-this-month')?.checked;
    const m = new Date().getMonth();
    return { region, cat, thisMonth, monthIndex:m, monthName:MONTHS[m] };
  }

  async function loadRegion(region){
    if(window.DATA && window.DATA[region] && window.DATA[region].crops) return window.DATA[region];
    const j = async u => { const r=await fetch(u+`?v=${Date.now()}`,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); };
    const base=`data/regions/${region}/`;
    const [basics,pestwatch]=await Promise.all([j(base+'basics.json').catch(()=>({})), j(base+'pestwatch.json').catch(()=>({}))]);
    const crops=(await Promise.all(['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'].map(b=>j(base+`${b}.json`).catch(()=>[])))).flat().filter(x=>x&&x.name);
    return { region:region[0].toUpperCase()+region.slice(1), basics, pestwatch, crops };
  }
  function inferCategory(name){
    const n=(name||'').toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return'leafy';
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return'roots';
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return'legumes';
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return'fruit';
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return'alliums';
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n))return'herbs';
    return'other';
  }
  function filterCrops(all, cat, m, thisMonth){
    let list=Array.isArray(all)?all.slice():[];
    if(cat!=='all') list=list.filter(c=>(c.category||inferCategory(c.name))===cat);
    if(thisMonth) list=list.filter(c=>{
      const s=(c.months?.sow||[]).includes(m);
      const p=(c.months?.plant||[]).includes(m);
      const h=(c.months?.harvest||[]).includes(m);
      return s||p||h;
    });
    return list;
  }

  function buildSheet({regionName,cat,monthIndex,monthName,basics,pestwatch,crops,pageIndex,totalPages}){
    const sheet=$el('div'); sheet.className='pdf-sheet';

    // header
    const head=$el('div'); head.className='pdf-head';
    const title=$el('h1'); title.className='pdf-title';
    title.textContent=`Seasonal Planting — ${regionName}`;
    const filler=$el('div'); head.appendChild(title); head.appendChild(filler);
    sheet.appendChild(head);
    const sub=$el('div'); sub.className='pdf-sub';
    sub.textContent=`${cat==='all'?'All categories':cat[0].toUpperCase()+cat.slice(1)} • ${monthName} • Page ${pageIndex+1}/${totalPages}`;
    sheet.appendChild(sub);

    const legend=$el('div'); legend.className='legend';
    legend.innerHTML=`<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>`;
    sheet.appendChild(legend);

    // basics + pestwatch
    const meta=$el('div'); meta.className='pdf-meta';
    meta.innerHTML = `
      <h4>Basics</h4>
      <p>${(basics?.summary||basics?.intro||'Good hygiene, drainage, right pot size, and consistent watering.')}</p>
      <h4>Pest Watch – ${monthName}</h4>
      <ul>${(((pestwatch && pestwatch[String(monthIndex)] && pestwatch[String(monthIndex)].items) || ['Keep an eye on slugs after rain.']).map(i=>`<li>${i}</li>`).join(''))}</ul>`;
    sheet.appendChild(meta);

    // grid
    const grid=$el('div'); grid.className='pdf-grid';
    const wash=$el('div'); wash.className=`wash wash-${cat==='all'?'other':cat}`; grid.appendChild(wash);
    const headRow=$el('div'); headRow.className='pdf-row';
    const hc0=$el('div'); hc0.className='pdf-headcell'; hc0.textContent='Crop'; headRow.appendChild(hc0);
    MONTHS.forEach(m=>{ const hc=$el('div'); hc.className='pdf-headcell'; hc.textContent=m; headRow.appendChild(hc); });
    grid.appendChild(headRow);

    crops.forEach(c=>{
      const row=$el('div'); row.className='pdf-row';
      const crop=$el('div'); crop.className='pdf-crop';
      crop.innerHTML=`<div>${c.name}</div><div class="pdf-tag">(${c.category||inferCategory(c.name)})</div>`;
      row.appendChild(crop);
      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const cell=$el('div'); cell.className='pdf-cell';
        cell.textContent=`${s?'🌱':''}${p?'🪴':''}${h?'🥕':''}`;
        row.appendChild(cell);
      }
      grid.appendChild(row);
    });
    sheet.appendChild(grid);

    // footer
    const foot=$el('div'); foot.className='pdf-footer';
    const pot=$el('img'); pot.className='pot'; pot.src='img/patchandpot-icon.png'; pot.alt='Patch & Pot icon';
    const ftxt=$el('div'); ftxt.textContent='© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    foot.appendChild(pot); foot.appendChild(ftxt);
    sheet.appendChild(foot);

    document.body.appendChild(sheet);
    return sheet;
  }

  function paginate(crops, orient){ const per=(orient==='l')?16:22; const pages=[]; for(let i=0;i<crops.length;i+=per) pages.push(crops.slice(i,i+per)); return pages; }

  async function renderPDF(orient,{regionName,cat,monthIndex,monthName,basics,pestwatch,crops}){
    const pages=paginate(crops,orient);
    const doc=new jsPDF({orientation:orient==='l'?'landscape':'portrait',unit:'pt',format:'a4'});

    for(let i=0;i<pages.length;i++){
      const sheet=buildSheet({regionName,cat,monthIndex,monthName,basics,pestwatch,crops:pages[i],pageIndex:i,totalPages:pages.length});
      const canvas=await html2canvas(sheet,{backgroundColor:'#ffffff',scale:2,useCORS:true,allowTaint:true});
      const imgData=canvas.toDataURL('image/jpeg',0.94);

      const pageW=doc.internal.pageSize.getWidth();
      const pageH=doc.internal.pageSize.getHeight();
      const imgW=canvas.width, imgH=canvas.height;

      const margin=6; // small safety margin to prevent right-edge clipping
      const ratio=Math.min((pageW-2*margin)/imgW,(pageH-2*margin)/imgH);
      const w=imgW*ratio, h=imgH*ratio;
      const x=(pageW-w)/2, y=(pageH-h)/2;

      if(i>0) doc.addPage();
      doc.addImage(imgData,'JPEG',x,y,w,h,undefined,'FAST');
      sheet.remove();
    }
    const stamp=new Date().toISOString().slice(0,10);
    const niceCat=(cat==='all'?'All':cat[0].toUpperCase()+cat.slice(1));
    doc.save(`Patch&Pot-${regionName}-${niceCat}-${stamp}.pdf`);
  }

  function init(){
    const btn=document.getElementById('pp-pdf-btn');
    if(!btn || !jsPDF || !window.html2canvas) return;
    btn.addEventListener('click', async ()=>{
      try{
        const {region,cat,thisMonth,monthIndex,monthName}=currentFilters();
        const data=await loadRegion(region);
        const crops=filterCrops(data.crops,cat,monthIndex,thisMonth);
        const orient=await askOrientation();
        await renderPDF(orient,{regionName:data.region,cat,monthIndex,monthName,basics:data.basics,pestwatch:data.pestwatch,crops});
      }catch(e){ console.error(e); alert('Sorry — PDF generation failed.'); }
    });
  }

  return { init };
})();
