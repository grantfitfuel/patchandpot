/* Patch & Pot PDF generator (jsPDF + autoTable)
 * - Orientation: portrait / landscape
 * - First page (optional): Basics + Pest Watch
 * - Seasonal grid: auto-paginated, taller rows for long crop names
 * - Footer: © text centred, pot emoji above
 */
(function(){
  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const BRAND = { green: [34, 103, 47], headerFill: [230, 240, 235] }; // P&P-ish
  const POT = "🪴";

  function jsPDFlib(){
    const lib = window.jspdf;
    return lib && (lib.jsPDF || lib.jsPDF);
  }

  async function fetchJSON(url){
    const r=await fetch(url,{cache:'no-store'});
    if(!r.ok) throw new Error(url);
    return r.json();
  }
  async function fetchRegion(region){
    const basics = await fetchJSON(`data/regions/${region}/basics.json`).catch(()=>({}));
    const pest   = await fetchJSON(`data/regions/${region}/pestwatch.json`).catch(()=>({}));
    const cats   = ["roots","leafy","legumes","fruit","alliums","herbs","softfruit","other"];
    const parts  = await Promise.all(cats.map(f=>fetchJSON(`data/regions/${region}/${f}.json`).catch(()=>[])));
    const crops  = parts.flat().filter(x=>x && x.name);
    return { basics, pestwatch: pest, crops };
  }

  function inferCategory(n){
    n=(n||"").toLowerCase();
    if(/(lettuce|spinach|chard|rocket|kale|cabbage|leaf|pak|choi|mizuna|mustard|endive|tat\s*soi)/.test(n))return"leafy";
    if(/(carrot|beet|beetroot|radish|turnip|root|swede|celeriac|salsify|fennel)/.test(n))return"roots";
    if(/(pea|bean|lentil|chickpea|edamame)/.test(n))return"legumes";
    if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|cucumber|squash|pumpkin|melon|strawber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo)/.test(n))return"fruit";
    if(/(onion|garlic|leek|shallot|chive)/.test(n))return"alliums";
    if(/(parsley|coriander|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|rosemary|chervil|lovage|bay)/.test(n))return"herbs";
    return"other";
  }

  function filterCrops(crops, {category, q}){
    let list = (crops||[]).filter(c=>c && c.name);
    if(category && category!=="all"){
      list = list.filter(c => (c.category||inferCategory(c.name)) === category);
    }
    if(q){
      const qq=q.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(qq));
    }
    return list;
  }

  function mark(c,i){
    const s=(c.months?.sow||[]).includes(i);
    const p=(c.months?.plant||[]).includes(i);
    const h=(c.months?.harvest||[]).includes(i);
    // letters (crisp in PDF)
    return [s?"S":"",p?"P":"",h?"H":""].join(" ");
  }

  function drawHeader(doc, opt){
    const {region, category, page} = opt;
    doc.setFont("helvetica","bold");
    doc.setFontSize(18);
    doc.text(`Seasonal Planting — ${region}`, 40, 40);
    doc.setFont("helvetica","normal");
    doc.setFontSize(10);
    const filter = `Filter: ${category==="all"?"All categories":category}`;
    const legend = "Legend: S = Sow   P = Plant   H = Harvest";
    doc.text(filter, 40, 56);
    doc.text(legend, doc.internal.pageSize.getWidth()-40, 56, {align:"right"});
  }

  function drawFooter(doc){
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.text(POT, w/2, h-40, {align:"center"});
    doc.text("© 2025 Patch & Pot | Created by Grant Cameron Anthony", w/2, h-22, {align:"center"});
  }

  function addInfoPage(doc, region, basics, pestwatch){
    const h=doc.internal.pageSize.getHeight();
    drawHeader(doc, {region,category:"all"});
    // dark card
    doc.setFillColor(27,34,31);
    doc.setDrawColor(20,33,22);
    doc.roundedRect(40, 80, doc.internal.pageSize.getWidth()-80, 120, 6, 6, "FD");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    doc.text("Basics", 55, 100);
    doc.setFont("helvetica","normal"); doc.setFontSize(11);
    const basicsTxt = (basics?.text) || "Good hygiene, drainage, right pot size, and consistent watering.";
    doc.text(basicsTxt, 55, 118, {maxWidth: doc.internal.pageSize.getWidth()-110});

    doc.setFont("helvetica","bold"); doc.setFontSize(12);
    const month = new Date().getMonth();
    doc.text(`Pest Watch – ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month]}`, 55, 146);
    doc.setFont("helvetica","normal"); doc.setFontSize(11);
    const items = (pestwatch && pestwatch[String(month)] && pestwatch[String(month)].items) || ["Keep an eye on slugs after rain."];
    let y=164;
    items.forEach(it=>{
      doc.circle(50, y-3, 1.2, "F");
      doc.text(it, 55, y, {maxWidth: doc.internal.pageSize.getWidth()-110});
      y += 14;
    });
    doc.setTextColor(0,0,0);
    drawFooter(doc);
  }

  function addCalendar(doc, region, rows, category){
    const autoTable = window.jspdf?.autoTable || (doc.autoTable && doc.autoTable.bind(doc));
    if(!autoTable){ throw new Error("autoTable plugin missing"); }

    // header band (brand green)
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(...BRAND.green);
    doc.roundedRect(40, 70, w-80, 16, 8, 8, "F");

    autoTable(doc, {
      startY: 90,
      head: [[ "Crop", ...MONTHS ]],
      body: rows.map(c => {
        const tag = `(${c.category||inferCategory(c.name)})`;
        return [
          `${c.name}\n${tag}`,
          ...MONTHS.map((_,i)=>mark(c,i))
        ];
      }),
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: {top: 6, right: 4, bottom: 6, left: 4},   // TALLER ROWS
        minCellHeight: 16,                                      // TALLER ROWS (key fix)
        lineColor: [210,220,214],
        lineWidth: 0.25
      },
      headStyles: {
        fillColor: BRAND.headerFill,
        textColor: [0,0,0],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 180, fontStyle: "bold" }                // wider crop column
      },
      theme: "grid",
      rowPageBreak: 'auto',
      didDrawPage: (data) => {
        drawHeader(doc, {region, category});
        drawFooter(doc);
      },
      margin: {top: 60, bottom: 60, left: 40, right: 40}
    });
  }

  async function generate(opts){
    const jsPDF = jsPDFlib();
    if(!jsPDF){ throw new Error("jsPDF missing"); }

    const region = (opts?.region || "scotland");
    const category = opts?.category || "all";
    const q = opts?.q || "";
    const orientation = opts?.orientation === "landscape" ? "landscape" : "portrait";
    const includeInfo = !!opts?.includeInfo;

    const payload = await fetchRegion(region);               // basics, pestwatch, crops[]
    const list     = filterCrops(payload.crops, {category, q});

    const doc = new jsPDF({orientation, unit:"pt", format:"a4"});

    if(includeInfo){
      addInfoPage(doc, region[0].toUpperCase()+region.slice(1), payload.basics, payload.pestwatch);
      doc.addPage();
    }

    addCalendar(doc, region[0].toUpperCase()+region.slice(1), list, category);

    // filename
    const ts = new Date();
    const fname = `Patch&Pot_Seasonal_${region}_${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,"0")}-${String(ts.getDate()).padStart(2,"0")}.pdf`;
    doc.save(fname);
  }

  window.PP_PDF = { generate };
})();
