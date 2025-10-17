(function(){
  // Mobile menu
  var btn = document.querySelector('.menu-toggle');
  var nav = document.getElementById('primaryNav');
  if(btn && nav){
    btn.addEventListener('click', function(){
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('open', !open);
    });
  }

  // If theme CSS loaded, it should set --pp-proof:1 on :root
  // (We also flip the class from default.html but this is a backup.)
  function cssApplied(){
    var val = getComputedStyle(document.documentElement).getPropertyValue('--pp-proof').trim();
    return val === '1';
  }
  if(cssApplied()){
    document.body.classList.remove('no-theme');
  }else{
    setTimeout(function(){
      if(cssApplied()) document.body.classList.remove('no-theme');
    }, 800);
  }
})();
