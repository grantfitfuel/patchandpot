// Patch & Pot — Footer loader (SINGLETON, absolute path)
(function(){
  if (window.__PP_FOOTER_LOADED) return; // guard
  const slot = document.getElementById('site-footer') || document.getElementById('footer');
  if (!slot) return;

  const URL = '/sites/partials/footer.html';

  (async () => {
    try{
      const r = await fetch(URL + '?v=ftr-final', {cache:'no-store'});
      if (!r.ok) throw 0;
      slot.innerHTML = await r.text();
      window.__PP_FOOTER_LOADED = true;
      slot.setAttribute('data-pp-footer','installed');
    }catch(e){
      slot.innerHTML = `<footer style="padding:20px 10px;border-top:1px solid #1f2630;background:#0b0f14;color:#e6e6ea;text-align:center">
        © 2025 Patch &amp; Pot | Created by Grant Cameron Anthony
      </footer>`;
      console.warn('[footer-loader] fetch failed:', URL);
    }
  })();
})();
