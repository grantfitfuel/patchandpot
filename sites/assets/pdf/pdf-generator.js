/* Patch & Pot – PDF generator (uses html2canvas + jsPDF)
   Relies on window.PP_APP.getState() from seasonal.html
*/
(function(){
  if (!window.jspdf || !window.html2canvas) return; // libs missing
  const { jsPDF } = window.jspdf;

  // Build one page (grid + optional meta)
  function buildSheet(state, opts){
    const sheet = document.createElement('section');
    sheet.className = 'pdf-sheet';
    sheet.setAttribute('data-orient', opts.orientation);

    // Header
    const head = document.createElement('div');
    head.className = 'pdf-head';
    head.innerHTML = `
      <h1 class="pdf-title">Seasonal Planting – ${state.regionName}</h1>
      <div class="pdf-sub">${state.monthName} • ${opts.categoryLabel}</div>
    `;
    sheet.appendChild(head);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `<span>🌱 Sow</span><span>🪴 Plant</span><span>🥕 Harvest</span>`;
    sheet.appendChild(legend);

    // Optional meta (Basics + Pest watch)
    if (opts.includeMeta){
      const meta = document.createElement('div');
      meta.className = 'meta-wrap';
      const basics = state.basics && state.basics.tips ? state.basics.tips : null;
      const pw = (state.pestwatch && state.pestwatch[String(state.monthIndex)] && state.pestwatch[String(state.monthIndex)].items) || [];
      meta.innerHTML = `
        ${basics ? `<h4>Basics</h4><p class="pdf-meta">${basics}</p>` : ``}
        ${pw.length ? `<h4>Pest Watch</h4><ul>${pw.slice(0,6).map(i=>`<li>${i}</li>`).join('')}</ul>` : ``}
      `;
      sheet.appendChild(meta);
    }

    // Grid
    const grid = document.createElement('div');
    grid.className = 'pdf-grid';
    const monthsHead = ["Crop"].concat(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]);
    // header row
    const headRow = document.createElement('div');
    headRow.className = 'pdf-row';
    headRow.innerHTML = monthsHead.map((m,i)=>`<div class="${i===0?'pdf-headcell':'pdf-headcell'}">${m}</div>`).join('');
    grid.appendChild(headRow);

    // rows
    const crops = state.crops;
    crops.forEach(c=>{
      const row = document.createElement('div');
      row.className = 'pdf-row';
      const tag = (c.category || '').toLowerCase();
      const nameCell = `<div class="pdf-headcell pdf-crop"><div>${c.name}</div><div class="pdf-tag">(${tag||'other'})</div></div>`;
      const cells = Array.from({length:12},(_,i)=>{
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const marks = [s?'🌱':'', p?'🪴':'', h?'🥕':''].join(' ').trim();
        return `<div class="pdf-cell"><span class="mark">${marks}</span></div>`;
      }).join('');
      row.innerHTML = nameCell + cells;
      grid.appendChild(row);
    });

    sheet.appendChild(grid);

    // Fixed footer branding (logo above, text below, centred)
    const foot = document.createElement('div');
    foot.className = 'pdf-footer';
    foot.innerHTML = `
      <img class="pdf-logo" src="img/patchandpot-icon.png" alt="Patch &amp; Pot">
      <div>© 2025 Patch &amp; Pot • Created by Grant Cameron Anthony</div>
    `;
    sheet.appendChild(foot);

    // Light watercolour wash per category (use current filter)
    const wash = document.createElement('div');
    const cat = (state.filters.cat || 'other').toLowerCase();
    wash.className = 'wash wash-'+(cat==='all'?'other':cat.replace(/\s+/g,''));
    sheet.appendChild(wash);

    document.body.appendChild(sheet);
    return sheet;
  }

  async function htmlToPdf(sheet, opts){
    // Dimensions: A4 portrait 595x842pt, landscape 842x595pt
    const isLandscape = opts.orientation === 'landscape';
    const pdf = new jsPDF({ orientation: opts.orientation, unit: 'pt', format: 'a4' });

    // Render with html2canvas at higher scale for crisp text
    const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pageW = isLandscape ? 842 : 595;
    const pageH = isLandscape ? 595 : 842;

    // Fit width, keep aspect
    const imgW = pageW;
    const ratio = canvas.height / canvas.width;
    const imgH = imgW * ratio;

    // If long content, split across pages
    let y = 0;
    const step = pageH;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -y, imgW, imgH);
      y += step;
    }

    return pdf;
  }

  async function generate(){
    const state = (window.PP_APP && window.PP_APP.getState && window.PP_APP.getState()) || null;
    if (!state) { alert('Data not ready yet.'); return; }

    const orientSel = document.getElementById('pp-orient');
    const includeMeta = !!document.getElementById('pp-include-meta')?.checked;
    const orientation = (orientSel && orientSel.value) || 'portrait';
    const catLabel = state.filters.cat==='all' ? 'All categories' : state.filters.cat[0].toUpperCase()+state.filters.cat.slice(1);

    const sheet = buildSheet(state, { orientation, includeMeta, categoryLabel: catLabel });
    const pdf = await htmlToPdf(sheet, { orientation });
    sheet.remove();

    const fname = `Patch_and_Pot_${state.regionName}_${catLabel}_${state.monthName}.pdf`.replace(/\s+/g,'_');
    pdf.save(fname);
  }

  function init(){
    const btn = document.getElementById('pp-pdf-btn');
    if (btn) btn.addEventListener('click', generate);
  }

  // Expose + init
  window.PP_PDF = { init, generate };
  // Auto-initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
