<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Seasonal Planting Calendar • Patch & Pot (UK)</title>
  <meta name="description" content="UK seasonal planting calendar for small spaces with Scotland, Ireland, England and Wales variants: what to sow, plant and harvest, plus pest watch.">
  <link rel="stylesheet" href="style.css?v=pp-final">

  <!-- Page-local hard guards (prevents dimming/opacity bugs) -->
  <style>
    html,body,#siteHeader,main,footer{opacity:1!important;filter:none!important}
    /* tiny, safe additions that won’t fight your global theme */
    :root{
      --pp-panel:#0f1512; --pp-stroke:rgba(255,255,255,.14); --pp-ink:var(--ink,#f0fff3);
      --pp-muted:var(--inkdim,#9ab09f); --pp-green:var(--green2,#7ed495);
    }
    .wrap{max-width:1140px;margin:0 auto;padding:16px 20px}
    .pp-sub{color:var(--pp-muted);margin:0 0 .8rem}
    .pp-card{background:rgba(255,255,255,.07);border:1px solid var(--pp-stroke);border-radius:16px;padding:1rem;margin:1rem 0}
    .pp-toolbar{display:grid;grid-template-columns:1fr;gap:.75rem;padding:.7rem .8rem;background:rgba(255,255,255,.04);border:1px solid var(--pp-stroke);border-radius:12px}
    .pp-row-flex{display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center}
    .pp-select,.pp-search{background:#0c100e;color:var(--pp-ink);border:1px solid var(--pp-stroke);border-radius:10px;padding:.55rem .65rem}
    .pp-help{color:var(--pp-muted);margin:.25rem 0 0}
    .btn{display:inline-flex;align-items:center;gap:.5rem;border-radius:12px;padding:.7rem 1rem;font-weight:700;border:0;background:linear-gradient(180deg,var(--pp-green),var(--green,#2E7D32));color:#061007}
    .btn[disabled]{opacity:.7;cursor:wait}
    /* keep the button on-screen on small iPhones */
    .pp-actions{display:flex;flex-wrap:wrap;gap:.6rem}
    .pp-actions > *{flex:1 1 auto}
    @media (min-width:720px){ .pp-toolbar{grid-template-columns:1fr auto} .pp-actions{justify-content:flex-end;flex-wrap:nowrap} .pp-actions>*{flex:0 0 auto} }

    /* Pest watch card */
    .pp-pestwatch{background:#16201b;border-left:4px solid var(--pp-green);border:1px solid var(--pp-stroke);border-radius:14px;padding:1rem;margin:1rem 0}
    .pp-pestwatch small{color:var(--pp-muted)}
    .pp-pestwatch ul{margin:.45rem 0 0;padding-left:1.1rem}

    /* Legend */
    .pp-legend{display:flex;gap:18px;align-items:center;color:var(--pp-ink);margin:.6rem 0 .6rem}
    .pp-legend span{display:inline-flex;align-items:center;gap:.35rem}

    /* Calendar grid – **12 months** + wide crop column */
    .pp-calendar{display:grid;grid-template-columns:minmax(240px,1.2fr) repeat(12,minmax(54px,1fr));gap:2px;border:1px solid var(--pp-stroke);border-radius:16px;overflow:hidden;background:var(--pp-panel)}
    .pp-row{display:contents}
    .pp-head,.pp-cell{padding:.6rem .6rem;border:1px solid var(--pp-stroke);font-size:.95rem;line-height:1.25}
    .pp-head{font-weight:800;background:#121815;white-space:nowrap}
    .pp-cell{line-height:1.25}
    .pp-crop{background:#121815;font-weight:800;white-space:normal;word-break:break-word}
    .pp-crop .tags{display:block;font-size:.82rem;color:var(--pp-muted);font-weight:600;margin-top:.15rem}

    /* Month hint & today list */
    .pp-month-hint{color:var(--pp-muted);margin:.2rem 0 .6rem}
    .pp-list{list-style:none;margin:0;padding:0}
    .pp-list li{padding:.55rem .65rem;border:1px dashed var(--pp-stroke);border-radius:10px;margin:.4rem 0;background:#0f1512}

    /* Accessibility / helpers */
    .sr-only{position:absolute;left:-9999px}
    .pp-error{display:none;background:#331c1c;border:1px solid #6d2b2b;color:#ffd7d7;border-radius:12px;padding:.8rem 1rem;margin-top:10px}

    /* Small tweaks for narrow phones so nothing gets pushed off-screen */
    @media (max-width:420px){
      .pp-calendar{grid-template-columns:minmax(210px,1.2fr) repeat(12,minmax(44px,1fr))}
      .pp-head,.pp-cell{padding:.5rem}
    }
  </style>
</head>
<body>

  <!-- HEADER PARTIAL -->
  <div data-include="partials/header.html"></div>

  <main class="wrap" id="maincontent">
    <h1>Seasonal Planting Calendar (UK)</h1>
    <p class="pp-sub">Small-space sowing, planting &amp; harvesting with regional variants for <strong>Scotland</strong>, <strong>Ireland</strong>, <strong>England</strong> and <strong>Wales</strong>.</p>

    <section class="pp-card" aria-labelledby="filters-title">
      <h2 id="filters-title" class="sr-only">Filters</h2>
      <div class="pp-toolbar">
        <div class="pp-row-flex">
          <label for="pp-region">Region:</label>
          <select id="pp-region" class="pp-select">
            <option value="scotland">Scotland</option>
            <option value="ireland">Ireland</option>
            <option value="england">England</option>
            <option value="wales">Wales</option>
          </select>

          <input id="pp-search" class="pp-search" type="search" placeholder="Search crops (e.g., carrot, basil)…" aria-label="Search crops">
          <label class="sr-only" for="pp-category">Category</label>
          <select id="pp-category" class="pp-select" aria-label="Category">
            <option value="all">All categories</option>
            <option value="leafy">Leafy</option>
            <option value="roots">Roots</option>
            <option value="legumes">Legumes</option>
            <option value="fruit">Fruiting veg</option>
            <option value="alliums">Alliums</option>
            <option value="herbs">Herbs</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="pp-actions">
          <label style="display:inline-flex;align-items:center;gap:.45rem">
            <input type="checkbox" id="pp-this-month"> <span>Show activity this month only</span>
          </label>

          <label style="display:inline-flex;align-items:center;gap:.45rem">
            <span>Page:</span>
            <select id="pp-page" class="pp-select" aria-label="PDF page size">
              <option value="portrait">Portrait A4</option>
              <option value="landscape">Landscape A4</option>
            </select>
          </label>

          <label style="display:inline-flex;align-items:center;gap:.45rem">
            <input type="checkbox" id="pp-include-basics" checked> <span>Include Basics &amp; Pest Watch</span>
          </label>

          <button id="pp-make-pdf" class="btn" type="button">📄 Download PDF</button>
        </div>
      </div>
      <p class="pp-help">Tip: pick a <strong>Region</strong>, type to <strong>search</strong>, choose a <strong>Category</strong>, or toggle <strong>This month only</strong> for a focused view.</p>
    </section>

    <section class="pp-pestwatch" id="pp-pestwatch" aria-labelledby="pestwatch-title">
      <h3 id="pestwatch-title">Pest Watch – <span id="pp-month-name"></span> (<span id="pp-region-name"></span>)</h3>
      <small>Small spaces edition</small>
      <ul><li>Loading…</li></ul>
    </section>

    <section class="pp-card" aria-labelledby="today-title">
      <h2 id="today-title">What Can I Plant Today?</h2>
      <p class="pp-month-hint" id="pp-month-hint"></p>
      <ul id="pp-today-list" class="pp-list"></ul>
    </section>

    <div class="pp-legend" aria-hidden="true">
      <span>🌱 <em>Sow</em></span>
      <span>🪴 <em>Plant</em></span>
      <span>🥕 <em>Harvest</em></span>
    </div>

    <p class="pp-month-hint">On a narrow phone, rotate to landscape to see all months.</p>

    <section aria-labelledby="calendar-title">
      <h2 id="calendar-title">Seasonal Planting Calendar</h2>
      <div class="pp-calendar" id="pp-calendar" role="table" aria-label="Seasonal planting calendar"></div>
      <div id="pp-error" class="pp-error"></div>
    </section>
  </main>

  <footer role="contentinfo">
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 0;border-top:1px solid #142116;background:#0a0f0c">
      <img src="img/patchandpot-icon.png" alt="Patch &amp; Pot icon" width="28" height="28" onerror="this.style.display='none'">
      <p style="margin:0;color:#9ab09f">© 2025 Patch &amp; Pot | Created by Grant Cameron Anthony</p>
    </div>
  </footer>

  <!-- Load header partial safely -->
  <script>
    (function(){
      const host=document.querySelector('[data-include="partials/header.html"]');
      if(!host) return;
      fetch('partials/header.html',{cache:'no-store'}).then(r=>r.text()).then(html=>{
        host.outerHTML=html;
        const header=document.getElementById('siteHeader');
        if(!header) return;
        const toggle=header.querySelector('.menu-toggle');
        const nav=header.querySelector('#primaryNav');
        const fn=(location.pathname.split('/').pop()||'index.html').toLowerCase();
        header.querySelectorAll('.nav a').forEach(a=>{
          if((a.getAttribute('href')||'').toLowerCase()===fn){ a.setAttribute('aria-current','page'); }
        });
        function openMenu(on){
          header.classList.toggle('menu-open',on);
          if(toggle){toggle.classList.toggle('menu-open',on);toggle.setAttribute('aria-expanded',on?'true':'false');}
        }
        toggle && toggle.addEventListener('click',()=>openMenu(!header.classList.contains('menu-open')));
        nav && nav.addEventListener('click',e=>{ if(e.target.tagName==='A') openMenu(false); });
      }).catch(()=>{});
    })();
  </script>

  <!-- Seasonal app (loads JSON once, renders grid, and exposes current selection to the PDF generator) -->
  <script>
    const PP_MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; // 12 months – fixed
    const CUR_M=new Date().getMonth();
    const REGIONS=["scotland","ireland","england","wales"];
    let DATA={}; const MISSING=Object.fromEntries(REGIONS.map(r=>[r,new Set()]));

    const inferCategory=name=>{
      const n=(name||"").toLowerCase();
      if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
      if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
      if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
      if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|tomatillo)/.test(n))return"fruit";
      if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
      if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
      return"other";
    };

    const fetchJSON = url => fetch(url+`?t=${Date.now()}`,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(url));

    function loadBlock(region,block){
      const url=`data/regions/${region}/${block}.json`;
      return fetchJSON(url).catch(()=>{ MISSING[region].add(block); return (block==='basics'||block==='pestwatch')?{}:[]; });
    }
    function assembleRegion(region){
      const metaP=Promise.all([loadBlock(region,'basics'),loadBlock(region,'pestwatch')]).then(([basics,pestwatch])=>({basics,pestwatch}));
      const cropP=Promise.all(['roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'].map(b=>loadBlock(region,b))).then(parts=>parts.flat());
      return Promise.all([metaP,cropP]).then(([meta,crops])=>({region,basics:meta.basics||{},pestwatch:meta.pestwatch||{},crops:(crops||[]).filter(c=>c && c.name)}));
    }

    function filters(){
      return {
        q:(document.getElementById('pp-search')?.value||'').trim().toLowerCase(),
        cat:document.getElementById('pp-category')?.value||'all',
        thisMonth:!!document.getElementById('pp-this-month')?.checked
      };
    }
    function applyFilters(list){
      const f=filters();
      return (list||[])
        .filter(c=>c && c.name)
        .filter(c=>{
          const name=c.name;
          const cat=(c.category||inferCategory(name));
          if(f.q && !name.toLowerCase().includes(f.q)) return false;
          if(f.cat!=='all' && cat!==f.cat) return false;
          if(f.thisMonth){
            const s=(c.months?.sow||[]).includes(CUR_M);
            const p=(c.months?.plant||[]).includes(CUR_M);
            const h=(c.months?.harvest||[]).includes(CUR_M);
            if(!(s||p||h)) return false;
          }
          return true;
        });
    }

    function humanRegion(k){ return k.charAt(0).toUpperCase()+k.slice(1); }
    function setMonthHints(){
      const m=PP_MONTHS[CUR_M];
      document.getElementById('pp-month-hint').textContent=`Here’s what suits containers now in ${m}.`;
      document.getElementById('pp-month-name').textContent=m;
    }
    function renderPestWatch(region){
      const r=DATA[region]||{};
      const entry=(r.pestwatch && r.pestwatch[String(CUR_M)])||{items:["No major alerts this month. Keep an eye on slugs after rain."]};
      document.getElementById('pp-region-name').textContent=humanRegion(region);
      document.querySelector('#pp-pestwatch ul').innerHTML=(entry.items||[]).map(i=>`<li>${i}</li>`).join('')||'<li>No items.</li>';
    }
    function renderToday(region){
      const r=DATA[region]||{};
      const items=[];
      applyFilters(r.crops).forEach(c=>{
        const s=(c.months?.sow||[]).includes(CUR_M);
        const p=(c.months?.plant||[]).includes(CUR_M);
        const h=(c.months?.harvest||[]).includes(CUR_M);
        if(s||p||h){
          const tag=c.category||inferCategory(c.name);
          items.push(`<li><strong>${c.name}</strong> ${s?"🌱":""}${p?" 🪴":""}${h?" 🥕":""} <span class="tags">(${tag})</span></li>`);
        }
      });
      document.getElementById('pp-today-list').innerHTML=items.length?items.join(''):`<li>No items match your filters for ${PP_MONTHS[CUR_M]}.</li>`;
    }
    function renderCalendar(region){
      const r=DATA[region]||{};
      const wrap=document.getElementById('pp-calendar');
      const head=`<div class="pp-row"><div class="pp-head">Crop</div>${PP_MONTHS.map(m=>`<div class="pp-head">${m}</div>`).join('')}</div>`;
      const rows=applyFilters(r.crops).map(c=>{
        const cat=c.category||inferCategory(c.name);
        const cells=PP_MONTHS.map((_,i)=>{
          const s=(c.months?.sow||[]).includes(i);
          const p=(c.months?.plant||[]).includes(i);
          const h=(c.months?.harvest||[]).includes(i);
          const marks=[s?"🌱":"",p?"🪴":"",h?"🥕":""].join(' ').trim();
          return `<div class="pp-cell">${marks}</div>`;
        }).join('');
        return `<div class="pp-row"><div class="pp-cell pp-crop"><span>${c.name}</span><span class="tags">(${cat})</span></div>${cells}</div>`;
      }).join('');
      wrap.innerHTML=head+rows;

      const miss=[...MISSING[region]].sort();
      const box=document.getElementById('pp-error');
      if(miss.length){ box.style.display='block'; box.innerHTML=`<strong>Missing for ${humanRegion(region)}:</strong><br>${miss.map(x=>`data/regions/${region}/${x}.json`).join('<br>')}`; }
      else { box.style.display='none'; box.textContent=''; }
    }
    function renderAll(){
      const sel=document.getElementById('pp-region');
      const r=sel?sel.value:'scotland';
      localStorage.setItem('pp-region',r);
      setMonthHints(); renderPestWatch(r); renderToday(r); renderCalendar(r);
    }

    // boot
    Promise.all(REGIONS.map(r=>assembleRegion(r).then(o=>{DATA[r]=o}))).then(()=>{
      const sel=document.getElementById('pp-region');
      if(sel) sel.value=localStorage.getItem('pp-region')||'scotland';
      ['pp-search','pp-category','pp-this-month'].forEach(id=>{
        const el=document.getElementById(id);
        el && el.addEventListener(id==='pp-search'?'input':'change',renderAll);
      });
      sel && sel.addEventListener('change',renderAll);
      renderAll();
    });

    // Expose current selection to the PDF generator
    window.PP_VIEW={
      getSelection:()=>({
        region: document.getElementById('pp-region')?.value || 'scotland',
        category: document.getElementById('pp-category')?.value || 'all',
        q:(document.getElementById('pp-search')?.value || '').trim(),
        page:(document.getElementById('pp-page')?.value || 'portrait'),
        includeBasics: !!document.getElementById('pp-include-basics')?.checked
      })
    };
  </script>

  <!-- PDF libs (official) -->
  <script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js" defer></script>

  <!-- Our generator -->
  <script src="assets/pdf/pdf-generator.js?v=pp-final" defer></script>

  <!-- Wire button once everything is ready -->
  <script>
    window.addEventListener('load', ()=>{
      const btn=document.getElementById('pp-make-pdf');
      if(!btn) return;
      btn.addEventListener('click', async ()=>{
        try{
          btn.disabled=true; btn.textContent='Building…';
          if(!window.PP_PDF || !window.PP_PDF.generate){ alert('PDF generator not found.'); return; }
          await window.PP_PDF.generate(window.PP_VIEW.getSelection());
        }catch(e){
          alert('Sorry, PDF generation failed.');
        }finally{
          btn.disabled=false; btn.textContent='📄 Download PDF';
        }
      });
    });
  </script>
</body>
</html>
