/* =========================================================
   Patch & Pot – Universal Nav Loader
   - Inserts ONE consistent header on every page
   - De-dupes if already initialised
   - Hides legacy/inline nav fragments that leaked into content
   Version: stable-2025-10-14
   ========================================================= */
(function(){
  if (window.__PP_NAV_READY__) return;
  window.__PP_NAV_READY__ = true;

  // Determine prefix (root vs subfolders)
  // We assume top-level pages live at site root and sub-pages may be in folders.
  // This tries to find root by counting slashes after domain.
  const path = location.pathname.replace(/^\//,'');
  const depth = path === '' ? 0 : (path.split('/').length - 1);
  const up = depth ? '../'.repeat(depth) : '';

  // Build nav HTML (links point correctly from any depth)
  const links = [
    ['Home',            `${up}index.html`],
    ['Growing',         `${up}growing/index.html`],
    ['Recipes',         `${up}recipes.html`],
    ['Exercise',        `${up}exercise.html`],
    ['Wellbeing',       `${up}wellbeing.html`],
    ['Guides',          `${up}guides/index.html`],
    ['Ideas',           `${up}ideas.html`],
    ['Seasonal',        `${up}seasonal.html`],
    ['Contact',         `${up}contact.html`],
  ];

  const current = location.pathname.split('/').pop() || 'index.html';

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <div class="bar">
      <a class="brand" href="${up}index.html">
        <img class="logo" src="${up}img/patchandpot-logo.png" alt="Patch & Pot logo" onerror="this.style.display='none'">
        <span class="title">Patch &amp; Pot</span>
      </a>

      <button class="burger" id="ppBurger" aria-label="Menu" aria-expanded="false" aria-controls="ppNav">
        <div class="bars"><span></span><span></span><span></span></div>
      </button>

      <nav class="site-nav" id="ppNav" aria-label="Primary">
        ${links.map(([t,href])=>{
          const isCurrent = current && href.endsWith(current);
          return `<a href="${href}" ${isCurrent ? 'aria-current="page"' : ''}>${t}</a>`;
        }).join('')}
      </nav>
    </div>
  `;

  // Insert at very top of body
  document.body.prepend(header);

  // Burger behaviour
  const burger = document.getElementById('ppBurger');
  burger.addEventListener('click', ()=>{
    const open = header.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Close menu when link tapped (mobile)
  document.getElementById('ppNav').addEventListener('click', e=>{
    if (e.target.closest('a')) { header.classList.remove('open'); burger.setAttribute('aria-expanded','false'); }
  });

  // Remove/hide legacy nav fragments that may have been left in pages
  // Strategy: find any blocks near the top of the document that contain
  // the exact sequence of our nav text but are NOT inside .site-header.
  const textMatch = ['Home','Growing','Recipes','Exercise','Wellbeing','Guides','Ideas','Seasonal','Contact'];
  const candidates = Array.from(document.querySelectorAll('body *'))
    .filter(el => {
      if (el.closest('.site-header')) return false;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
      const txt = (el.textContent || '').replace(/\s+/g,' ').trim();
      let hits = 0; textMatch.forEach(t => { if (txt.includes(t)) hits++; });
      return hits >= 5 && el.getBoundingClientRect().top < window.innerHeight; // likely the stray inline nav
    });

  candidates.forEach(el => { el.style.display = 'none'; el.classList.add('legacy-header'); });

})();
