/* Patch & Pot – PDF Generator (A4 portrait/landscape) */
(function(){
  const POT_ICON = 'img/patchandpot-icon.png';
  const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ---------------- small DOM helper
  const el=(t,a={},h)=>{const n=document.createElement(t);Object.entries(a).forEach(([k,v])=>n.setAttribute(k,v));if(h!=null)n.innerHTML=h;return n;}

  // ---------------- data loader (reads JSON from /sites/data/regions/…)
  const fetchJSON=(url)=>fetch(url+`?v=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(url));
  async function loadRegion(region){
    const base=`data/regions/${region}/`;
    const [basics,pestwatch,...parts] = await Promise.all([
      fetchJSON(base+'basics.json').catch(()=>({text:["Good hygiene, drainage, right pot size, and consistent watering."]})),
      fetchJSON(base+'pestwatch.json').catch(()=>({})),
      ...['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'].map(b=>fetchJSON(base+b+'.json').catch(()=>[]))
    ]);
    const crops = parts.flat().filter(c=>c && c.name);
    return { basics, pestwatch, crops };
  }

  // --------------- category inference (for tags)
  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|strawber|raspber|blueber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo|cape gooseberry)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return"other";
  }

  // --------------- build a PDF page (using jsPDF + autoTable)
  async function build(doc, regionKey, includeBasics, filter){
    const { crops, basics, pestwatch } = await loadRegion(regionKey);
    const { jsPDF } = window.jspdf;

    // Title page header
    const title = `Seasonal Planting — ${regionKey[0].toUpperCase()+regionKey.slice(1)}`;
    const legend = 'Legend: 🌱 = Sow   🪴 = Plant   🥕 = Harvest';

    // If including basics/pestwatch, render a short first page header block
    if(includeBasics){
      doc.setFont('helvetica','bold'); doc.setFontSize(18);
      doc.text(title, 14, 18);
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      doc.text(legend, 150, 18, {align:'right'});

      // Basics panel
      doc.setFillColor(20,31,25); // dark
      doc.setDrawColor(34, 93, 53);
      doc.roundedRect(14, 24, 182, 20, 3, 3, 'FD');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold'); doc.setFontSize(12);
      doc.text('Basics', 20, 33);
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      doc.text((basics.text||basics||["Good hygiene, drainage, right pot size, and consistent watering."]).join('  •  '), 20, 40);

      // Pest watch – current month if available
      const m = new Date().getMonth();
      const monthItems = (pestwatch && pestwatch[String(m)] && pestwatch[String(m)].items) || [];
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold'); doc.text('Pest Watch — ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m], 20, 48);
      doc.setFont('helvetica','normal');
      doc.text(monthItems.length ? monthItems.join('  •  ') : 'Keep an eye on slugs after rain.', 20, 55);
      doc.addPage();
    }

    // Filter crops if needed
    const list = (crops||[]).filter(c=>{
      if(!filter) return true;
      const q = (filter.q||'').toLowerCase();
      const cat = filter.category || 'all';
      const nameOk = q ? (c.name||'').toLowerCase().includes(q) : true;
      const catOk  = (cat==='all') ? true : ((c.category||inferCategory(c.name))===cat);
      return nameOk && catOk;
    });

    // Table data
    const body = list.map(c=>{
      const S=c.months?.sow||[], P=c.months?.plant||[], H=c.months?.harvest||[];
      return [
        {content: c.name + '\n' + `(${c.category||inferCategory(c.name)})`, styles:{fontStyle:'bold'}},
        ...MONTHS.map((_,i)=> (S.includes(i)?'🌱':'') + (P.includes(i)?' 🪴':'') + (H.includes(i)?' 🥕':''))
      ];
    });

    // Table header
    const head = [['Crop', ...MONTHS]];

    // autoTable (taller rows)
    doc.autoTable({
      head, body,
      startY: 16,
      theme: 'grid',
      styles: { font:'helvetica', fontSize:11, cellPadding:2.8, overflow:'linebreak', halign:'center', valign:'middle' },
      headStyles: { fillColor:[46,125,50], textColor:255, fontStyle:'bold', halign:'center' },
      columnStyles: { 0:{halign:'left', cellWidth:58} },
      alternateRowStyles: { fillColor:[246,250,247] },
      didDrawPage: (data)=>{
        // Header bar + legend + filter + date + brand pot
        doc.setFillColor(46,125,50); doc.rect(14, 8, 182, 6, 'F');
        doc.setTextColor(8,32,15); doc.setFontSize(14); doc.setFont('helvetica','bold');
        doc.text(title, 16, 13);
        doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(17,17,17);
        const filterTxt = `Filter: ${ (filter && filter.category && filter.category!=='all') ? filter.category : 'All categories' }`;
        const genTxt = `Generated ${new Date().toLocaleDateString('en-GB')}`;
        doc.text(filterTxt, 16, 22);
        doc.text(genTxt, 196, 22, {align:'right'});

        // tiny legend on the right of the green bar
        doc.setFontSize(10); doc.setTextColor(255,255,255);
        doc.text('🌱 Sow   🪴 Plant   🥕 Harvest', 196, 13, {align:'right'});

        // Footer brand
        const y = doc.internal.pageSize.getHeight() - 10;
        try{ doc.addImage(POT_ICON, 'PNG', 103, y-4, 4, 4); }catch(e){}
        doc.setTextColor(67,97,78);
        doc.setFontSize(10);
        doc.text('© 2025 Patch & Pot | Created by Grant Cameron Anthony', 105, y, {align:'left'});
      }
    });
  }

  // ---------------- public API
  window.PP_PDF = {
    async generate(selection){
      const { region, category, q, page, includeBasics } = selection||{};
      const { jsPDF } = window.jspdf;
      if(!jsPDF || !window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF missing');

      const isLandscape = (page==='a4l');
      const doc = new jsPDF({orientation: isLandscape?'landscape':'portrait', unit:'mm', format:'a4'});

      await build(doc, (region||'scotland'), !!includeBasics, {category:(category||'all'), q:(q||'')});

      // Open in a new tab / iOS viewer
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `seasonal-${region||'scotland'}.pdf`;
      // For iOS Safari: open rather than force download
      window.open(url, '_blank');
      setTimeout(()=>URL.revokeObjectURL(url), 15000);
    }
  };
})();
