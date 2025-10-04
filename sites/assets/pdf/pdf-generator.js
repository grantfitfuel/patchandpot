/* Patch & Pot — PDF Generator (A4, portrait/landscape)
   - Includes optional Basics + Pest Watch cover page
   - Taller row heights so long crop names never collide
   - 12 month columns
   - Proper branding footer each page
*/
(function(){
  const POT_ICON = 'img/patchandpot-icon.png'; // shown in footer if available
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // tiny helpers
  const fetchJSON = (url)=>fetch(url+`?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(url));
  const humanRegion = k => k ? k[0].toUpperCase()+k.slice(1) : '';

  async function loadRegion(region){
    const base = `data/regions/${region}/`;
    const [basics, pestwatch, ...parts] = await Promise.all([
      fetchJSON(base+'basics.json').catch(()=>({})),
      fetchJSON(base+'pestwatch.json').catch(()=>({})),
      ...['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'].map(b=>fetchJSON(base+b+'.json').catch(()=>[]))
    ]);
    const crops = parts.flat().filter(c=>c && c.name);
    return { basics, pestwatch, crops };
  }

  // autoTable column spec: first wide, 12 equal month cols
  function columns(){
    const cols=[{header:'Crop', dataKey:'crop'}];
    MONTHS.forEach((m,i)=>cols.push({header:m, dataKey:'m'+i}));
    return cols;
  }

  // convert crop list → rows with S/P/H emojis or blanks
  function toRows(crops){
    return (crops||[]).map(c=>{
      const row = { crop: `${c.name}\n(${c.category||''})` };
      for(let i=0;i<12;i++){
        const s=(c.months?.sow||[]).includes(i);
        const p=(c.months?.plant||[]).includes(i);
        const h=(c.months?.harvest||[]).includes(i);
        row['m'+i] = [s?'🌱':'', p?'🪴':'', h?'🥕':''].filter(Boolean).join(' ');
      }
      return row;
    });
  }

  function footer(doc, potImg){
    const pageCount = doc.getNumberOfPages();
    for(let i=1;i<=pageCount;i++){
      doc.setPage(i);
      const w=doc.internal.pageSize.getWidth(), h=doc.internal.pageSize.getHeight();
      // tiny pot in footer
      if(potImg) doc.addImage(potImg,'PNG', (w/2)-7, h-18, 14, 14);
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text('© 2025 Patch & Pot | Created by Grant Cameron Anthony', w/2, h-8, {align:'center'});
    }
  }

  function addHeaderBar(doc, title, filterText){
    const w=doc.internal.pageSize.getWidth();
    const x=14, y=16, barH=10;
    // green bar
    doc.setFillColor(40,120,60);
    doc.roundedRect(x, y, w-28, barH, 2, 2, 'F');
    // title
    doc.setFontSize(12);
    doc.setTextColor(255);
    doc.text(title, x+8, y+7, {baseline:'middle'});
    // filter text (right)
    doc.setFontSize(9);
    doc.text(filterText, w-28-8, y+7, {align:'right',baseline:'middle'});
  }

  async function loadPotIcon(){
    try{
      const res = await fetch(POT_ICON,{cache:'no-store'});
      if(!res.ok) return null;
      const blob = await res.blob();
      return await new Promise(resolve=>{
        const r=new FileReader();
        r.onload=()=>resolve(r.result);
        r.readAsDataURL(blob);
      });
    }catch{ return null; }
  }

  async function generatePDF(sel){
    const { jsPDF } = window.jspdf || {};
    if(!jsPDF || !window.jspdf || !('autoTable' in jsPDF.API)) throw new Error('jsPDF/autotable missing');

    const region = (sel?.region || 'scotland').toLowerCase();
    const includeBasics = !!sel?.includeBasics;
    const landscape = sel?.page === 'landscape';

    const data = await loadRegion(region);
    const potImg = await loadPotIcon();

    const doc = new jsPDF({orientation: landscape?'landscape':'portrait', unit:'pt', format:'a4'});

    // Optional cover page: Basics + Pest Watch
    if(includeBasics){
      doc.setFont('helvetica','bold');
      doc.setFontSize(18);
      doc.text(`Seasonal Planting — ${humanRegion(region)}`, 40, 40);

      doc.setFontSize(10);
      doc.text(`Legend: 🌱 = Sow   🪴 = Plant   🥕 = Harvest`, doc.internal.pageSize.getWidth()-40, 40, {align:'right'});

      // basics panel
      doc.setFillColor(20,28,24);
      doc.setDrawColor(35,60,45);
      doc.roundedRect(30, 60, doc.internal.pageSize.getWidth()-60, 90, 8, 8, 'FD');
      doc.setTextColor(255);
      doc.setFontSize(13); doc.setFont('helvetica','bold');
      doc.text('Basics', 48, 86);
      doc.setFontSize(11); doc.setFont('helvetica','normal');
      doc.text((data.basics?.summary || 'Good hygiene, drainage, right pot size, and consistent watering.') , 48, 108, {maxWidth: doc.internal.pageSize.getWidth()-96});

      // pest watch (current month)
      const m = new Date().getMonth();
      const pest = (data.pestwatch && data.pestwatch[String(m)]?.items) || ['No major alerts this month. Keep an eye on slugs after rain.'];
      let y = 170;
      doc.setTextColor(255);
      doc.setFillColor(20,28,24);
      doc.setDrawColor(35,60,45);
      doc.roundedRect(30, y-24, doc.internal.pageSize.getWidth()-60, 24 + (pest.length*16) + 20, 8, 8, 'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.text(`Pest Watch – ${MONTHS[m]}`, 48, y);
      doc.setFont('helvetica','normal'); doc.setFontSize(11);
      doc.setTextColor(220);
      pest.forEach((line,i)=>{ doc.text(`• ${line}`, 48, y+22+(i*16), {maxWidth: doc.internal.pageSize.getWidth()-96}); });

      doc.addPage(landscape?'l':'p','a4');
    }

    // Build table pages by chunks to keep memory sane on iOS
    const perPage = 40; // rows per page (portrait); autotable handles flowing
    const rows = toRows(data.crops);
    const pages = Math.max(1, Math.ceil(rows.length / perPage));

    for(let p=0;p<pages;p++){
      const slice = rows.slice(p*perPage, (p+1)*perPage);
      addHeaderBar(doc, `Seasonal Planting — ${humanRegion(region)}`, `Filter: ${sel?.category==='all'||!sel?.category?'All categories':sel?.category}`);

      doc.autoTable({
        startY: 48,
        headStyles: { fillColor:[18,24,21], textColor:255, lineColor:[60,80,70], lineWidth:0.6, fontStyle:'bold' },
        styles: {
          lineColor:[60,80,70], lineWidth:0.4, halign:'center',
          cellPadding:{top:6,bottom:6,left:6,right:6}, // **taller rows**
          fontSize:10
        },
        bodyStyles: { textColor:20 },
        alternateRowStyles: { fillColor:[244,247,245] },
        columnStyles: Object.assign(
          { crop: {halign:'left', cellWidth: 200} },
          // 12 fairly even columns, wider to keep 3-letter month readable
          MONTHS.reduce((o,_,i)=>{ o['m'+i]={cellWidth:'auto', minCellWidth:34}; return o; }, {})
        ),
        head: [columns().map(c=>c.header)],
        columns: columns(),
        body: slice.map(r=>r),
        didParseCell: data=>{
          // crop column: left/allow wrap
          if(data.column.dataKey === 'crop'){
            data.cell.styles.halign='left';
          }
        }
      });

      if(p < pages-1) doc.addPage(landscape?'l':'p','a4');
    }

    footer(doc, potImg);

    const file = `PatchAndPot_Seasonal_${humanRegion(region)}.pdf`;
    doc.save(file);
  }

  // Public API
  window.PP_PDF = {
    generate: async (selection) => {
      try{
        await generatePDF(selection);
      }catch(err){
        console.error(err);
        alert('Sorry, PDF generation failed.');
      }
    }
  };
})();
