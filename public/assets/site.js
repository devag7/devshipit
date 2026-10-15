/* Runs in <head>, before first paint. Presentational only: content is fully visible without JS or with reduced motion. */
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  var reduce = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* Intro loader: home page, first visit per session, never with reduced motion. */
  var intro = false;
  try {
    intro = !reduce && location.pathname === "/" && !sessionStorage.getItem("ds-seen");
  } catch (e) {}
  if (intro) {
    d.classList.add("intro");
    setTimeout(function () { d.classList.remove("intro"); }, 5000); /* fail-safe */
  }

  /* Scroll reveal. */
  var started = false;
  function start() {
    if (started) return;
    started = true;
    var els = document.querySelectorAll(".rv, .split");
    if (!els.length) return;
    function showAll() { for (var i = 0; i < els.length; i++) els[i].classList.add("in"); }
    if (!("IntersectionObserver" in window)) { showAll(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    for (var i = 0; i < els.length; i++) io.observe(els[i]);
    setTimeout(showAll, 4000);
  }
  function init() {
    if (intro) {
      document.addEventListener("intro-end", start, { once: true });
      setTimeout(start, 4500); /* fail-safe */
    } else start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
