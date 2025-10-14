// /js/nav-loader.js  — single-source universal header (idempotent)

// 0) If a proper header already exists, stop.
if (document.querySelector('#site-header .pp-site-header')) {
  // Already injected on this page — nothing to do.
  // (Still wire the burger once, just in case this file loads before HTML is parsed)
  queueMicrotask(wireMenu);
} else {
  // 1) Remove any stray legacy headers that might have been left in the DOM
  document.querySelectorAll('.pp-site-header').forEach((node) => {
    if (!node.closest('#site-header')) node.remove();
  });

  // 2) Inject header only into #site-header
  const mount = document.getElementById('site-header');
  if (mount) {
    mount.innerHTML = `
      <div class="pp-site-header" role="banner">
        <div class="pp-header-bar">
          <a class="pp-brand" href="/index.html">
            <img class="pp-logo" src="/img/patchandpot-logo.png" alt="Patch &amp; Pot">
            <span class="pp-title">Patch &amp; Pot</span>
          </a>
          <button class="pp-burger" id="ppBurger" aria-label="Menu" aria-expanded="false" aria-controls="ppNav">
            <span></span><span></span><span></span>
          </button>
          <nav class="pp-nav" id="ppNav" aria-label="Primary">
            <a href="/index.html">Home</a>
            <a href="/growing.html">Growing</a>
            <a href="/recipes.html">Recipes</a>
            <a href="/exercise.html">Exercise</a>
            <a href="/wellbeing.html">Wellbeing</a>
            <a href="/guides.html">Guides</a>
            <a href="/ideas.html">Ideas</a>
            <a href="/seasonal.html">Seasonal</a>
            <a href="/contact.html">Contact</a>
          </nav>
        </div>
      </div>
    `;
  }
  // 3) Wire interactions once the DOM fragment exists
  queueMicrotask(wireMenu);
}

// ---- helpers ----
function wireMenu() {
  const root = document.querySelector('#site-header .pp-site-header');
  const btn  = document.getElementById('ppBurger');
  const nav  = document.getElementById('ppNav');

  if (!root || !btn || !nav) return;

  // Prevent double–binding
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', () => {
    const open = root.classList.toggle('pp-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      root.classList.remove('pp-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      root.classList.remove('pp-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }, { passive: true });
}
