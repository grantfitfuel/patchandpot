// /sites/js/header-loader.js
(function () {
  // Mounts
  const headMount = document.getElementById("site-header");
  const footMount = document.getElementById("site-footer");

  // Helper to fetch and insert a partial
  async function inject(mount, url) {
    if (!mount) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      mount.innerHTML = await r.text();
    } catch {
      mount.innerHTML = '<div style="padding:10px;background:#222;color:#fff">Failed to load</div>';
    }
  }

  // Inject both
  Promise.all([
    inject(headMount, "/partials/header.html"),
    inject(footMount, "/partials/footer.html"),
  ]).then(() => {
    // After header exists, wire up behaviour
    if (!headMount) return;
    const btn = headMount.querySelector(".nav-toggle");
    const nav = headMount.querySelector("#primary-nav");

    if (btn && nav) {
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!expanded));
        nav.classList.toggle("open", !expanded);
        document.body.classList.toggle("nav-open", !expanded);
      });
    }

    // Current-page highlight that respects folder index.html
    const normalise = (p) =>
      p
        .replace(/index\.html$/i, "")
        .replace(/\/+$/, "/")
        || "/";

    const path = normalise(location.pathname);

    headMount.querySelectorAll(".nav a").forEach((a) => {
      let href = a.getAttribute("href") || "";
      href = normalise(href);

      const isHome =
        href === "/index.html" && (path === "/" || path === "/index.html/");
      const isMatch = href === path || isHome;

      if (isMatch) a.classList.add("current");
    });

    // Footer year
    if (footMount) {
      const y = footMount.querySelector("#year");
      if (y) y.textContent = new Date().getFullYear();
    }
  });
})();
