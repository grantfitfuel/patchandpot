// Seasonal — stable renderer using your existing data shape
// data/regions/<region>/{alliums,fruit,herbs,leafy,legumes,other,roots,softfruit}.json
// + basics.json (optional) + pestwatch.json (optional)
(function(){
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const EMO = { sow:"🌱", plant:"🌿", harvest:"🧺" };

  const els = {
    region:  document.getElementById('regionSel'),
    cat:     document.getElementById('catSel'),
    search:  document.getElementById('searchBox'),
    monthOnly: document.getElementById('monthOnly'),
    status:  document.getElementById('status'),
    tbody:   document.getElementById('tbody'),
    pestBox: document.getElementById('pestBox'),
    pestTitle: document.getElementById('pestTitle'),
    pestList: document.getElementById('pestList')
  };

  function bust(url){ return `${url}${url.includes('?')?'&':'?'}v=${Date.now()}`; }
  async function fetchJSON(url){
    try{
      const r = await fetch(bust(url), {cache:'no-store'});
      if(!r.ok) throw 0;
      return await r.json();
    }catch(_){ return null; }
  }

  async function loadRegion(region){
    const base = `data/regions/${region}`;
    const files = ['alliums','fruit','herbs','leafy','legumes','other','roots','softfruit'];
    const parts = await Promise.all(files.map(f => fetchJSON(`${base}/${f}.json`)));
    const crops = parts.flat().filter(Boolean).filter(c => c.name);

    const pest  = await fetchJSON(`${base}/pestwatch.json`);
    return { crops, pest };
  }

  function filterCrops(crops){
    const q = (els.search.value||'').toLowerCase().trim();
    const cat = els.cat.value || 'all';
    const mOnly = els.monthOnly.checked;
    const m = (new Date()).getMonth();

    return crops.filter(c=>{
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (cat!=='all' && (c.category||'').toLowerCase()!==cat) return false;
      if (mOnly){
        const s=(c.months?.sow||[]).includes(m);
        const p=(c.months?.plant||[]).includes(m);
        const h=(c.months?.harvest||[]).includes(m);
        if(!(s||p||h)) return false;
      }
      return true;
    });
  }

  function cellMarks(c,m){
    const out=[];
    if ((c.months?.sow||[]).includes(m)) out.push(EMO.sow);
    if ((c.months?.plant||[]).includes(m)) out.push(EMO.plant);
    if ((c.months?.harvest||[]).includes(m)) out.push(EMO.harvest);
    return out.join(' ');
  }

  function renderTable(data){
    const crops = filterCrops(data.crops||[]);
    els.status.textContent = `${titleCase(els.region.value)} — ${crops.length} crops shown`;
    const frag = document.createDocumentFragment();

    crops.forEach(c=>{
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = c.name;
      tr.appendChild(tdName);
      for (let i=0;i<12;i++){
        const td = document.createElement('td');
        const marks = cellMarks(c,i);
        if (marks) td.textContent = marks;
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    });

    els.tbody.innerHTML = '';
    els.tbody.appendChild(frag);
  }

  function renderPest(region, pest){
    if (!pest || typeof pest !== 'object'){ els.pestBox.hidden=true; return; }
    const m = String((new Date()).getMonth());
    const list = (pest[m]?.items)||[];
    els.pestTitle.textContent = `Pest Watch — ${MONTHS[+m]} (${titleCase(region)})`;
    els.pestList.innerHTML = '';
    if (!list.length){
      const li = document.createElement('li');
      li.textContent = 'No major alerts this month.';
      els.pestList.appendChild(li);
    }else{
      list.forEach(t=>{
        const li=document.createElement('li'); li.textContent=t; els.pestList.appendChild(li);
      });
    }
    els.pestBox.hidden=false;
  }

  function titleCase(s){ return s ? s[0].toUpperCase()+s.slice(1) : s; }

  let regionData = null;

  async function refresh(){
    const region = els.region.value || 'scotland';
    if (!regionData || regionData.region !== region){
      els.status.textContent = 'Loading…';
      const loaded = await loadRegion(region);
      regionData = { ...loaded, region };
      renderPest(region, loaded.pest);
    }
    renderTable(regionData);
  }

  ['change','keyup'].forEach(ev=>{
    els.region.addEventListener('change', refresh);
    els.cat.addEventListener('change', refresh);
    els.monthOnly.addEventListener('change', refresh);
    els.search.addEventListener('keyup', () => { window.clearTimeout(els._t); els._t=setTimeout(refresh,150); });
  });

  // init
  refresh();
})();
