<script>
(function(){
  const btn = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  if(!btn || !nav) return;
  btn.addEventListener('click', ()=>{
    const open = nav.getAttribute('aria-expanded') === 'true';
    nav.setAttribute('aria-expanded', open ? 'false' : 'true');
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
  });
})();
</script>
