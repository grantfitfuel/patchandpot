(async () => {
  try {
    const depth = window.location.pathname.split("/").filter(Boolean).length;
    const prefix = depth > 1 ? "../" : "";
    const res = await fetch(prefix + "includes/nav.html");
    const html = await res.text();
    const mount = document.getElementById("site-nav");
    if (!mount) return;
    mount.innerHTML = html;

    // Fix relative links when inside subfolders
    if (depth > 1) {
      mount.querySelectorAll("a[href]").forEach(a => {
        const href = a.getAttribute("href");
        if (!/^https?:\/\//.test(href) && !href.startsWith("../")) {
          a.setAttribute("href", "../" + href);
        }
      });
    }

    // Optional: highlight current page
    const here = location.pathname.replace(/\/index\.html$/, "/");
    mount.querySelectorAll("a").forEach(a => {
      const url = new URL(a.href);
      const path = url.pathname.replace(/\/index\.html$/, "/");
      if (path === here) a.setAttribute("aria-current", "page");
    });
  } catch (e) {
    console.error("Nav load failed", e);
  }
})();
