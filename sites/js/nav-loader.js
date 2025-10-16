// Injects the site nav consistently everywhere
(function(){
  const nav = document.getElementById('ppNav');
  if(!nav){ return; }

  nav.innerHTML = `
    <nav class="pp-nav" role="navigation" aria-label="Main">
      <a href="/index.html">Home</a>
      <a href="/ideas.html">Ideas</a>
      <a href="/guides/index.html">Guides</a>
      <a href="/growing/index.html">Growing</a>
      <a href="/recipes.html">Recipes</a>
      <a href="/exercise.html">Exercise</a>
      <a href="/wellbeing.html">Wellbeing</a>
      <a href="/community.html">Community</a>
      <a href="/about.html">About</a>
      <a href="/contact.html">Contact</a>
    </nav>
  `;
})();
