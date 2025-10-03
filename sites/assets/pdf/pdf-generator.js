/* =========================================================
   Patch & Pot – PDF Generator (A4)
   Builds from the active Region + Category + options
   in seasonal.html. No separate pdf.html. No dark theme.
   ========================================================= */

window.PP_PDF = (function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function getActiveSelection(){
    const regionKey = window._PP_ACTIVE_REGION || (document.getElementById('pp-region')?.value || 'scotland');
    const category = window._PP_ACTIVE_CATEGORY || (document.getElementById('pp-category')?.value || 'all');
    const includeNotes = !!document.getElementById('pp-pdf-include-notes')?.checked;
    const orientation = document.getElementById('pp-pdf-orient')?.value || 'portrait';
    return { regionKey, category, includeNotes, orientation };
  }

  function filterCropsByCategory(crops, cat){
    if(!crops || !Array.isArray(crops)) return [];
    if(!cat || cat === 'all') return crops;
    return crops.filter(c => (c.category || '').toLowerCase() === cat);
  }

  function buildMetaBlocks(container, regionData, includeNotes){
    if(!includeNotes) return;
    const meta = document.createElement('div');
    meta.className = 'pdf-meta pdf-avoid-break';
    // Basics
    if(regionData.basics && Object.keys(regionData.basics).length){
      const b = regionData.basics;
      const blk = document.createElement('div');
      blk.innerHTML = `
        <h4>Basics</h4>
        <ul>
          ${b.sun     ? `<li><strong>Sun:</strong> ${b.sun}</li>` : ``}
          ${b.water   ? `<li><strong>Water:</strong> ${b.water}</li>` : ``}
          ${b.soil    ? `<li><strong>Soil/Compost:</strong> ${b.soil}</li>` : ``}
          ${b.containers ? `<li><strong>Containers:</strong> ${b.containers}</li>` : ``}
          ${b.tools   ? `<li><strong>Tools:</strong> ${b.tools}</li>` : ``}
          ${b.cover   ? `<li><strong>Covers:</strong> ${b.cover}</li>` : ``}
          ${b.notes   ? `<li><strong>Notes:</strong> ${b.notes}</li>` : ``}
        </ul>`;
      meta.appendChild(blk);
    }
    // Pest Watch (current month)
    const m = new Date().getMonth();
    if(regionData.pestwatch && regionData.pestwatch[String(m)]){
      const p = regionData.pestwatch[String(m)];
      const blk = document.createElement('div');
      const items = (p.items||[]).map(i=>`<li>${i}</li>`).join('');
      blk.innerHTML = `<h4>Pest Watch</h4><ul>${items}</ul>`;
      meta.appendChild(blk);
    }

    if (meta.children.length) container.appendChild(meta);
  }

  function buildGridPage(regionName, crops, orientation){
    // Page container
    const sheet = document.createElement('section');
    sheet.className = 'pdf-sheet';
    sheet.setAttribute('data-orient', orientation);

    // Header
    const head = document.createElement('div');
    head.className = 'pdf-head';
    head.innerHTML = `
      <h2 class="pdf-title">Seasonal Planting – ${regionName}</h2>
      <div class="legend" aria-hidden="true">
        <span>🌱 <em>Sow</em></span>
        <span>🪴 <em>Plant</em></span>
        <span>🥕 <em>Harvest</em></span>
      </div>`;
    sheet.appendChild(head);

    // Sub
    const sub = document.createElement('div');
    sub.className = 'pdf-sub';
    sub.textContent = 'Month-by-month guide for small-space growing.';
    sheet.appendChild(sub);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'pdf-grid';

    // Header row
    const rowHead = document.createElement('div');
    rowHead.className = 'pdf-row';
    grid.appendChild(rowHead);

    const cropHead = document.createElement('div');
    cropHead.className = 'pdf-headcell';
    cropHead.textContent = 'Crop';
    rowHead.appendChild(cropHead);

    MONTHS.forEach(m=>{
      const hc = document.createElement('div');
      hc.className = 'pdf-headcell';
      hc.textContent = m;
      rowHead.appendChild(hc);
    });

    // Crop rows
    crops.forEach(c=>{
      const row = document.createElement('div');
      row.className = 'pdf-row';
      // left cell
      const lc = document.createElement('div');
      lc.className = 'pdf-headcell pdf-crop';
      const nm = document.createElement('div'); nm.className = 'pdf-name'; nm.textContent = c.name;
      const tg = document.createElement('div'); tg.className = 'pdf-tag'; tg.textContent = `(${(c.category||'').toLowerCase()||'other'})`;
      lc.appendChild(nm); lc.appendChild(tg);
      row.appendChild(lc);

      // 12 month cells
      for(let i=0;i<12;i++){
        const cell = document.createElement('div');
        cell.className = 'pdf-cell';
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks=[s?'🌱':'',p?'🪴':'',h?'🥕':''].join(' ').trim();
        cell.textContent = marks;
        row.appendChild(cell);
      }
      grid.appendChild(row);
    });

    sheet.appendChild(grid);
    return sheet;
  }

  // Chunk crop list to multiple A4 pages; target rows per page depends on orientation
  function paginateCrops(allCrops, orientation){
    const perPage = (orientation === 'landscape') ? 28 : 22; // tighter in landscape
    const chunks = [];
    for(let i=0; i<allCrops.length; i+=perPage){
      chunks.push(allCrops.slice(i, i+perPage));
    }
    return chunks;
  }

  function appendFooter(sheet){
    const footer = document.createElement('div');
    footer.className = 'pdf-footer';
    footer.innerHTML = `
      <img class="brand-mark" src="img/patchandpot-icon.png" alt="Patch &amp; Pot icon">
      <p>© 2025 Patch &amp; Pot | Created by Grant Cameron Anthony</p>`;
    sheet.appendChild(footer);
  }

  async function renderSheetToPDF(pages, orientation, filename){
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation, unit:'px', format:'a4', compress:true});
    const a4 = (orientation==='landscape') ? {w:1123, h:794} : {w:794, h:1123};

    for(let i=0;i<pages.length;i++){
      const node = pages[i];
      document.body.appendChild(node);
      // Scale up for crispness
      const canvas = await html2canvas(node, {scale:2, backgroundColor:'#ffffff', useCORS:true});
      const img = canvas.toDataURL('image/jpeg', 0.92);
      const iw = canvas.width, ih = canvas.height;
      // Fit into A4 while preserving ratio
      const ratio = Math.min(a4.w/iw, a4.h/ih);
      const pw = iw*ratio, ph=ih*ratio;
      const px = (a4.w - pw)/2, py=(a4.h - ph)/2;
      if(i>0) pdf.addPage();
      pdf.addImage(img, 'JPEG', px, py, pw, ph, undefined, 'FAST');
      document.body.removeChild(node);
    }

    pdf.save(filename);
  }

  function makeFromSeasonalSelection(opts={}){
    if(!window.DATA){
      alert('Seasonal data not loaded yet.');
      return;
    }
    const { regionKey, category, includeNotes, orientation } = {
      ...getActiveSelection(),
      ...opts
    };
    const regionData = window.DATA[regionKey];
    if(!regionData){
      alert('Region data missing.');
      return;
    }
    const regionName = regionData.region || (regionKey[0].toUpperCase()+regionKey.slice(1));
    const allCrops = regionData.crops || [];
    const crops = filterCropsByCategory(allCrops, category);

    // Split to pages
    const chunks = paginateCrops(crops, orientation);
    if(chunks.length===0){
      alert('No crops found for current filters.');
      return;
    }

    const pages = [];
    // First page can include notes
    const first = buildGridPage(regionName, chunks[0], orientation);
    if(includeNotes) buildMetaBlocks(first, regionData, true);
    appendFooter(first);
    pages.push(first);

    // Rest pages (grid only + footer)
    for(let i=1;i<chunks.length;i++){
      const pg = buildGridPage(regionName, chunks[i], orientation);
      appendFooter(pg);
      pages.push(pg);
    }

    const catLabel = (category==='all'?'All':category[0].toUpperCase()+category.slice(1));
    const file = `PatchAndPot_${regionName}_${catLabel}_${orientation}.pdf`;
    renderSheetToPDF(pages, orientation, file);
  }

  // Public API
  return {
    makeFromSeasonalSelection
  };
})();
