(function () {
  var btn = document.querySelector('.site-header .menu-toggle');
  var nav = document.getElementById('primaryNav');
  if (!btn || !nav) return;

  btn.addEventListener('click', function () {
    var open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
})();
