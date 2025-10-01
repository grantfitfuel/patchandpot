<script>
/* -------- Include partials by data-include="partials/header.html" -------- */
(function(){
  function include(el){
    const url = el.getAttribute('data-include');
    if(!url) return;
    fetch(url, {cache:'no-store'})
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(html => { el.outerHTML = html; wireHeader(); })
      .catch(e => { el.outerHTML = '<!-- include failed: '+url+' ('+e+') -->'; });
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('[data-include]').forEach(include);
  });
})();

/* -------- Header behaviour: active link + hamburger (phones) -------- */
function wireHeader(){
  const header = document.getElementById('siteHeader');
  if(!header) return;

  // Active link highlight
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  header.querySelectorAll('.nav a').forEach(a=>{
    if(a.getAttribute('href').toLowerCase() === path){ a.setAttribute('aria-current','page'); }
  });

  // Hamburger
  const toggle = header.querySelector('.menu-toggle');
  const nav = header.querySelector('#primaryNav');

  function setExpanded(on){
    if(on){
      header.classList.add('menu-open');
      toggle.classList.add('menu-open');
      toggle.setAttribute('aria-expanded','true');
    } else {
      header.classList.remove('menu-open');
      toggle.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded','false');
    }
  }

  if(toggle){
    toggle.addEventListener('click', ()=> setExpanded(!header.classList.contains('menu-open')));
  }
  if(nav){
    nav.addEventListener('click', e => { if(e.target.tagName === 'A') setExpanded(false); });
  }
}
</script>
