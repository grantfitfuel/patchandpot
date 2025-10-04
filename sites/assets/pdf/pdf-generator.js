/* Patch & Pot — PDF Generator (A4, portrait/landscape) */
(function(){
  // ——— helpers ———
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const POT_ICON = 'img/patchandpot-icon.png'; // footer icon
  const CUR_M = new Date().getMonth();

  function fetchJSON(url){
    return fetch(url + `?v=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(url));
  }
  // load whole region payload used by the web page as well
  async function loadRegion(region){
    const base = `data/regions/${region}/`;
    const [basics, pestwatch, ...parts] = await Promise.all([
      fetchJSON(base + 'basics.json').catch(()=>({})),
      fetchJSON(base + 'pestwatch.json').catch(()=>({})),
      ...['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other']
        .map(b => fetchJSON(base + b + '.json').catch(()=>[]))
    ]);
    return {
      basics,
      pestwatch,
      crops: parts.flat().filter(c=>c && c.name)
    };
  }
  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|strawber|raspber|blueber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return"other";
  }
  function applyFilters(crops, {category, q}){
    const qq=(q||'').toLowerCase();
    return (crops||[]).filter(c=>{
      const cat=c.category||inferCategory(c.name);
      if(category && category!=='all' && cat!==category) return false;
      if(qq && !(c.name||'').toLowerCase().includes(qq)) return false;
      return true;
    });
  }

  // ——— PDF drawing helpers ———
  function jsPDFInstance(orientation){
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF; // local or UMD
    if(!jsPDF) throw new Error('jsPDF not loaded');
    return new jsPDF({ orientation: orientation || 'portrait', unit: 'pt', format: 'a4' });
  }
  function addFooter(doc){
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const y = h - 34;

    // pot icon (if available – ignore load errors)
    try { doc.addImage(POT_ICON, 'PNG', (w/2)-10, y-18, 20, 20); } catch(_) {}

    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(60,90,75);
    const text = "© 2025 Patch & Pot | Created by Grant Cameron Anthony";
    doc.text(text, w/2, y+12, {align:'center'});
  }
  function tableTheme(doc){
    return {
      headStyles:   { fillColor: [35, 120, 46], textColor: 0, halign: 'center', fontStyle: 'bold' },
      bodyStyles:   { fillColor: [245, 250, 247], textColor: 0, valign: 'middle' },
      alternateRowStyles: { fillColor: [235,245,240] },
      styles: { lineColor: [190, 210, 200], lineWidth: 0.6, cellPadding: 4 }
    };
  }

  // build “Basics & Pest” title panel
  function drawIntroPanel(doc, title, regionName){
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(20,30,25);
    doc.roundedRect(36, 64, w-72, 64, 8, 8, 'F');

    doc.setTextColor(255);
    doc.setFont('helvetica','bold'); doc.setFontSize(13);
    doc.text('Basics', 52, 86);

    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    doc.text((title||'Good hygiene, drainage, right pot size, and consistent watering.'), 52, 106, {maxWidth: w-104});

    // Pest for current month (short)
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.text(`Pest Watch — ${MONTHS[CUR_M]} (${regionName})`, 52, 134);
  }

  function pestLinesFrom(pestwatch){
    const entry = pestwatch && pestwatch[String(CUR_M)];
    const items = (entry && entry.items && entry.items.length) ? entry.items : ['No major alerts this month. Keep an eye on slugs after rain.'];
    return items;
  }

  // Create crops table page(s)
  function drawCropsTable(doc, crops){
    const head = [{content:'Crop', styles:{halign:'left'}}, ...MONTHS];
    const body = crops.map(c=>{
      const months = MONTHS.map((_,i)=>{
        const s=(c.months?.sow||[]).includes(i) ? '🌱' : '';
        const p=(c.months?.plant||[]).includes(i) ? '🪴' : '';
        const h=(c.months?.harvest||[]).includes(i) ? '🥕' : '';
        return [s,p,h].filter(Boolean).join(' ');
      });
      const cat=c.category||inferCategory(c.name);
      return [{content:`${c.name}\n(${cat})`, styles:{fontStyle:'bold'}}, ...months];
    });

    // sizing: first column wide; month columns wider than before; row height taller
    const firstCol = 210;              // crop name
    const monthCol = 32;               // 12 * 32 = 384
    const tableWidth = firstCol + 12*monthCol;

    doc.autoTable({
      startY: 170,
      margin: { left: 36, right: 36 },
      tableWidth,
      head: [head],
      body,
      ...tableTheme(doc),
      styles: { overflow: 'linebreak', cellWidth: 'wrap', minCellHeight: 20, fontSize: 10 },
      columnStyles: Object.fromEntries(
        [0, ...MONTHS.map((_,i)=>i+1)].map((idx, i) => [idx, {cellWidth: i===0? firstCol : monthCol, halign: i===0?'left':'center'}])
      ),
      didDrawPage: (data)=>{
        // Title strip per page
        const r = data.settings.margin.left;
        const w = doc.internal.pageSize.getWidth()-2*r;
        doc.setFillColor(35,120,46);
        doc.roundedRect(r, 36, w, 24, 8, 8, 'F');
        doc.setTextColor(0); doc.setFontSize(13); doc.setFont('helvetica','bold');
        doc.text('Seasonal Planting — Scotland', r+10, 53); // title updated by caller before printing if needed
        // legend
        doc.setFontSize(10); doc.setFont('helvetica','normal');
        doc.text('Legend: 🌱 = Sow   🪴 = Plant   🥕 = Harvest', r+w-270, 52);
        addFooter(doc);
      }
    });
  }

  // public API
  window.PP_PDF = {
    async generate(sel){
      const regionKey = (sel.region||'scotland').toLowerCase();
      const regionName = regionKey[0].toUpperCase()+regionKey.slice(1);
      const includeMeta = !!sel.includeMeta;
      const page = sel.page==='landscape' ? 'landscape' : 'portrait';

      // load data
      const region = await loadRegion(regionKey);
      let crops = applyFilters(region.crops, {category: sel.category, q: sel.q});

      if(!crops.length) {
        alert('No rows after filters. Clear the search or choose another category.');
        return;
      }

      const doc = jsPDFInstance(page);

      // first page: optional Basics & Pest
      if(includeMeta){
        drawIntroPanel(doc, region.basics?.summary || 'Good hygiene, drainage, right pot size, and consistent watering.', regionName);
        // Pest list
        const items = pestLinesFrom(region.pestwatch);
        doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(240);
        let y = 152;
        items.forEach(line=>{
          doc.text(`• ${line}`, 64, y, {maxWidth: doc.internal.pageSize.getWidth()-128});
          y += 16;
        });
        doc.addPage(page);
      }

      // table pages
      drawCropsTable(doc, crops);

      // fix title per page to match region
      const pages = doc.getNumberOfPages();
      for(let i=1;i<=pages;i++){
        doc.setPage(i);
        const r = 36, w = doc.internal.pageSize.getWidth()-72;
        doc.setTextColor(0); doc.setFont('helvetica','bold'); doc.setFontSize(13);
        doc.text(`Seasonal Planting — ${regionName}`, r+10, 53);
        // filter hint (top-right small)
        doc.setFont('helvetica','normal'); doc.setFontSize(8);
        const filterText = `Filter: ${sel.category==='all'?'All categories':sel.category}`;
        doc.text(filterText, r+w-90, 44);
        // generated date
        doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, r+w-90, 34);
      }

      doc.save(`Seasonal_${regionName}.pdf`);
    }
  };
})();
