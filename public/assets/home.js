/* Home only: intro loader, blueprint-to-product pointer reveal, count-up numbers, card spotlight. */
const d = document;
const html = d.documentElement;
const $ = (s, r = d) => r.querySelector(s);
const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fire = () => d.dispatchEvent(new Event("intro-end"));

/* ---------- intro loader: 000 to 100 over 1.3s (easeInOutCubic), then the panel slides up ---------- */
const loader = $("#loader");
const FILL = 1300;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let introOver = !html.classList.contains("intro");
function endIntro() {
  html.classList.remove("intro");
  try { sessionStorage.setItem("ds-seen", "1"); } catch (e) {}
}
if (!introOver && loader) {
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
      setTimeout(fire, 380);
      setTimeout(() => { endIntro(); introOver = true; }, 920);
    }, 140);
  };
  requestAnimationFrame(step);
} else {
  endIntro();
  setTimeout(fire, 0);
}

/* ---------- hero: the pointer paints the shipped UI over its blueprint ---------- */
const panel = $(".hero-panel");
const cvs = panel && $(".hero-media canvas", panel);
if (panel && cvs && !reduced) {
  const ctx = cvs.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const DECAY = 0.016;
  const cover = d.createElement("canvas");
  const brush = d.createElement("canvas");
  const cctx = cover.getContext("2d");
  const bctx = brush.getContext("2d");
  const img = new Image();
  const base = $(".hero-media .real", panel);
  let W = 0, H = 0, R = 0, ready = false;
  let pts = [], last = null, idle = 0, running = false, userAt = -1e9, autos = 0;

  /* object-fit: cover with the same object-position as the <img>, so both layers line up exactly */
  function size() {
    const r = panel.getBoundingClientRect();
    W = cvs.width = Math.max(1, Math.round(r.width * dpr));
    H = cvs.height = Math.max(1, Math.round(r.height * dpr));
    R = Math.round(clamp(r.width * 0.1, 70, 143) * dpr);
    brush.width = brush.height = Math.ceil(R * 2);
    cover.width = W; cover.height = H;
    if (!ready) return;
    const pos = getComputedStyle(base).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const px = Number.isFinite(pos[0]) ? pos[0] : 0.5, py = Number.isFinite(pos[1]) ? pos[1] : 0.5;
    cctx.clearRect(0, 0, W, H);
    cctx.drawImage(img, (W - dw) * px, (H - dh) * py, dw, dh);
  }
  function stamp(x, y) {
    const dia = brush.width;
    bctx.globalCompositeOperation = "source-over";
    bctx.clearRect(0, 0, dia, dia);
    const g = bctx.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.55, "rgba(255,255,255,.82)");
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
      const n = Math.min(Math.ceil(Math.hypot(dx, dy) / Math.max(R * 0.3, 1)), 60);
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
    userAt = performance.now();
    push(x, y);
  }
  addEventListener("pointermove", onPointer, { passive: true });
  panel.addEventListener("pointerdown", onPointer, { passive: true });
  addEventListener("pointerup", () => { last = null; }, { passive: true });

  /* Scripted sweeps teach the effect: one after the intro, then up to two more while nobody touches it. */
  let inView = false;
  function sweep() {
    if (!inView || performance.now() - userAt < 4000) return;
    autos++;
    const D = 1900, t0 = performance.now(), dir = autos % 2 ? 1 : -1, yb = 0.32 + Math.random() * 0.25;
    last = null;
    const f = (now) => {
      if (performance.now() - userAt < 300) { last = null; return; }
      const t = clamp((now - t0) / D, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const xr = dir > 0 ? 0.4 + 0.55 * e : 0.95 - 0.55 * e;
      push(W * xr, H * (yb + 0.16 * Math.sin(e * Math.PI * 2.2)));
      if (t < 1) requestAnimationFrame(f); else last = null;
    };
    requestAnimationFrame(f);
  }
  const startSweeps = () => {
    new IntersectionObserver((en) => { inView = en[0].isIntersecting; }, { threshold: 0.4 }).observe(panel);
    setTimeout(sweep, 600);
    const iv = setInterval(() => { if (autos >= 3) { clearInterval(iv); return; } sweep(); }, 7000);
  };
  if (introOver) startSweeps(); else d.addEventListener("intro-end", startSweeps, { once: true });

  img.onload = () => { ready = true; size(); };
  img.src = base.currentSrc || base.src;
  new ResizeObserver(size).observe(panel);
  size();
}

/* ---------- numbers count up once, when the panel comes into view ---------- */
const nums = $$(".num[data-to]");
if (nums.length && !reduced && "IntersectionObserver" in window) {
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  nums.forEach((n) => { n.textContent = "0"; });
  const io = new IntersectionObserver((en) => {
    en.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const n = e.target, to = Number(n.dataset.to), D = 1400, t0 = performance.now();
      const f = (now) => {
        const t = clamp((now - t0) / D, 0, 1);
        n.textContent = String(Math.round(easeOut(t) * to));
        if (t < 1) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
  }, { threshold: 0.6 });
  nums.forEach((n) => io.observe(n));
}

/* ---------- work cards: soft light follows the pointer ---------- */
if (!reduced && matchMedia("(hover: hover)").matches) {
  $$(".wcard").forEach((c) => {
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    }, { passive: true });
  });
}
