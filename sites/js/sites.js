// Mobile nav toggle
(function(){
  var btn = document.getElementById('menuToggle');
  var nav = document.getElementById('primaryNav');
  if(!btn || !nav) return;
  btn.addEventListener('click', function(){
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();
