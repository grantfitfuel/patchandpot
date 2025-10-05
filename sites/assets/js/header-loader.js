// Patch & Pot — Header loader (LOCKED)
(function(){
  const SLOT_SEL = '#site-header,#header';
  const CANDIDATES = [
    '/sites/partials/header.html',
    'sites/partials/header.html'
  ];

  function ready(fn){document.readyState!=='loading'?fn():document.addEventListener('DOMContentLoaded',fn);}

  ready(async () => {
    const slot = document.querySelector(SLOT_SEL);
    if (!slot) return;

    for (const url of CANDIDATES){
      try{
        const r = await fetch(url+'?v=lock2',{cache:'no-store'});
        if (r.ok){ slot.innerHTML = await r.text(); return; }
      }catch(_){}
    }
    // Minimal safety header if partial is unreachable
    slot.innerHTML = `
      <header style="padding:10px 16px;border-bottom:1px solid #1f2630;background:#0b0f14">
        <a href="/" style="color:#fff;text-decoration:none;font-weight:700">Patch &amp; Pot</a>
      </header>`;
  });
})();
