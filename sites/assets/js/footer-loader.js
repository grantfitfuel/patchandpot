// Patch & Pot — Footer loader (LOCKED)
(function(){
  const SLOT_ID = 'site-footer';
  const PARTIAL = '/sites/partials/footer.html';  // adjust if your site root is different

  function ready(fn){ document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }

  ready(async () => {
    const slot = document.getElementById(SLOT_ID);
    if (!slot) return;

    try{
      const res = await fetch(PARTIAL + '?v=lock1', {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      slot.innerHTML = await res.text();
    }catch(_){
      // Fail-safe: minimal text if partial can’t load
      slot.innerHTML = `
        <footer class="pp-footer" role="contentinfo">
          <div class="pp-footer__text">© 2025 Patch &amp; Pot | Grant Cameron Anthony</div>
        </footer>`;
    }
  });
})();
