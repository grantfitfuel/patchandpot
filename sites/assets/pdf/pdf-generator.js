/* Patch & Pot PDF generator – multi-page, portrait/landscape, basics+pestwatch optional,
   brand footer fixed, grid free of emoji in cells (icons only, no text labels) */

window.PP_PDF = (function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ---- helpers ------------------------------------------------------------
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
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

  // join meta blocks (basics + pestwatch as paragraphs)
  function metaToHTML(regionKey, basics, pestwatch){
    const m = new Date().getMonth();
    const month = MONTHS[m];
    const lines = [];
    if(basics && basics.soil) lines.push(`<p class="pdf-meta"><strong>Soil:</strong> ${basics.soil}</p>`);
    if(basics && basics.watering) lines.push(`<p class="pdf-meta"><strong>Watering:</strong> ${basics.watering}</p>`);
    if(basics && basics.light) lines.push(`<p class="pdf-meta"><strong>Light:</strong> ${basics.light}</p>`);
    if(basics && basics.tools) lines.push(`<p class="pdf-meta"><strong>Tools:</strong> ${basics.tools}</p>`);
    const pw = pestwatch && pestwatch[String(m)];
    if(pw && pw.items && pw.items.length){
      lines.push(`<p class="pdf-meta"><strong>Pest Watch (${month}, ${humanRegion(regionKey)}):</strong> ${pw.items.join(' • ')}</p>`);
    }
    return lines.join('');
  }

  // per-category wash class
  function washClass(cat){
    return ({
      leafy:'wash-leafy', roots:'wash-roots', legumes:'wash-legumes', fruit:'wash-fruit',
      alliums:'wash-alliums', herbs:'wash-herbs', softfruit:'wash-softfruit', other:'wash-other'
    })[cat] || 'wash-other';
  }

  // build one A4 sheet (returns DOM element)
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

    // Optional meta page preface (Basics + Pest Watch) — only when requested
    if (basics || pestwatch){
      const meta = document.createElement('div');
      meta.innerHTML = metaToHTML(regionKey, basics, pestwatch);
      if (meta.textContent.trim()){
        const metaTitle = document.createElement('div');
        metaTitle.className = 'pdf-section-title';
        metaTitle.textContent = 'Notes';
        sheet.appendChild(metaTitle);
        sheet.appendChild(meta);
      }
    }

    // grid wrapper
    const grid = document.createElement('div');
    grid.className = 'pdf-grid';
    // header row
    const heads = ['Crop', ...MONTHS];
    heads.forEach((h,i)=>{
      const c = document.createElement('div');
      c.className = 'pdf-headcell';
      c.textContent = h;
      grid.appendChild(c);
    });

    // rows
    crops.forEach(crop=>{
      // left crop cell
      const nameCell = document.createElement('div');
      nameCell.className = 'pdf-crop pdf-cell';
      nameCell.innerHTML = `<div>${crop.name}</div><div class="pdf-tag">(${crop.category || inferCategory(crop.name)})</div>`;
      grid.appendChild(nameCell);

      // 12 months cells with ONLY icons (no extra text)
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

    // soft wash
    const wash = document.createElement('div');
    wash.className = `wash ${washClass(category)}`;
    sheet.style.position = 'relative';
    sheet.appendChild(wash);

    // brand footer (fixed)
    const brand = document.createElement('div');
    brand.className = 'pdf-brand-footer';
    brand.innerHTML = `<img src="img/patchandpot-icon.png" alt="Patch &amp; Pot logo"><div>© Patch &amp; Pot • patchandpot.com</div>`;
    sheet.appendChild(brand);

    // attach grid
    sheet.appendChild(grid);
    return sheet;
  }

  // split long lists into multiple sheets (approx: N rows per page depending on orientation)
  function paginate(crops, perPage){
    const pages = [];
    for (let i=0; i<crops.length; i+=perPage){
      pages.push(crops.slice(i, i+perPage));
    }
    return pages;
  }

  // ---- main init ----------------------------------------------------------
  async function init(){
    // seed UI from querystring (if landing from seasonal)
    const q = new URLSearchParams(location.search);
    if(q.get('region')) qs('#pdf-region').value = q.get('region');
    if(q.get('category')) qs('#pdf-category').value = q.get('category');

    qs('#btn-generate').addEventListener('click', async ()=>{
      const region = qs('#pdf-region').value;
      const category = qs('#pdf-category').value; // 'all' or specific
      const orient = qs('#pdf-orient').value;     // portrait/landscape
      const wantBasics = qs('#pdf-include-basics').checked;
      const wantPest   = qs('#pdf-include-pest').checked;

      // Load data blocks
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

      if (category !== 'all'){
        crops = crops.filter(c => byCategory(category, c));
      }

      // page size heuristic (more rows in portrait than landscape due to width)
      const perPage = (orient === 'portrait') ? 22 : 18;
      const pages = paginate(crops, perPage);

      const staging = qs('#pdf-staging');
      staging.innerHTML = ''; // clear previous
      const sheets = [];

      // First page includes legend & optional notes
      pages.forEach((chunk, idx)=>{
        const title = `Seasonal Planting – ${humanRegion(region)}${category==='all'?'':` • ${category}`}`;
        const sub   = `What to sow (🌱), plant out (🪴), and harvest (🥕) across the year.`;

        const includeLegend = (idx===0);
        const metaBasics    = (idx===0 && wantBasics) ? basics : null;
        const metaPest      = (idx===0 && wantPest)   ? pestwatch : null;

        const sheet = buildSheet({
          title, subtitle: sub, crops: chunk, category, regionKey: region,
          includeLegend, orientation: orient, basics: metaBasics, pestwatch: metaPest
        });
        staging.appendChild(sheet);
        sheets.push(sheet);
      });

      // render to PDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: orient, unit:'pt', format:'a4', compress:true });

      for (let i=0;i<sheets.length;i++){
        const node = sheets[i];
        // html2canvas at 2x for sharper text
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
