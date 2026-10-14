/* Scroll reveal. Presentational only: content is fully visible without JS or with reduced motion. */
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  function init() {
    var els = document.querySelectorAll(".rv");
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
