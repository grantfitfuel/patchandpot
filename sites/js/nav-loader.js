document.addEventListener('DOMContentLoaded', () => {
  const slot = document.getElementById('site-nav');
  if (!slot) return;

  fetch('/includes/nav.html', { cache: 'no-store' })
    .then(r => r.text())
    .then(html => {
      slot.innerHTML = html;

      const root = document.querySelector('.pp-site-header');
      const btn  = document.getElementById('ppBurger');
      const nav  = document.getElementById('ppNav');

      if (root && btn && nav) {
        btn.addEventListener('click', () => {
          const open = root.classList.toggle('pp-open');
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        nav.addEventListener('click', e => {
          if (e.target.closest('a')) {
            root.classList.remove('pp-open');
            btn.setAttribute('aria-expanded','false');
          }
        });
        window.addEventListener('resize', () => {
          if (window.innerWidth > 900) {
            root.classList.remove('pp-open');
            btn.setAttribute('aria-expanded','false');
          }
        });
      }
    });
});
