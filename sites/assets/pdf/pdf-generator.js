// /sites/assets/pdf/pdf-generator.js
// Builds a printable A4 sheet using your .pdf-sheet scaffold and renders via html2canvas + jsPDF

(function(){
  if (window.PP_PDF_READY) return;
  window.PP_PDF_READY = true;

  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    console.error('jsPDF not found');
    return;
  }

  // Helpers
  const $ = (sel, root=document) => root.querySelector(sel);

  function currentFilters(){
    const regionSel = $('#pp-region');
    const regionVal = regionSel ? regionSel.value : 'scotland';
    const regionText = regionSel ? regionSel.options[regionSel.selectedIndex].text : 'Scotland';

    const catSel = $('#pp-category');
    const catVal = catSel ? catSel.value : 'all';
    const catText = catSel ? catSel.options[catSel.selectedIndex].text : 'All categories';

    const q = ($('#pp-search')?.value || '').trim();
    const thisMonth = !!$('#pp-this-month')?.checked;

    return { regionVal, regionText, catVal, catText, q, thisMonth };
  }

  function monthNames(){ return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; }

  function collectCalendarRows(){
    // Rebuild from the rendered calendar so PDF mirrors the on-screen filters
    const grid = $('#pp-calendar');
    if (!grid) return [];

    // The grid is: one header row (we skip it), then logical rows of 13 cells each (1 crop + 12 months)
    const cells = Array.from(grid.children).filter(el => !el.classList.contains('pp-head'));
    const rows = [];
    let buf = [];
    for (const cell of cells){
      buf.push(cell);
      if (buf.length === 13){ rows.push(buf); buf = []; }
    }
    return rows;
  }

  function buildSheet(){
    const { regionText, catVal, catText, q, thisMonth } = currentFilters();
    const M = new Date().getMonth();

    // Root printable sheet (A4 at 72dpi: 794x1123) – uses your CSS
    const sheet = document.createElement('div');
    sheet.className = 'pdf-sheet';
    sheet.style.position = 'fixed'; // ensure positioned ancestor for .wash
    sheet.style.zIndex = -1;
    sheet.style.left = '-99999px';
    sheet.style.top = '0';

    // Title + meta
    const head = document.createElement('div');
    head.className = 'pdf-head';
    head.innerHTML = `
      <h1 class="pdf-title">Patch &amp; Pot — Seasonal Planting</h1>
      <div class="pdf-meta">Generated ${new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})}</div>
    `;
    sheet.appendChild(head);

    const sub = document.createElement('div');
    sub.className = 'pdf-sub';
    sub.textContent = `Region: ${regionText} • Category: ${catText}${q ? ` • Search: “${q}”` : ''}${thisMonth ? ' • This month only' : ''}`;
    sheet.appendChild(sub);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
      <span>🌱 Sow</span>
      <span>🪴 Plant</span>
      <span>🥕 Harvest</span>
    `;
    sheet.appendChild(legend);

    // Grid (div-based to match your CSS)
    const pdfGrid = document.createElement('div');
    pdfGrid.className = 'pdf-grid';

    // Header row
    const hCrop = document.createElement('div');
    hCrop.className = 'pdf-headcell';
    hCrop.textContent = 'Crop';
    pdfGrid.appendChild(hCrop);

    monthNames().forEach(m=>{
      const hc = document.createElement('div');
      hc.className = 'pdf-headcell';
      hc.textContent = m;
      pdfGrid.appendChild(hc);
    });

    // Data rows pulled from on-page calendar
    const rows = collectCalendarRows();
    rows.forEach(cells=>{
      // Crop cell (first in the 13)
      const cropCell = document.createElement('div');
      cropCell.className = 'pdf-cell pdf-crop';

      const nm = cells[0].querySelector('.name')?.textContent ||
                 cells[0].textContent.trim() || '';
      const tag = cells[0].querySelector('.pp-tags')?.textContent || '';

      const nEl = document.createElement('div');
      nEl.className = 'name';
      nEl.textContent = nm;
      cropCell.appendChild(nEl);

      if (tag){
        const tEl = document.createElement('div');
        tEl.className = 'pdf-tag';
        tEl.textContent = tag.replace(/[()]/g,'').trim();
        cropCell.appendChild(tEl);
      }

      pdfGrid.appendChild(cropCell);

      // 12 month cells (emojis from on-page cells)
      for (let i=1;i<cells.length;i++){
        const val = cells[i].textContent.trim();
        const td = document.createElement('div');
        td.className = 'pdf-cell';
        td.style.textAlign = 'center';
        td.textContent = val;
        pdfGrid.appendChild(td);
      }
    });

    sheet.appendChild(pdfGrid);

    // Soft “watercolour” wash for the selected category (if specific category chosen)
    const washCat = (()=>{
      const map = { leafy:'leafy', roots:'roots', legumes:'legumes', fruit:'fruit', alliums:'alliums', herbs:'herbs', softfruit:'softfruit', other:'other' };
      return map[catVal] || null;
    })();
    if (washCat){
      const wash = document.createElement('div');
      wash.className = `wash wash-${washCat}`;
      sheet.appendChild(wash);
    }

    document.body.appendChild(sheet);
    return sheet;
  }

  async function renderSheetToPDF(sheet){
    const orient = (document.getElementById('pp-pdf-orientation')?.value || 'landscape').toLowerCase();

    // Render
    const canvas = await html2canvas(sheet, {
      backgroundColor:'#ffffff',
      useCORS:true,
      scale:2
    });

    // Build PDF
    const pdf = new jsPDF({
      orientation: orient,
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10; // mm
    const usableW = pageW - margin*2;
    const usableH = pageH - margin*2;

    // Image sizing
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pxPerMM = canvas.width / usableW; // approx px per mm at target width
    const drawW = usableW;
    const drawH = canvas.height / pxPerMM;

    if (drawH <= usableH){
      pdf.addImage(imgData, 'JPEG', margin, margin, drawW, drawH);
    } else {
      // paginate by slicing the canvas vertically
      const temp = document.createElement('canvas');
      const ctx = temp.getContext('2d');
      const sliceHpx = usableH * pxPerMM;
      let ypx = 0;
      let page = 0;

      while (ypx < canvas.height){
        const partH = Math.min(sliceHpx, canvas.height - ypx);
        temp.width = canvas.width;
        temp.height = partH;

        ctx.clearRect(0,0,temp.width,temp.height);
        ctx.drawImage(canvas, 0, ypx, canvas.width, partH, 0, 0, canvas.width, partH);

        const partData = temp.toDataURL('image/jpeg', 0.92);
        if (page > 0) pdf.addPage(undefined, orient);
        pdf.addImage(partData, 'JPEG', margin, margin, drawW, usableH);

        ypx += partH;
        page++;
      }
    }

    pdf.save('Patch-and-Pot-Seasonal.pdf');
  }

  async function onGenerate(){
    try{
      const sheet = buildSheet();
      await renderSheetToPDF(sheet);
      sheet.remove();
    }catch(e){
      console.error('PDF generation failed:', e);
      alert('Sorry, PDF generation failed.');
    }
  }

  function wire(){
    const btn = document.getElementById('pp-pdf-btn');
    if (btn) btn.addEventListener('click', onGenerate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
