// Patch & Pot — Header loader (SINGLETON, absolute path)
(function(){
  if (window.__PP_HEADER_LOADED) return; // guard: only once per page
  const slot = document.getElementById('site-header') || document.getElementById('header');
  if (!slot) return;

  const URL = '/sites/partials/header.html'; // absolute path so it works from anywhere

  (async () => {
    try{
      const r = await fetch(URL + '?v=hdr-final', {cache:'no-store'});
      if (!r.ok) throw 0;
      slot.innerHTML = await r.text();
      window.__PP_HEADER_LOADED = true;
      slot.setAttribute('data-pp-header','installed');
    }catch(e){
      slot.innerHTML = `<header style="padding:10px 16px;border-bottom:1px solid #1f2630;background:#0b0f14;color:#fff">
        Patch &amp; Pot — header failed to load (${URL})
      </header>`;
      console.warn('[header-loader] fetch failed:', URL);
    }
  })();
})();
