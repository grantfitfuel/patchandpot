/* Patch & Pot PDF generator – no images in footer, grid locked above washes */
window.PP_PDF = (function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const qs = s => document.querySelector(s);
  const fetchJSON = u => fetch(u+`?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(u));
  const humanRegion = k => k ? k[0].toUpperCase()+k.slice(1) : '';

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo|cape gooseberry)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary|chives)/.test(n))return"herbs";
    return"other";
  }
  const byCategory = (want,c)=> want==='all' ? true : ((c.category||inferCategory(c.name))===want);
  const washClass = c => ({leafy:'wash-leafy',roots:'wash-roots',legumes:'wash-legumes',fruit:'wash-fruit',alliums:'wash-alliums',herbs:'wash-herbs',softfruit:'wash-softfruit',other:'wash-other'})[c]||'wash-other';

  function buildSheet({title,subtitle,crops,category,regionKey,includeLegend,orientation,notesHTML}){
    const sheet=document.createElement('section');
    sheet.className='pdf-sheet'+(orientation==='landscape'?' landscape':'');

    const head=document.createElement('div');
    head.className='pdf-head';
    head.innerHTML=`<h2 class="pdf-title">${title}</h2><div class="pdf-sub">${subtitle}</div>`;
    sheet.appendChild(head);

    if(includeLegend){
      const legend=document.createElement('div');
      legend.className='legend';
      legend.innerHTML=`<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>`;
      sheet.appendChild(legend);
    }

    if(notesHTML){
      const t=document.createElement('div'); t.className='pdf-section-title'; t.textContent='Notes';
      const n=document.createElement('div'); n.innerHTML=notesHTML;
      sheet.appendChild(t); sheet.appendChild(n);
    }

    const grid=document.createElement('div'); grid.className='pdf-grid';

    ['Crop',...MONTHS].forEach(h=>{
      const hc=document.createElement('div'); hc.className='pdf-headcell'; hc.textContent=h; grid.appendChild(hc);
    });

    crops.forEach(c=>{
      const n=document.createElement('div'); n.className='pdf-crop pdf-cell';
      n.innerHTML=`<div>${c.name}</div><div class="pdf-tag">(${c.category||inferCategory(c.name)})</div>`;
      grid.appendChild(n);
      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const cell=document.createElement('div'); cell.className='pdf-cell';
        cell.textContent=`${s?'🌱':''}${p?'🪴':''}${h?'🥕':''}`;
        grid.appendChild(cell);
      }
    });

    /* soft wash behind grid only */
    const wash=document.createElement('div'); wash.className=`wash ${washClass(category)}`; sheet.appendChild(wash);

    /* single-line brand footer (no image) */
    const brand=document.createElement('div'); brand.className='pdf-brand-footer';
    brand.textContent='© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    sheet.appendChild(brand);

    sheet.appendChild(grid);
    return sheet;
  }

  function paginate(arr, per){ const out=[]; for(let i=0;i<arr.length;i+=per) out.push(arr.slice(i,i+per)); return out; }

  async function generate(){
    const region=qs('#pdf-region').value;
    const category=qs('#pdf-category').value;
    const orient=qs('#pdf-orient').value;

    const base=`data/regions/${region}/`;
    const [basics,pest,roots,leafy,legumes,fruit,alliums,herbs,softfruit,other]=await Promise.all([
      fetchJSON(base+'basics.json').catch(()=>({})),
      fetchJSON(base+'pestwatch.json').catch(()=>({})),
      fetchJSON(base+'roots.json').catch(()=>[]),
      fetchJSON(base+'leafy.json').catch(()=>[]),
      fetchJSON(base+'legumes.json').catch(()=>[]),
      fetchJSON(base+'fruit.json').catch(()=>[]),
      fetchJSON(base+'alliums.json').catch(()=>[]),
      fetchJSON(base+'herbs.json').catch(()=>[]),
      fetchJSON(base+'softfruit.json').catch(()=>[]),
      fetchJSON(base+'other.json').catch(()=>[])
    ]);

    let crops=[...roots,...leafy,...legumes,...fruit,...alliums,...herbs,...softfruit,...other].filter(x=>x&&x.name);
    if(category!=='all') crops=crops.filter(c=>byCategory(category,c));

    const m=new Date().getMonth();
    const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
    const pw=pest && pest[String(m)];
    const notes=[
      basics?.soil && `<p class="pdf-meta"><strong>Soil:</strong> ${basics.soil}</p>`,
      basics?.watering && `<p class="pdf-meta"><strong>Watering:</strong> ${basics.watering}</p>`,
      basics?.light && `<p class="pdf-meta"><strong>Light:</strong> ${basics.light}</p>`,
      pw?.items?.length && `<p class="pdf-meta"><strong>Pest Watch (${month}, ${humanRegion(region)}):</strong> ${pw.items.join(' • ')}</p>`
    ].filter(Boolean).join('');

    const per=(orient==='portrait')?22:18;
    const pages=paginate(crops,per);

    const stage=document.getElementById('pdf-staging'); stage.innerHTML='';
    const sheets=[];
    pages.forEach((chunk,i)=>{
      const sheet=buildSheet({
        title:`Seasonal Planting — ${humanRegion(region)}`,
        subtitle:`What to sow (🌱), plant out (🪴), and harvest (🥕) across the year.`,
        crops:chunk, category, regionKey:region, includeLegend:i===0, orientation:orient,
        notesHTML: i===0 ? notes : ''
      });
      stage.appendChild(sheet); sheets.push(sheet);
    });

    const { jsPDF }=window.jspdf;
    const pdf=new jsPDF({orientation:orient,unit:'pt',format:'a4',compress:true});

    for(let i=0;i<sheets.length;i++){
      const node=sheets[i];
      const canvas=await html2canvas(node,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,
        windowWidth:node.offsetWidth,windowHeight:node.offsetHeight});
      const img=canvas.toDataURL('image/jpeg',0.92);
      const w=(orient==='portrait')?595.28:841.89;
      const h=(orient==='portrait')?841.89:595.28;
      pdf.addImage(img,'JPEG',0,0,w,h,undefined,'FAST');
      if(i<sheets.length-1) pdf.addPage();
    }
    pdf.save(`Patch-and-Pot_${region}_${category}_${orient}.pdf`);
  }

  function init(){
    const btn=qs('#btn-generate'); if(!btn) return;
    btn.addEventListener('click', e=>{ e.preventDefault(); generate().catch(err=>{console.error(err); alert('Sorry, PDF generation failed.');}); });
  }

  return { init };
})();
