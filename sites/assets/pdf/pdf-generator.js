/* Patch & Pot – PDF Generator (uses jsPDF + html2canvas)
   - Builds a clean A4 grid based on the CURRENT filters in seasonal.html
   - Orientation: portrait/landscape
   - Optional: include Basics + Pest Watch blocks above grid
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
