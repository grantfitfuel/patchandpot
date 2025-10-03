/* ============================================================
   Patch & Pot — Seasonal PDF generator
   Produces a multi-page A4 PDF from your JSON data & filters.
   ============================================================ */

(function () {
  const READY = (typeof window !== 'undefined');

  if (!READY) return;

  // Expose a single entry point
  window.PP_PDF = {
    makeFromSeasonal
  };

  // ---- public: called from seasonal.html button ----
  async function makeFromSeasonal(opts) {
    try {
      // 1) read current UI filters from seasonal.html if not provided
      const region = (opts && opts.region) || (document.getElementById('pp-region')?.value || 'scotland');
      const category = (opts && opts.category) || (document.getElementById('pp-category')?.value || 'all');
      const orientation = (opts && opts.orientation) || (document.getElementById('pp-orient')?.value || 'portrait');
      const includeBasics = (opts && 'includeBasics' in opts) ? !!opts.includeBasics : true;
      const includePest = (opts && 'includePest' in opts) ? !!opts.includePest : true;

      // 2) load region data (use same paths as seasonal.html)
      const blocks = ['basics','pestwatch','roots','leafy','legumes','fruit','alliums','herbs','softfruit','other'];
      const base = `data/regions/${region}/`;
      const [basics, pestwatch, ...cropBlocks] = await Promise.all(
        blocks.map(b => fetchJSON(base + b + '.json').catch(() => (b==='basics'||b==='pestwatch')?{}:[]))
      );
      const allCrops = cropBlocks.flat().filter(c => c && c.name);

      // 3) filter crops like the page does
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const inferCategory = (name) => {
        const n = (name||"").toLowerCase();
        if(/(lettuce|spinach|chard|rocket|kale|cabbage|salad|leaf|mizuna|mustard|endive|radicchio|pak|choi|bok|tat\s*soi|watercress)/.test(n))return"leafy";
        if(/(carrot|beet|beetroot|radish|turnip|parsnip|root|swede|celeriac|salsify|scorzonera|fennel)/.test(n))return"roots";
        if(/(pea|bean|chickpea|lentil|soy|edamame)/.test(n))return"legumes";
        if(/(tomato|pepper|chilli|aubergine|eggplant|courgette|zucchini|cucumber|squash|pumpkin|melon|cucamelon|strawber|blueber|raspber|gooseber|currant|fig|apple|pear|plum|cherry|rhubarb|cape gooseberry|tomatillo)/.test(n))return"fruit";
        if(/(onion|garlic|leek|shallot|spring onion|elephant garlic|welsh onion|chive)/.test(n))return"alliums";
        if(/(parsley|coriander|cilantro|basil|mint|thyme|sage|dill|oregano|marjoram|tarragon|lovage|chervil|fennel \(herb\)|lemon balm|bay|stevia|rosemary)/.test(n))return"herbs";
        return"other";
      };

      const crops = allCrops
        .map(c => ({...c, category: c.category || inferCategory(c.name)}))
        .filter(c => category === 'all' ? true : c.category === category);

      // 4) build DOM page (offscreen) with STRONG contrast and fixed column widths
      const sheet = buildSheet({
        region, category, basics, pestwatch, crops, months: MONTHS
      });

      document.body.appendChild(sheet);

      // 5) render each .pdf-page to canvas, then compose PDF
      const pages = Array.from(sheet.querySelectorAll('.pdf-page'));
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: (orientation === 'landscape' ? 'landscape' : 'portrait'), unit: 'pt', format: 'a4' });

      for (let i=0; i<pages.length; i++) {
        const pageEl = pages[i];
        // use html2canvas with scale 2 for crisper text on retina
        const canvas = await html2canvas(pageEl, { backgroundColor:'#ffffff', scale:2 });
        const img = canvas.toDataURL('image/jpeg', 0.92);
        const w = pdf.internal.pageSize.getWidth();
        const h = pdf.internal.pageSize.getHeight();
        pdf.addImage(img, 'JPEG', 0, 0, w, h, undefined, 'FAST');
        if (i < pages.length - 1) pdf.addPage();
      }

      // 6) download
      const niceCat = category === 'all' ? 'all-categories' : category;
      const stamp = new Date().toISOString().slice(0,10);
      pdf.save(`patchandpot-${region}-${niceCat}-${stamp}.pdf`);

      // cleanup
      sheet.remove();

      // helpers --------------
      function buildSheet({region, category, basics, pestwatch, crops, months}){
        const CUR_M = new Date().getMonth();
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-sheet';

        // chunk crops into pages (~28–30 rows per page at 13px)
        const CHUNK = 28;
        for (let start=0; start<crops.length || start===0; start += CHUNK) {
          const slice = crops.slice(start, start+CHUNK);

          const page = document.createElement('div');
          page.className = 'pdf-page'; // watercolor deliberately OFF for legibility

          // header
          const head = document.createElement('div');
          head.className = 'pdf-head';
          const left = document.createElement('div');
          const title = document.createElement('h2');
          title.className = 'pdf-title';
          title.textContent = `Seasonal Planting — ${cap(region)}`;
          left.appendChild(title);

          const sub = document.createElement('p');
          sub.className = 'pdf-sub';
          sub.textContent = `${capCategory(category)} • ${months[CUR_M]} • Page ${Math.floor(start/CHUNK)+1}/${Math.max(1,Math.ceil(crops.length/CHUNK))}`;
          left.appendChild(sub);

          head.appendChild(left);

          page.appendChild(head);

          // legend
          const legend = document.createElement('div');
          legend.className = 'legend';
          legend.innerHTML = `<span>🌱 <em>Sow</em></span><span>🪴 <em>Plant</em></span><span>🥕 <em>Harvest</em></span>`;
          page.appendChild(legend);

          // optional basics/pest panel (first page only if requested)
          if (start===0 && (basics || pestwatch)) {
            const box = document.createElement('div');
            box.className = 'meta-panel';
            const bits = [];
            if (basics && basics.text) bits.push(`<h4>Basics</h4><p>${escapeHTML(basics.text)}</p>`);
            const p = pestwatch && pestwatch[String(CUR_M)];
            if (p && p.items && p.items.length){
              bits.push(`<h4>Pest Watch – ${months[CUR_M]}</h4><ul>${p.items.map(i=>`<li>${escapeHTML(i)}</li>`).join('')}</ul>`);
            }
            box.innerHTML = bits.join('');
            page.appendChild(box);
          }

          // grid
          const grid = document.createElement('div');
          grid.className = 'pdf-grid';

          // head row
          const rowH = document.createElement('div'); rowH.className='pdf-row';
          const cropH = document.createElement('div'); cropH.className='pdf-headcell'; cropH.textContent='Crop';
          rowH.appendChild(cropH);
          months.forEach(m=>{
            const h = document.createElement('div'); h.className='pdf-headcell pdf-month'; h.textContent=m;
            rowH.appendChild(h);
          });
          grid.appendChild(rowH);

          // data rows
          slice.forEach(c=>{
            const r = document.createElement('div'); r.className='pdf-row';
            const leftC = document.createElement('div'); leftC.className='pdf-crop';
            leftC.innerHTML = `<span class="name">${escapeHTML(c.name)}</span><span class="pdf-tag">(${escapeHTML(c.category)})</span>`;
            r.appendChild(leftC);

            for (let i=0;i<12;i++){
              const s = Array.isArray(c.months?.sow) && c.months.sow.includes(i);
              const p = Array.isArray(c.months?.plant) && c.months.plant.includes(i);
              const h = Array.isArray(c.months?.harvest) && c.months.harvest.includes(i);
              const cell = document.createElement('div'); cell.className='pdf-cell';
              cell.textContent = `${s?'🌱':''}${p?'🪴':''}${h?'🥕':''}`;
              r.appendChild(cell);
            }
            grid.appendChild(r);
          });

          page.appendChild(grid);

          // footer (small pot LEFT of text)
          const foot = document.createElement('div');
          foot.className = 'pdf-footer mt-10';
          foot.innerHTML = `<img src="img/patchandpot-icon.png" alt=""> © 2025 Patch &amp; Pot | Created by Grant Cameron Anthony`;
          page.appendChild(foot);

          wrapper.appendChild(page);
        }
        return wrapper;
      }

      function cap(s){ return s ? s[0].toUpperCase()+s.slice(1) : '';}
      function capCategory(c){ return c==='all' ? 'All categories' : cap(c); }
    } catch (err) {
      console.error(err);
      alert('Sorry, PDF generation failed. Open the console for details.');
    }
  }

  // ---- utils ----
  function fetchJSON(url){
    return fetch(url+`?v=${Date.now()}`, {cache:'no-store'}).then(r=> r.ok ? r.json() : Promise.reject(url));
  }

  function escapeHTML(s){
    return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

})();
