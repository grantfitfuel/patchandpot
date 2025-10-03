/* Patch & Pot PDF generator – footer fix + month nowrap
   - Footer is now a single-line text (no icon), with extra bottom padding in CSS.
   - Month headers use smaller font and no-wrap (handled in CSS). */

window.PP_PDF = (function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const qs = sel => document.querySelector(sel);
  const fetchJSON = url => fetch(url + `?v=${Date.now()}`, {cache:'no-store'}).then(r => r.ok ? r.json() : Promise.reject(url));

  function humanRegion(k){ return k ? (k[0].toUpperCase() + k.slice(1)) : ''; }
  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary|chives)/.test(n))return"herbs";
    return "other";
  }
  function byCategory(want, c){ return want==='all' ? true : ( (c.category||inferCategory(c.name)) === want ); }

  function metaToHTML(regionKey, basics, pestwatch){
    const m = new Date().getMonth();
    const month = MONTHS[m];
    const lines = [];
    if(basics && basics.soil) lines.push(`<p class="pdf-meta"><strong>Soil:</strong> ${basics.soil}</p>");
    if(basics && basics.watering) lines.push(`<p class="pdf-meta"><strong>Watering:</strong> ${basics.watering}</p>`);
    if(basics && basics.light) lines.push(`<p class="pdf-meta"><strong>Light:</strong> ${basics.light}</p>`);
    if(basics && basics.tools) lines.push(`<p class="pdf-meta"><strong>Tools:</strong> ${basics.tools}</p>`);
    const pw = pestwatch && pestwatch[String(m)];
    if(pw && pw.items && pw.items.length){
      lines.push(`<p class="pdf-meta"><strong>Pest Watch (${month}, ${humanRegion(regionKey)}):</strong> ${pw.items.join(' • ')}</p>`);
    }
    return lines.join('');
  }

  function washClass(cat){
    return ({
      leafy:'wash-leafy', roots:'wash-roots', legumes:'wash-legumes', fruit:'wash-fruit',
      alliums:'wash-alliums', herbs:'wash-herbs', softfruit:'wash-softfruit', other:'wash-other'
    })[cat] || 'wash-other';
  }

  function buildSheet({title, subtitle, crops, category, regionKey, includeLegend, orientation, basics, pestwatch}){
    const sheet = document.createElement('section');
    sheet.className = 'pdf-sheet' + (orientation==='landscape' ? ' landscape' : '');

    const head = document.createElement('div');
    head.className = 'pdf-head';
    head.innerHTML = `<h2 class="pdf-title">${title}</h2><div class="pdf-sub">${subtitle}</div>`;
    sheet.appendChild(head);

    if(includeLegend){
      const legend = document.createElement('div');
      legend.className = 'legend';
      legend.innerHTML = `<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>`;
      sheet.appendChild(legend);
    }

    if (basics || pestwatch){
      const metaHTML = metaToHTML(regionKey, basics, pestwatch);
      if (metaHTML.trim()){
        const metaTitle = document.createElement('div');
        metaTitle.className = 'pdf-section-title';
        metaTitle.textContent = 'Notes';
        sheet.appendChild(metaTitle);
        const meta = document.createElement('div');
        meta.innerHTML = metaHTML;
        sheet.appendChild(meta);
      }
    }

    const grid = document.createElement('div');
    grid.className = 'pdf-grid';

    const heads = ['Crop', ...MONTHS];
    heads.forEach(h=>{
      const c = document.createElement('div');
      c.className = 'pdf-headcell';
      c.textContent = h;
      grid.appendChild(c);
    });

    crops.forEach(crop=>{
      const nameCell = document.createElement('div');
      nameCell.className = 'pdf-crop pdf-cell';
      nameCell.innerHTML = `<div>${crop.name}</div><div class="pdf-tag">(${crop.category || inferCategory(crop.name)})</div>`;
      grid.appendChild(nameCell);

      for (let i=0;i<12;i++){
        const s=(crop.months?.sow||[]).includes(i);
        const p=(crop.months?.plant||[]).includes(i);
        const h=(crop.months?.harvest||[]).includes(i);
        const cell = document.createElement('div');
        cell.className = 'pdf-cell';
        cell.textContent = `${s?'🌱':''}${p?'🪴':''}${h?'🥕':''}`;
        grid.appendChild(cell);
      }
    });

    const wash = document.createElement('div');
    wash.className = `wash ${washClass(category)}`;
    sheet.style.position = 'relative';
    sheet.appendChild(wash);

    // Single-line brand footer (no icon)
    const brand = document.createElement('div');
    brand.className = 'pdf-brand-footer';
    brand.textContent = '© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    sheet.appendChild(brand);

    sheet.appendChild(grid);
    return sheet;
  }

  function paginate(crops, perPage){
    const pages = [];
    for (let i=0; i<crops.length; i+=perPage){
      pages.push(crops.slice(i, i+perPage));
    }
    return pages;
  }

  async function init(){
    const q = new URLSearchParams(location.search);
    if(q.get('region')) qs('#pdf-region').value = q.get('region');
    if(q.get('category')) qs('#pdf-category').value = q.get('category');

    qs('#btn-generate').addEventListener('click', async ()=>{
      const region = qs('#pdf-region').value;
      const category = qs('#pdf-category').value;
      const orient = qs('#pdf-orient').value;
      const wantBasics = qs('#pdf-include-basics').checked;
      const wantPest   = qs('#pdf-include-pest').checked;

      const base = `data/regions/${region}/`;
      const [basics, pestwatch, roots, leafy, legumes, fruit, alliums, herbs, softfruit, other] = await Promise.all([
        fetchJSON(base+'basics.json').catch(()=>({})),
        fetchJSON(base+'pestwatch.json').catch(()=>({})),
        fetchJSON(base+'roots.json').catch(()=>([])),
        fetchJSON(base+'leafy.json').catch(()=>([])),
        fetchJSON(base+'legumes.json').catch(()=>([])),
        fetchJSON(base+'fruit.json').catch(()=>([])),
        fetchJSON(base+'alliums.json').catch(()=>([])),
        fetchJSON(base+'herbs.json').catch(()=>([])),
        fetchJSON(base+'softfruit.json').catch(()=>([])),
        fetchJSON(base+'other.json').catch(()=>([]))
      ]);

      let crops = []
        .concat(roots, leafy, legumes, fruit, alliums, herbs, softfruit, other)
        .filter(x=>x && x.name);

      if (category !== 'all') crops = crops.filter(c => byCategory(category, c));

      const perPage = (orient === 'portrait') ? 22 : 18;
      const pages = paginate(crops, perPage);

      const staging = document.getElementById('pdf-staging');
      staging.innerHTML = '';
      const sheets = [];

      pages.forEach((chunk, idx)=>{
        const title = `Seasonal Planting – ${humanRegion(region)}${category==='all'?'':` • ${category}`}`;
        const sub   = `What to sow (🌱), plant out (🪴), and harvest (🥕) across the year.`;
        const sheet = buildSheet({
          title, subtitle: sub, crops: chunk, category, regionKey: region,
          includeLegend: idx===0, orientation: orient,
          basics: (idx===0 && wantBasics) ? basics : null,
          pestwatch: (idx===0 && wantPest) ? pestwatch : null
        });
        staging.appendChild(sheet);
        sheets.push(sheet);
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: orient, unit:'pt', format:'a4', compress:true });

      for (let i=0;i<sheets.length;i++){
        const node = sheets[i];
        const canvas = await html2canvas(node, {
          backgroundColor:'#ffffff',
          scale:2,
          useCORS:true,
          logging:false,
          windowWidth: node.offsetWidth,
          windowHeight: node.offsetHeight
        });
        const img = canvas.toDataURL('image/jpeg', 0.92);
        const w = (orient==='portrait') ? 595.28 : 841.89;
        const h = (orient==='portrait') ? 841.89 : 595.28;
        pdf.addImage(img, 'JPEG', 0, 0, w, h, undefined, 'FAST');
        if (i < sheets.length-1) pdf.addPage();
      }

      pdf.save(`Patch-and-Pot_${region}_${category}_${orient}.pdf`);
    });
  }

  return { init };
})();
