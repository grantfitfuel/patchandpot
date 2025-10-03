/* global DATA, PP_MONTHS, CUR_M, inferCategory, getFilters, humanRegion */
(function(root){
  const CAT_LABEL = {
    leafy:"Leafy", roots:"Roots", legumes:"Legumes", fruit:"Fruiting veg",
    alliums:"Alliums", herbs:"Herbs", softfruit:"Soft fruit", other:"Other"
  };

  function el(tag, cls, html){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(html!=null) e.innerHTML=html;
    return e;
  }

  function buildSheet(regionKey, categoryKey){
    const region = (root.DATA && root.DATA[regionKey]) || {};
    const f = root.getFilters ? root.getFilters() : { q:"", thisMonth:false };

    const crops = (region.crops||[])
      .filter(c => (c.category||root.inferCategory(c.name))===categoryKey)
      .filter(c => !f.q || (c.name||'').toLowerCase().includes(f.q))
      .filter(c => !f.thisMonth || ((c.months?.sow||[]).includes(root.CUR_M) ||
                                    (c.months?.plant||[]).includes(root.CUR_M) ||
                                    (c.months?.harvest||[]).includes(root.CUR_M)));

    const sheet = el('section','pdf-sheet');
    sheet.appendChild(el('div','wash wash-'+categoryKey));

    const head = el('div','pdf-head');
    head.appendChild(el('h2','pdf-title', (CAT_LABEL[categoryKey]||categoryKey)));
    head.appendChild(el('div','pdf-sub', `${root.humanRegion(regionKey)||regionKey} • ${new Date().toLocaleDateString()}`));
    sheet.appendChild(head);

    sheet.appendChild(el('div','legend', `<span>🌱 Sow</span><span>🪴 Plant out / transplant</span><span>🥕 Harvest</span>`));

    const grid = el('div','pdf-grid');
    grid.innerHTML = `
      <div class="pdf-row">
        <div class="pdf-headcell">Crop <span class="pdf-tag">(depth • spacing • light • where)</span></div>
        ${root.PP_MONTHS.map(m=>`<div class="pdf-headcell">${m}</div>`).join('')}
      </div>`;
    sheet.appendChild(grid);

    crops.forEach(c=>{
      const cat = c.category || root.inferCategory(c.name);
      const metaBits = [c.depth, c.spacing, c.light, c.where].filter(Boolean).join(' • ');
      const row = el('div','pdf-row');
      row.appendChild(el('div','pdf-cell pdf-crop', `
        <div>${c.name} <span class="pdf-tag">(${cat})</span></div>
        ${metaBits? `<div class="pdf-meta">${metaBits}</div>` : '' }
      `));
      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        const g = el('div','pdf-cell');
        g.textContent = `${s?'🌱':''}${p?' 🪴':''}${h?' 🥕':''}`.trim();
        row.appendChild(g);
      }
      grid.appendChild(row);
    });

    if(!crops.length){
      sheet.appendChild(el('div','pdf-meta','No crops match the current filters.'));
    }
    return sheet;
  }

  async function rasterise(el){
    const canvas = await root.html2canvas(el, {backgroundColor:'#ffffff', scale:2, useCORS:true});
    return canvas.toDataURL('image/png');
  }

  async function downloadCurrentViewAsPDF(){
    const { jsPDF } = root.jspdf || {};
    if(!jsPDF){ alert('PDF library missing'); return; }

    const region = document.getElementById('pp-region').value;
    const catSel = document.getElementById('pp-category').value;
    const cats = (catSel==='all') ? ['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'] : [catSel];

    const pdf = new jsPDF({orientation:'portrait', unit:'pt', format:'a4'});
    let first=true;

    for(const cat of cats){
      const sheet = buildSheet(region, cat);
      document.body.appendChild(sheet);
      const img = await rasterise(sheet);
      document.body.removeChild(sheet);

      if(!first) pdf.addPage();
      first=false;
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      pdf.addImage(img, 'PNG', 0, 0, w, h);
    }

    const name = `seasonal-${region}-${catSel==='all'?'all-categories':catSel}.pdf`;
    pdf.save(name);
  }

  // public API
  root.PP_PDF = {
    init(buttonSelector='#pp-download'){
      const btn = document.querySelector(buttonSelector);
      if(btn) btn.addEventListener('click', downloadCurrentViewAsPDF);
    },
    download: () => downloadCurrentViewAsPDF()
  };
})(window);
