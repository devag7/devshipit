/* Home only: intro loader, blueprint to product cursor reveal, count-up numbers, card spotlight. */
const d = document;
const html = d.documentElement;
const $ = (s, r = d) => r.querySelector(s);
const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- intro loader: 000 to 100, then slide up ---------- */
const loader = $("#loader");
const FILL = 1300;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let introDone = false;
function endIntro() {
  if (introDone) return;
  introDone = true;
  html.classList.remove("intro");
  try { sessionStorage.setItem("ds-seen", "1"); } catch (e) {}
}
if (html.classList.contains("intro") && loader) {
  const bar = $("i", loader);
  const num = $("#ldn");
  const t0 = performance.now();
  const step = (now) => {
    const t = clamp((now - t0) / FILL, 0, 1);
    const p = Math.round(easeInOutCubic(t) * 100);
    bar.style.width = p + "%";
    num.textContent = String(p).padStart(3, "0");
    if (t < 1) { requestAnimationFrame(step); return; }
    setTimeout(() => {
      loader.classList.add("out");
      setTimeout(() => d.dispatchEvent(new Event("intro-end")), 420);
      setTimeout(endIntro, 900);
    }, 160);
  };
  requestAnimationFrame(step);
} else {
  endIntro();
  setTimeout(() => d.dispatchEvent(new Event("intro-end")), 0);
}

/* ---------- blueprint to product: pointer paints the shipped UI over the sketch ---------- */
const stage = $("#stage");
const cvs = stage && $("canvas", stage);
if (stage && cvs && !reduced) {
  const ctx = cvs.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const DECAY = 0.016;
  const cover = d.createElement("canvas");
  const brush = d.createElement("canvas");
  const cctx = cover.getContext("2d");
  const bctx = brush.getContext("2d");
  const img = new Image();
  let W = 0, H = 0, R = 0, ready = false;
  let pts = [], last = null, idle = 0, running = false, moved = false;

  function size() {
    const r = stage.getBoundingClientRect();
    W = cvs.width = Math.max(1, Math.round(r.width * dpr));
    H = cvs.height = Math.max(1, Math.round(r.height * dpr));
    R = Math.round(clamp(r.width * 0.11, 64, 150) * dpr);
    brush.width = brush.height = Math.ceil(R * 2);
    cover.width = W; cover.height = H;
    if (ready) {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      cctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
  }
  function stamp(x, y) {
    const dia = brush.width;
    bctx.globalCompositeOperation = "source-over";
    bctx.clearRect(0, 0, dia, dia);
    const g = bctx.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,.96)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, dia, dia);
    bctx.globalCompositeOperation = "source-in";
    bctx.drawImage(cover, x - R, y - R, dia, dia, 0, 0, dia, dia);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(brush, x - R, y - R);
  }
  function tick() {
    const drawing = pts.length > 0;
    if (drawing) idle = 0; else idle++;
    if (idle > 120) { ctx.clearRect(0, 0, W, H); running = false; return; }
    const fade = drawing ? DECAY : Math.min(DECAY + idle * 0.004, 0.5);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${fade})`;
    ctx.fillRect(0, 0, W, H);
    if (drawing) { for (const p of pts) stamp(p[0], p[1]); pts = []; }
    requestAnimationFrame(tick);
  }
  function kick() { if (!running && ready) { running = true; idle = 0; requestAnimationFrame(tick); } }
  function push(x, y) {
    if (last) {
      const dx = x - last[0], dy = y - last[1];
      const dist = Math.hypot(dx, dy);
      const step = Math.max(R * 0.3, 1);
      const n = Math.min(Math.ceil(dist / step), 60);
      for (let i = 1; i < n; i++) pts.push([last[0] + (dx * i) / n, last[1] + (dy * i) / n]);
    }
    pts.push([x, y]);
    last = [x, y];
    kick();
  }
  function onPointer(e) {
    const r = cvs.getBoundingClientRect();
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    if (x < -R || y < -R || x > W + R || y > H + R) { last = null; return; }
    if (!moved) { moved = true; stage.classList.add("used"); }
    push(x, y);
  }
  addEventListener("pointermove", onPointer, { passive: true });
  stage.addEventListener("pointerdown", onPointer, { passive: true });
  addEventListener("pointerup", () => { last = null; }, { passive: true });

  /* A short scripted sweep so nobody has to guess the effect exists. */
  let swept = false;
  function sweep() {
    if (swept || moved) return;
    swept = true;
    const D = 1700, t0 = performance.now();
    const f = (now) => {
      if (moved) return;
      const t = clamp((now - t0) / D, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      push(W * (0.08 + 0.84 * e), H * (0.5 + 0.3 * Math.sin(e * Math.PI * 2.4)));
      if (t < 1) requestAnimationFrame(f); else last = null;
    };
    requestAnimationFrame(f);
  }
  const startSweep = () => {
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { io.disconnect(); setTimeout(sweep, 500); }
    }, { threshold: 0.15 });
    io.observe(stage);
  };
  if (html.classList.contains("intro")) d.addEventListener("intro-end", startSweep, { once: true });
  else startSweep();

  img.onload = () => { ready = true; size(); };
  img.src = $(".real", stage).getAttribute("src");
  new ResizeObserver(size).observe(stage);
  size();
}

/* ---------- count-up, driven by scroll position ---------- */
const nums = $$(".num[data-to]");
if (nums.length) {
  const to = nums.map((n) => Number(n.dataset.to));
  let queued = false;
  const update = () => {
    queued = false;
    const vh = innerHeight;
    nums.forEach((n, i) => {
      const r = n.getBoundingClientRect();
      const start = vh;
      const end = vh / 2 - r.height / 2;
      const p = clamp((start - r.top) / (start - end), 0, 1);
      n.textContent = String(Math.round(p * to[i]));
    });
  };
  if (!reduced) {
    nums.forEach((n) => { n.textContent = "0"; });
    update();
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
  }
}

/* ---------- card spotlight follows the pointer ---------- */
if (!reduced && matchMedia("(hover: hover)").matches) {
  $$(".cell").forEach((c) => {
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    }, { passive: true });
  });
}
