/* Patch & Pot – PDF Generator (uses jsPDF + html2canvas)
   - Builds a clean A4 grid based on the CURRENT filters in seasonal.html
   - Orientation: portrait/landscape
   - Optional: include Basics + Pest Watch blocks above grid/* Patch & Pot – PDF Generator (final)
 * - Works even if window.DATA isn't ready (loads region JSON directly)
 * - Proper pagination: repeats head each page, avoids clipped rows
 * - Orientation toggle; optional Basics + Pest Watch
 * - Footer (logo above text) once on the last page
 */

(function (global) {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // -------- small utils --------
  const uc = s => s ? s[0].toUpperCase() + s.slice(1) : '';
  const nowStr = () => new Date().toLocaleDateString();

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

  // -------- data: use window.DATA if present, else fetch JSON --------
  async function fetchJSON(url){
    const r = await fetch(url + `?v=${Date.now()}`, { cache: "no-store" });
    if(!r.ok) throw new Error(`Fetch failed: ${url}`);
    return r.json();
  }
  async function loadRegionDirect(region){
    // basics + pestwatch (objects)
    const basics = await fetchJSON(`data/regions/${region}/basics.json`).catch(()=>({}));
    const pestwatch = await fetchJSON(`data/regions/${region}/pestwatch.json`).catch(()=>({}));
    // crop blocks (arrays), flatten
    const blocks = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
    const parts = await Promise.all(blocks.map(b=>fetchJSON(`data/regions/${region}/${b}.json`).catch(()=>[])));
    const crops = parts.flat().filter(c => c && c.name);
    return { basics, pestwatch, crops };
  }
  async function getRegionBundle(region){
    const ready = global.DATA && global.DATA[region] && Array.isArray(global.DATA[region].crops);
    if(ready){
      return {
        basics: global.DATA[region].basics || {},
        pestwatch: global.DATA[region].pestwatch || {},
        crops: (global.DATA[region].crops || []).slice()
      };
    }
    return loadRegionDirect(region);
  }

  // -------- DOM builders (scoped to .pdf-sheet) --------
  function makeEl(tag, cls, html){
    const el = document.createElement(tag);
    if(cls) el.className = cls;
    if(html!=null) el.innerHTML = html;
    return el;
  }

  function buildHeaderSection(root, regionLabel, category){
    // soft wash (tied to category or other)
    const wash = makeEl('div','wash ' + (category==='all' ? 'wash-other' : `wash-${category}`));
    root.appendChild(wash);

    const head = makeEl('div','pdf-head');
    head.append(
      makeEl('h1','pdf-title', `Seasonal Planting Calendar — ${regionLabel}`),
      makeEl('div','pdf-sub', `${category==='all'?'All categories':uc(category)} • Generated ${nowStr()}`)
    );
    root.appendChild(head);

    const legend = makeEl('div','legend', `<span>🌱 <em>Sow</em></span><span>🪴 <em>Plant</em></span><span>🥕 <em>Harvest</em></span>`);
    root.appendChild(legend);
  }

  function buildMetaSection(root, basics, pestwatch){
    const wrap = makeEl('div','meta-wrap');
    let added = false;

    if(basics && basics.overview){
      const block = makeEl('div','meta-block');
      block.innerHTML = `<h4>Basics</h4><div class="pdf-meta">${basics.overview}</div>`;
      wrap.appendChild(block); added = true;
    }
    if(pestwatch){
      const m = String(new Date().getMonth());
      const entry = pestwatch[m];
      if(entry){
        const items = (entry.items||[]).map(x=>`<li>${x}</li>`).join('');
        const block = makeEl('div','meta-block', `<h4>${entry.title||'Pest Watch'}</h4><ul class="meta-list">${items}</ul>`);
        wrap.appendChild(block); added = true;
      }
    }
    if(added) root.appendChild(wrap);
  }

  function buildGridHead(){
    const frag = document.createDocumentFragment();
    const row = makeEl('div','pdf-row pdf-row-break');
    row.appendChild(makeEl('div','pdf-headcell','Crop'));
    MONTHS.forEach(m=> row.appendChild(makeEl('div','pdf-headcell', m)));
    frag.appendChild(row);
    return frag;
  }

  function buildGridRows(crops){
    const frag = document.createDocumentFragment();
    crops.forEach(c=>{
      const r = makeEl('div','pdf-row pdf-row-break');
      const tag = (c.category || inferCategory(c.name) || '').toLowerCase();
      const cropCell = makeEl('div','pdf-cell pdf-crop', `<span class="pdf-name">${c.name}</span><span class="pdf-tag">(${tag})</span>`);
      r.appendChild(cropCell);
      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        r.appendChild(makeEl('div','pdf-cell', [s?'🌱':'',p?'🪴':'',h?'🥕':''].join(' ').trim()));
      }
      frag.appendChild(r);
    });
    return frag;
  }

  // Build a single “page DOM” with header + (optional) meta + grid head + some rows
  function makePageShell(regionLabel, category, includeMeta, basics, pestwatch){
    const page = makeEl('div','pdf-sheet');
    buildHeaderSection(page, regionLabel, category);
    if(includeMeta) buildMetaSection(page, basics, pestwatch);
    const grid = makeEl('div','pdf-grid');
    grid.appendChild(buildGridHead());
    page.appendChild(grid);
    return { page, grid };
  }

  // Footer (logo above text) – add to the last page DOM before rendering
  function appendBrandFooter(page){
    const foot = makeEl('div','pdf-footer');
    const brand = makeEl('div','brand');
    const img = new Image(); img.src = 'img/patchandpot-icon.png'; img.alt = 'Patch & Pot icon';
    brand.appendChild(img);
    foot.appendChild(brand);
    foot.appendChild(makeEl('div','', '© 2025 Patch & Pot | Created by Grant Cameron Anthony'));
    page.appendChild(foot);
  }

  // Render DOM to a PDF page (html2canvas -> image -> jsPDF page)
  async function addDomAsPdfPage(pdf, dom, orientation){
    const isLandscape = orientation === 'landscape';
    const { jsPDF } = window.jspdf;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const canvas = await html2canvas(dom, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: true, logging: false
    });
    const imgData = canvas.toDataURL('image/png', 0.92);

    // Fit to printable area with small margins
    const margin = 20;
    const maxW = pageW - margin*2;
    const maxH = pageH - margin*2;

    // scale to fit
    let w = canvas.width, h = canvas.height;
    const r = Math.min(maxW / w, maxH / h);
    w *= r; h *= r;

    pdf.addImage(imgData, 'PNG', margin, margin, w, h, undefined, 'FAST');
  }

  // -------- main generate --------
  async function generate(opts){
    const {
      region='scotland',
      category='all',
      thisMonthOnly=false,
      orientation='portrait',
      includeMeta=true
    } = (opts || {});

    // 1) get region data (from DATA or direct JSON)
    const regionLabel = uc(region);
    const bundle = await getRegionBundle(region);

    // 2) filter crops as per UI
    const CUR_M = new Date().getMonth();
    let crops = (bundle.crops||[]).slice();
    if(category !== 'all') {
      crops = crops.filter(c => (c.category || inferCategory(c.name)) === category);
    }
    if(thisMonthOnly){
      crops = crops.filter(c=>{
        const s=(c.months?.sow||[]).includes(CUR_M);
        const p=(c.months?.plant||[]).includes(CUR_M);
        const h=(c.months?.harvest||[]).includes(CUR_M);
        return s||p||h;
      });
    }

    // 3) paginate: fill a page with rows up to height limit, render, repeat
    const tempHost = makeEl('div',''); // offscreen mounting
    tempHost.style.position='fixed'; tempHost.style.left='-99999px'; tempHost.style.top='0';
    document.body.appendChild(tempHost);

    const pages = [];
    let cursor = 0;

    // A4 @72dpi content height budget (approx) minus header/meta: we measure live.
    // We will keep packing rows while grid height < budget, then cut.
    while(cursor < crops.length || (cursor===0 && crops.length===0)){
      const { page, grid } = makePageShell(regionLabel, category, includeMeta && cursor===0, bundle.basics, bundle.pestwatch);
      tempHost.appendChild(page);

      // budget in px inside .pdf-sheet (roughly 1030px)
      const budget = 1030;

      // always include at least one row (or none if no crops)
      let added = 0;
      while(cursor < crops.length){
        const rFrag = buildGridRows([crops[cursor]]);
        grid.appendChild(rFrag);
        added++;
        // measure
        const h = page.getBoundingClientRect().height;
        if(h > budget){
          // remove last row and stop for this page
          grid.lastElementChild && grid.removeChild(grid.lastElementChild);
          added--;
          break;
        }
        cursor++;
      }

      // if no crops at all, still allow single “empty grid head” page
      pages.push(page);
      if(cursor >= crops.length) break;
    }

    // 4) footer on the LAST page only
    appendBrandFooter(pages[pages.length - 1]);

    // 5) render each page into jsPDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit:'pt', format:'a4', orientation: (orientation === 'landscape' ? 'landscape' : 'portrait') });

    for(let i=0;i<pages.length;i++){
      if(i>0) pdf.addPage();
      await addDomAsPdfPage(pdf, pages[i], orientation);
    }

    // cleanup DOM
    tempHost.remove();

    // 6) save
    const fname = `Patch-and-Pot_${regionLabel}_${category}_${orientation}.pdf`;
    pdf.save(fname);
  }

  global.PP_PDF = { generate };
})(window);
   - Multi-page: slices rows to fit multiple pages cleanly (no clipped words)
   - Scoped CSS in assets/pdf/pdf.css ensures no site styling is affected
*/

(function(global){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // Measure and slice rows to avoid overflow
  function sliceRowsToPages(container, maxHeightPx){
    const pages = [];
    let current = document.createElement('div');
    current.className = 'page-chunk';
    current.style.display = 'block';
    container.childNodes.forEach(node=>{
      const clone = node.cloneNode(true);
      current.appendChild(clone);
      container.parentNode.appendChild(current); // temp attach to measure
      const h = current.getBoundingClientRect().height;
      if (h > maxHeightPx && current.childNodes.length > 1){
        // pop last, start new page
        current.removeChild(clone);
        pages.push(current);
        current = document.createElement('div');
        current.className = 'page-chunk';
        current.appendChild(clone);
      }
      current.remove();
    });
    pages.push(current);
    return pages;
  }

  // Build grid DOM for selected crops
  function buildGridDoc({regionLabel, crops, category, includeMeta, basics, pestwatch, orientation}){
    const root = document.createElement('div');
    root.className = 'pdf-sheet';

    // Soft wash based on category (or generic if all)
    const wash = document.createElement('div');
    wash.className = 'wash ' + (category === 'all' ? 'wash-other' : 'wash-' + category);
    root.appendChild(wash);

    // Header
    const head = document.createElement('div'); head.className = 'pdf-head';
    const h1 = document.createElement('h1'); h1.className='pdf-title';
    h1.textContent = `Seasonal Planting Calendar — ${regionLabel}`;
    const sub = document.createElement('div'); sub.className='pdf-sub';
    sub.textContent = (category==='all'?'All categories':category[0].toUpperCase()+category.slice(1)) + ` • Generated ${new Date().toLocaleDateString()}`;
    head.appendChild(h1); head.appendChild(sub);
    root.appendChild(head);

    // Legend
    const legend = document.createElement('div'); legend.className='legend';
    legend.innerHTML = `<span>🌱 <em>Sow</em></span><span>🪴 <em>Plant</em></span><span>🥕 <em>Harvest</em></span>`;
    root.appendChild(legend);

    // Optional meta (Basics + Pestwatch)
    if(includeMeta){
      const metaWrap = document.createElement('div'); metaWrap.className='meta-wrap';
      if (basics && basics.overview){
        const mb = document.createElement('div'); mb.className='meta-block';
        mb.innerHTML = `<h4>Basics</h4><div class="pdf-meta">${basics.overview}</div>`;
        metaWrap.appendChild(mb);
      }
      if (pestwatch){
        const month = new Date().getMonth();
        const entry = pestwatch[String(month)];
        if(entry){
          const mb = document.createElement('div'); mb.className='meta-block';
          const list = (entry.items||[]).map(x=>`<li>${x}</li>`).join('');
          mb.innerHTML = `<h4>${entry.title || 'Pest Watch'}</h4><ul class="meta-list">${list}</ul>`;
          metaWrap.appendChild(mb);
        }
      }
      if(metaWrap.childNodes.length) root.appendChild(metaWrap);
    }

    // Grid
    const grid = document.createElement('div'); grid.className='pdf-grid';
    // head row
    const headRow = document.createElement('div'); headRow.className='pdf-row pdf-row-break';
    const cropHead = document.createElement('div'); cropHead.className='pdf-headcell'; cropHead.textContent = 'Crop';
    headRow.appendChild(cropHead);
    MONTHS.forEach(m=>{ const hc=document.createElement('div'); hc.className='pdf-headcell'; hc.textContent=m; headRow.appendChild(hc); });
    grid.appendChild(headRow);

    // rows
    crops.forEach(c=>{
      const row = document.createElement('div'); row.className='pdf-row pdf-row-break';
      const cropCell = document.createElement('div'); cropCell.className='pdf-cell pdf-crop';
      cropCell.innerHTML = `<span class="pdf-name">${c.name}</span><span class="pdf-tag">(${(c.category||'').toLowerCase()})</span>`;
      row.appendChild(cropCell);
      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks = [s?'🌱':'',p?'🪴':'',h?'🥕':''].join(' ').trim();
        const cell = document.createElement('div'); cell.className='pdf-cell';
        cell.textContent = marks;
        row.appendChild(cell);
      }
      grid.appendChild(row);
    });

    root.appendChild(grid);

    // Footer (brand, centered, logo above text)
    const foot = document.createElement('div'); foot.className='pdf-footer';
    const brand = document.createElement('div'); brand.className='brand';
    const logo = document.createElement('img'); logo.src = 'img/patchandpot-icon.png'; logo.alt='Patch & Pot icon';
    brand.appendChild(logo);
    foot.appendChild(brand);
    const ft = document.createElement('div');
    ft.textContent = '© 2025 Patch & Pot | Created by Grant Cameron Anthony';
    foot.appendChild(ft);
    root.appendChild(foot);

    // Orientation handling: for landscape, just scale to fit width difference later with jsPDF
    root.dataset.orientation = orientation;

    document.body.appendChild(root);
    return root;
  }

  // Get filtered crops from DATA
  function gatherFromDATA(regionKey, category, thisMonthOnly){
    const bundle = (global.DATA && global.DATA[regionKey]) ? global.DATA[regionKey] : null;
    if(!bundle) return { crops:[], basics:{}, pestwatch:{} };
    const CUR_M = new Date().getMonth();
    const inferCategory = (name)=>{
      const n=(name||"").toLowerCase();
      if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
      if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
      if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
      if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
      if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
      if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
      return"other";
    };
    let crops = (bundle.crops||[]).filter(c=>c && c.name);
    if(category!=='all') crops = crops.filter(c=> (c.category||inferCategory(c.name))===category);
    if(thisMonthOnly){
      crops = crops.filter(c=>{
        const s=(c.months?.sow||[]).includes(CUR_M);
        const p=(c.months?.plant||[]).includes(CUR_M);
        const h=(c.months?.harvest||[]).includes(CUR_M);
        return s||p||h;
      });
    }
    return { crops, basics: bundle.basics || {}, pestwatch: bundle.pestwatch || {} };
  }

  async function htmlToPdf(docEl, {orientation}){
    const { jsPDF } = window.jspdf;
    const isLandscape = orientation === 'landscape';
    const pdf = new jsPDF({ unit:'pt', format:'a4', orientation: isLandscape ? 'landscape' : 'portrait' });

    // We will slice into pages if needed
    const pageW = isLandscape ? pdf.internal.pageSize.getHeight() : pdf.internal.pageSize.getWidth();
    const pageH = isLandscape ? pdf.internal.pageSize.getWidth()  : pdf.internal.pageSize.getHeight();

    // Render whole sheet to canvas
    const canvas = await html2canvas(docEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false
    });

    const imgData = canvas.toDataURL('image/png', 0.92);
    const imgW = pageW - 40;   // 20pt margins
    const imgH = canvas.height * imgW / canvas.width;

    let y = 20;
    let remaining = imgH;
    let sY = 0;
    const sliceH = pageH - 40; // 20pt top/bottom

    while(remaining > 0){
      pdf.addImage(imgData, 'PNG', 20, y, imgW, imgH, undefined, 'FAST', 0, sY);
      remaining -= sliceH;
      sY += sliceH * (canvas.height / imgH); // move source y within the original image
      if(remaining > 0) pdf.addPage();
    }

    return pdf;
  }

  async function generate(opts){
    const {
      region='scotland',
      category='all',
      thisMonthOnly=false,
      orientation='portrait',
      includeMeta=true
    } = (opts||{});

    // Pull current data set from global DATA loaded by seasonal.html
    const regionLabel = region[0].toUpperCase()+region.slice(1);
    const { crops, basics, pestwatch } = gatherFromDATA(region, category, thisMonthOnly);

    // Build document DOM
    const sheet = buildGridDoc({regionLabel, crops, category, includeMeta, basics, pestwatch, orientation});

    // Convert to PDF
    try{
      const pdf = await htmlToPdf(sheet, {orientation});
      pdf.save(`Patch-and-Pot_${regionLabel}_${category}_${orientation}.pdf`);
    } catch(e){
      console.error(e);
      alert('PDF failed to generate. Check console for details.');
    } finally {
      // Clean up DOM
      sheet.remove();
    }
  }

  global.PP_PDF = { generate };
})(window);
