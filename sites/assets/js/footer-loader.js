// Patch & Pot — Footer loader (LOCKED)
(function(){
  const SLOT_IDS = ['site-footer','footer','pp-footer']; // accept multiple ids
  const PARTIAL  = '/sites/partials/footer.html';

  function ready(fn){document.readyState!=='loading'?fn():document.addEventListener('DOMContentLoaded',fn);}

  ready(async () => {
    const slot = document.querySelector(SLOT_IDS.map(id=>`#${id}`).join(','));
    if (!slot) return;
    try{
      const res = await fetch(PARTIAL+'?v=lock2',{cache:'no-store'});
      if(!res.ok) throw 0;
      slot.innerHTML = await res.text();
    }catch{
      slot.innerHTML = `
        <footer class="pp-footer"><div class="pp-footer__text">© 2025 Patch &amp; Pot | Grant Cameron Anthony</div></footer>
      `;
    }
  });
})();
