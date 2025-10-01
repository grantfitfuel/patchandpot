<script>
/* === HTML partial include loader ===
   Usage in pages: <div data-include="partials/header.html"></div>
*/
(function(){
  function include(el){
    const url = el.getAttribute('data-include');
    if(!url) return;
    fetch(url, {cache:'no-store'})
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(html => {
        el.outerHTML = html;   // replace placeholder with the partial
        wireHeader();          // after header exists, wire menu + active link
      })
      .catch(()=>{ el.outerHTML = '<!-- include failed: '+url+' -->'; });
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('[data-include]').forEach(include);
  });
})();

/* === Header behaviour (hamburger only on phones) === */
function wireHeader(){
  const header = document.getElementById('siteHeader');
  if(!header) return;

  // Active link highlight
  const path = location.pathname.split('/').pop() || 'index.html';
  header.querySelectorAll('.nav a').forEach(a=>{
    if(a.getAttribute('href') === path) a.setAttribute('aria-current','page');
  });

  // Hamburger toggle (hidden by CSS above breakpoint)
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
