// /sites/assets/pdf/pdf-generator.js
// Generates a polished PDF from the current filters on /seasonal.html
(function(){
  if (window.PP_PDF_READY) return; // guard
  window.PP_PDF_READY = true;

  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    console.error('jsPDF not found');
    return;
  }

  // Utilities
  function $(sel, root=document){ return root.querySelector(sel); }
  function cloneClean(node){
    const n = node.cloneNode(true);
    // Remove aria-live noisy states; keep text only
    n.querySelectorAll('[aria-live]').forEach(el=>el.removeAttribute('aria-live'));
    return n;
  }

  function ensureStyles(printRoot){
    // Minimal print skin so it looks like the site, minus dark backgrounds
    const css = `
      @page { margin: 16mm; }
      body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0d1b12; }
      .pp-title { font-weight: 900; font-size: 18px; margin: 0 0 4px; }
      .pp-subtle { color:#3c5a49; margin: 0 0 8px; }
      .pp-section { margin: 8px 0 12px; }
      .pp-legend { display:flex; gap:12px; font-size: 12px; margin: 4px 0 8px; }
      .pp-legend span { display:inline-flex; gap:6px; align-items:center }
      .card { border:1px solid #ccd8cf; border-radius:10px; padding:10px; background:#fff; }
      .list { margin:6px 0 0; padding-left:18px; }
      .grid { width:100%; border-collapse:collapse; font-size:12px; }
      .grid th, .grid td { border:1px solid #d8e3db; padding:6px 7px; vertical-align:top; }
      .grid th { background:#eef5f0; font-weight:800; position:sticky; top:0 }
      .name { font-weight:800 }
      .tag { color:#496a57; font-weight:600; margin-left:6px; font-size:11px }
      .months { text-align:center; white-space:nowrap }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    printRoot.appendChild(style);
  }

  function buildPrintable() {
    const root = document.createElement('div');
    root.id = 'pp-pdf-root';
    root.style.position = 'fixed';
    root.style.left = '-99999px';
    root.style.top = '0';
    root.style.width = '1200px'; // wide canvas for landscape clarity
    root.style.background = '#fff';
    root.style.zIndex = '-1';

    ensureStyles(root);

    // Title / meta (region + filters)
    const regionSel = $('#pp-region');
    const regionName = regionSel ? regionSel.options[regionSel.selectedIndex].text : 'Region';
    const catSel = $('#pp-category');
    const catText = catSel ? catSel.options[catSel.selectedIndex].text : 'All categories';
    const query = ($('#pp-search')?.value || '').trim();
    const thisMonth = $('#pp-this-month')?.checked;

    const title = document.createElement('div');
    title.className = 'pp-section';
    title.innerHTML = `
      <div class="pp-title">Patch &amp; Pot — Seasonal Planting Calendar</div>
      <div class="pp-subtle">Region: <strong>${regionName}</strong> • Category: <strong>${catText}</strong>${query?` • Search: “${query}”`:''}${thisMonth?' • This month only':''}</div>
      <div class="pp-legend">
        <span>🌱 <em>Sow</em></span>
        <span>🪴 <em>Plant</em></span>
        <span>🥕 <em>Harvest</em></span>
      </div>
    `;
    root.appendChild(title);

    // Pestwatch (clone and restyle)
    const pestSrc = $('#pp-pestwatch');
    if (pestSrc) {
      const pw = document.createElement('div');
      pw.className = 'pp-section card';
      const h = pestSrc.querySelector('h3')?.textContent || 'Pest Watch';
      const items = Array.from(pestSrc.querySelectorAll('ul li')).map(li=>li.textContent);
      pw.innerHTML = `<div class="name">${h}</div><ul class="list">${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
      root.appendChild(pw);
    }

    // Today list
    const todaySrc = $('#pp-today-list');
    if (todaySrc) {
      const items = Array.from(todaySrc.querySelectorAll('li')).map(li=>li.textContent);
      const card = document.createElement('div');
      card.className = 'pp-section card';
      card.innerHTML = `<div class="name">What Can I Plant Today?</div><ul class="list">${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
      root.appendChild(card);
    }

    // Calendar grid: rebuild as a light table (no black boxes, no huge gaps)
    const cal = $('#pp-calendar');
    if (cal) {
      const table = document.createElement('table');
      table.className = 'pp-section grid';

      // Header
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      hr.innerHTML = `<th>Crop</th>${Array.from({length:12},(_,i)=>`<th>${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</th>`).join('')}`;
      thead.appendChild(hr);
      table.appendChild(thead);

      // Rows
      const tbody = document.createElement('tbody');
      // In page, cal is a grid; rebuild by reading row chunks:
      const rows = [];
      // Each logical row is 13 cells: 1 crop + 12 months; divs are in order because display:contents on .pp-row
      const cells = Array.from(cal.children);
      let buffer = [];
      for (const cell of cells) {
        const isHeaderCell = cell.classList.contains('pp-head');
        if (isHeaderCell) continue; // skip the visual header row; we already built a <thead>
        buffer.push(cell);
        // a logical row completes when we accumulate 13 cells (crop + 12 months)
        if (buffer.length === 13) {
          rows.push(buffer);
          buffer = [];
        }
      }
      rows.forEach(Row=>{
        const tr = document.createElement('tr');
        // crop cell
        const cropCell = document.createElement('td');
        const name = Row[0]?.querySelector('.name')?.textContent || Row[0]?.textContent || '';
        const tag  = Row[0]?.querySelector('.pp-tags')?.textContent || '';
        cropCell.innerHTML = `<span class="name">${name}</span>${tag?` <span class="tag">${tag}</span>`:''}`;
        tr.appendChild(cropCell);
        // months
        for (let i=1;i<Row.length;i++){
          const txt = Row[i].textContent.trim();
          const td = document.createElement('td');
          td.className='months';
          td.textContent = txt;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      root.appendChild(table);
    }

    document.body.appendChild(root);
    return root;
  }

  async function generatePDF(){
    try{
      const orient = (document.getElementById('pp-pdf-orientation')?.value || 'landscape').toLowerCase();
      const printable = buildPrintable();

      // Render to canvas
      const canvas = await html2canvas(printable, {
        backgroundColor:'#ffffff',
        useCORS:true,
        scale:2,               // crisp text
        windowWidth: 1200      // match our print root width
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

      // Fit image to page width, maintain aspect ratio
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const imgWmm = pageW - 20;  // 10mm margins each side (we already set @page but image should fit)
      const pxPerMM = canvas.width / (pageW); // approx
      const imgHmm = (canvas.height / pxPerMM) - 20; // rough fit with margins

      // Calculate ratio
      const ratio = imgWmm / (canvas.width / pxPerMM);
      const drawW = imgWmm;
      const drawH = (canvas.height / pxPerMM) * ratio;

      // If height exceeds one page, paginate
      if (drawH <= (pageH - 20)) {
        // Single page
        pdf.addImage(imgData, 'JPEG', 10, 10, drawW, drawH);
      } else {
        // Multi-page
        let y = 10;
        const pageContentH = pageH - 20; // top/bottom margins
        const sliceHpx = (pageContentH / drawH) * canvas.height; // how many px per page
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');

        let sY = 0;
        let pageIndex = 0;
        while (sY < canvas.height) {
          const remaining = canvas.height - sY;
          const partH = Math.min(sliceHpx, remaining);

          tempCanvas.width = canvas.width;
          tempCanvas.height = partH;

          ctx.clearRect(0,0,tempCanvas.width,tempCanvas.height);
          ctx.drawImage(canvas, 0, sY, canvas.width, partH, 0, 0, canvas.width, partH);

          const partData = tempCanvas.toDataURL('image/jpeg', 0.92);
          if (pageIndex>0) pdf.addPage();
          pdf.addImage(partData, 'JPEG', 10, 10, drawW, pageContentH);

          sY += partH;
          pageIndex++;
        }
      }

      pdf.save('Patch-and-Pot-Seasonal.pdf');
      printable.remove();
    } catch(err){
      console.error('PDF generation failed:', err);
      alert('Sorry, PDF generation failed.');
    }
  }

  function wireButton(){
    const btn = document.getElementById('pp-pdf-btn');
    if (!btn) return;
    btn.addEventListener('click', generatePDF);
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButton);
  } else {
    wireButton();
  }
})();
