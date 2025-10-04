/* Patch & Pot – PDF Generator (single engine)
   - Builds a polished A4 PDF from current selection (region, category, q, orient)
   - Strict file paths: /data/regions/<region>/{basics,pestwatch,roots,leafy,legumes,fruit,alliums,herbs,softfruit,other}.json
   - Uses jsPDF + autoTable only (no html2canvas dependencies)
*/

(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const CROP_BLOCKS = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];

  function inferCategory(name){
    const n=(name||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
    if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
    return"other";
  }

  async function fetchJSON(url){
    const res = await fetch(url + `?v=${Date.now()}`, {cache:'no-store'});
    if(!res.ok) throw new Error(url);
    return res.json();
  }

  async function loadRegion(region){
    // basics + pestwatch
    const basicsP = fetchJSON(`data/regions/${region}/basics.json`).catch(()=> ({}));
    const pestP   = fetchJSON(`data/regions/${region}/pestwatch.json`).catch(()=> ({}));

    // crop blocks
    const cropP = Promise.all(CROP_BLOCKS.map(b => fetchJSON(`data/regions/${region}/${b}.json`).catch(()=> [])))
      .then(parts=>{
        const merged=[];
        parts.forEach(block=>{
          if(Array.isArray(block)) merged.push(...block);
          else if(block && Array.isArray(block.crops)) merged.push(...block.crops);
        });
        return merged.filter(c=>c && c.name);
      });

    const [basics, pestwatch, crops] = await Promise.all([basicsP, pestP, cropP]);
    return { basics, pestwatch, crops };
  }

  function filterCrops(crops, category, q){
    let out = Array.isArray(crops) ? crops.slice() : [];
    if(category && category !== 'all'){
      out = out.filter(c => (c.category || inferCategory(c.name)) === category);
    }
    if(q){
      const s = q.trim().toLowerCase();
      if(s) out = out.filter(c => (c.name||'').toLowerCase().includes(s));
    }
    return out;
  }

  function marksForMonth(c, m){
    const s=(c.months?.sow||[]).includes(m);
    const p=(c.months?.plant||[]).includes(m);
    const h=(c.months?.harvest||[]).includes(m);
    // keep compact but legible
    return [s?"🌱":"",p?"🪴":"",h?"🥕":""].filter(Boolean).join(" ");
  }

  async function addFooter(doc){
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const y = pageH - 20; // padding from bottom

    // Logo (centered)
    try{
      // If the image is present, embed; if not, just skip
      const imgUrl = 'img/patchandpot-icon.png';
      const blob = await fetch(imgUrl, {cache:'no-store'}).then(r => r.ok ? r.blob() : null).catch(()=>null);
      if(blob){
        const data = await blobToDataURL(blob);
        const imgWmm = 16; // ~16mm
        const imgHmm = 16;
        // jsPDF units: default is "mm" in A4, so we can use them directly
        const x = (pageW - imgWmm)/2;
        const logoY = y - imgHmm - 2;
        doc.addImage(data, 'PNG', x, logoY, imgWmm, imgHmm);
      }
    }catch(_){/* ignore */ }

    // Text (centered)
    const text = "© 2025 Patch & Pot | Created by Grant Cameron Anthony";
    doc.setFontSize(9);
    doc.setTextColor(70, 86, 79);
    const textW = doc.getTextWidth(text);
    doc.text(text, (pageW - textW)/2, y);
  }

  function blobToDataURL(blob){
    return new Promise((resolve)=>{
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.readAsDataURL(blob);
    });
  }

  async function generatePDF(sel){
    const { jsPDF } = window.jspdf || {};
    if(!jsPDF || !window.jspdf || !docAuto()) throw new Error('jsPDF or autoTable missing');

    const region = sel.region || 'scotland';
    const category = sel.category || 'all';
    const q = (sel.q||'').trim();
    const orient = (sel.orient === 'landscape') ? 'landscape' : 'portrait';

    const { basics, pestwatch, crops } = await loadRegion(region);
    const list = filterCrops(crops, category, q);

    // Setup doc
    const doc = new jsPDF({ unit:'mm', format:'a4', orientation: orient });
    const pageW = doc.internal.pageSize.getWidth();

    // Title
    doc.setFont('helvetica','bold'); doc.setFontSize(14);
    doc.setTextColor(26,31,28);
    const title = `Seasonal Planting – ${region[0].toUpperCase()+region.slice(1)}${category!=='all' ? ` • ${category}` : ''}`;
    doc.text(title, 14, 16);

    // Subtitle
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.setTextColor(76,90,83);
    const sub = q ? `Filter: "${q}" • Months: Jan–Dec • Marks: 🌱 sow, 🪴 plant, 🥕 harvest`
                  : `Months: Jan–Dec • Marks: 🌱 sow, 🪴 plant, 🥕 harvest`;
    doc.text(sub, 14, 22);

    // Optional basics (one-liner if available)
    if(basics && basics.about){
      doc.setFontSize(9);
      doc.setTextColor(76,90,83);
      const lines = doc.splitTextToSize(basics.about, pageW - 28);
      doc.text(lines, 14, 28);
    }

    // Build table data
    const head = [{ content:"Crop (category)", styles:{ fillColor:[233,243,236], textColor:[26,31,28], halign:'left' } }]
                  .concat(MONTHS.map(m=>({ content:m, styles:{ fillColor:[233,243,236], textColor:[26,31,28], halign:'center' } })));

    const body = list.map(c=>{
      const cat = (c.category || inferCategory(c.name));
      const first = `${c.name}  (${cat})`;
      const row = [first];
      for(let i=0;i<12;i++) row.push(marksForMonth(c,i));
      return row;
    });

    // Render table
    doc.autoTable({
      head: [head.map(h => typeof h === 'string' ? {content:h} : h)],
      body,
      startY: basics && basics.about ? 36 : 30,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 2.4,
        textColor: [26,31,28],
        lineColor: [217,227,220],
        lineWidth: 0.2,
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [233,243,236],
        textColor: [26,31,28],
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 70 } // crop name column width
      },
      didDrawPage: function(data){
        // Legend under subtitle if first page
        if (data.pageNumber === 1) {
          doc.setFontSize(10);
          doc.setTextColor(26,31,28);
          const legend = 'Legend:  🌱 Sow    🪴 Plant    🥕 Harvest';
          const w = doc.getTextWidth(legend);
          doc.text(legend, pageW - 14 - w, 22);
        }
      },
      margin: { top: 16, right: 14, bottom: 24, left: 14 },
      didDrawCell: function(/*data*/){ /* allow rows to grow; long names wrap */ },
      willDrawCell: function(/*data*/){ /* hook reserved */ }
    });

    // Footer (logo + centered text) — after table so it’s on every page
    const pages = doc.getNumberOfPages();
    for(let p=1; p<=pages; p++){
      doc.setPage(p);
      await addFooter(doc);
    }

    // File name
    const stamp = new Date().toISOString().slice(0,10);
    const fname = `Patch-and-Pot_Seasonal_${region}_${category}_${stamp}.pdf`;
    doc.save(fname);
  }

  function docAuto(){
    return !!(window.jspdf && window.jspdf.jsPDF && typeof (window.jspdf.jsPDF.prototype.autoTable) === 'function' || (window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable));
  }

  window.PP_PDF = {
    generate: async (sel)=> {
      try{
        await generatePDF(sel || {});
      }catch(e){
        alert('PDF build failed.'); // iOS-friendly
        throw e;
      }
    }
  };
})();
