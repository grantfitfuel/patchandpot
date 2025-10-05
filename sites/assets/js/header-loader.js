// Patch & Pot — Header loader (robust + noisy if it fails)
(function(){
  const SLOT = document.querySelector('#site-header, #header');
  if (!SLOT) return;

  const CANDIDATES = [
    '/sites/partials/header.html',   // absolute (works from anywhere)
    'sites/partials/header.html',    // relative from domain root
    './partials/header.html'         // relative from /sites/
  ];

  (async () => {
    for (const url of CANDIDATES) {
      try {
        const res = await fetch(url + '?v=hdr3', { cache: 'no-store' });
        if (res.ok) {
          SLOT.innerHTML = await res.text();
          return;
        }
      } catch (_) {}
    }
    // If we’re here, it failed – show a visible warning so you know
    SLOT.innerHTML = `
      <header style="padding:10px 16px;border-bottom:1px solid #1f2630;background:#0b0f14;color:#fff">
        Patch &amp; Pot (header partial NOT found – fix loader path)
      </header>`;
    console.warn('[header-loader] Could not fetch /sites/partials/header.html');
  })();
})();
