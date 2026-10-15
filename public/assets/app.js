/* Shared UI: smooth scroll, header state, footer gradient, menu overlay, contact dialog. Everything degrades to plain links. */
const d = document;
const html = d.documentElement;
const $ = (s, r = d) => r.querySelector(s);
const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const HELLO = "hello@devshipit.com";

/* ---------- scroll lock + smooth scroll ---------- */
let lenis = null;
let locks = 0;
function lock() { locks++; html.classList.add("lock"); if (lenis) lenis.stop(); }
function unlock() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) { html.classList.remove("lock"); if (lenis && !html.classList.contains("intro")) lenis.start(); }
}

if (!reduced) {
  import("/assets/vendor/lenis.mjs").then(({ default: Lenis }) => {
    lenis = new Lenis({ smoothWheel: true, lerp: 0.1 });
    if (html.classList.contains("intro") || locks) lenis.stop();
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    d.addEventListener("intro-end", () => { if (!locks) lenis.start(); }, { once: true });
  }).catch(() => {});
}

function scrollToEl(el) {
  if (lenis) lenis.scrollTo(el, { offset: -44, duration: 1.2 });
  else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

/* ---------- header gains a glass backdrop once the page moves ---------- */
const sentinel = $("#top-sentinel");
const gnav = $(".gnav");
if (sentinel && gnav && "IntersectionObserver" in window) {
  new IntersectionObserver((en) => gnav.classList.toggle("scrolled", !en[0].isIntersecting)).observe(sentinel);
}

/* ---------- footer: pointer-reactive gradient (WebGL, about a kilobyte of shader) ---------- */
const fcta = $(".foot-cta");
const fcv = fcta && $("canvas", fcta);
if (fcv) {
  const gl = fcv.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: true });
  if (gl) {
    const vs = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    const fs = `precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv*vec2(r.x/r.y,1.)*1.6;
float d=distance(uv,m);float w=fb(q+vec2(t*.05,-t*.04)+fb(q*1.3-t*.03)*1.4);
float g=smoothstep(.2,1.05,w+.42*(1.-smoothstep(0.,.65,d))+.28*uv.x*(1.-uv.y));
vec3 c=mix(vec3(.055,.051,.063),vec3(.08,.19,.5),g);c=mix(c,vec3(.45,.6,.95),pow(g,6.)*.35);
gl_FragColor=vec4(c,1.);}`;
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      gl.useProgram(pr);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const uR = gl.getUniformLocation(pr, "r"), uT = gl.getUniformLocation(pr, "t"), uM = gl.getUniformLocation(pr, "m");
      const target = [0.8, 0.25], mouse = [0.8, 0.25];
      let visible = false, raf = 0, t0 = performance.now();
      const fit = () => {
        const dpr = Math.min(devicePixelRatio || 1, 1.5);
        const r = fcta.getBoundingClientRect();
        fcv.width = Math.max(1, Math.round(r.width * dpr / 2));
        fcv.height = Math.max(1, Math.round(r.height * dpr / 2));
        gl.viewport(0, 0, fcv.width, fcv.height);
      };
      const draw = (now) => {
        mouse[0] += (target[0] - mouse[0]) * 0.05;
        mouse[1] += (target[1] - mouse[1]) * 0.05;
        gl.uniform2f(uR, fcv.width, fcv.height);
        gl.uniform1f(uT, reduced ? 4 : (now - t0) / 1000);
        gl.uniform2f(uM, mouse[0], mouse[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        fcv.classList.add("on");
        if (visible && !reduced) raf = requestAnimationFrame(draw);
      };
      fcta.addEventListener("pointermove", (e) => {
        const r = fcta.getBoundingClientRect();
        target[0] = (e.clientX - r.left) / r.width;
        target[1] = 1 - (e.clientY - r.top) / r.height;
      }, { passive: true });
      new ResizeObserver(() => { fit(); if (!visible || reduced) draw(performance.now()); }).observe(fcta);
      new IntersectionObserver((en) => {
        visible = en[0].isIntersecting;
        cancelAnimationFrame(raf);
        if (visible) raf = requestAnimationFrame(draw);
      }).observe(fcta);
    }
  }
}

/* ---------- dialogs ---------- */
function openDlg(dlg) {
  if (!dlg || dlg.open) return;
  lock();
  dlg.showModal();
  requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add("open")));
}
function closeDlg(dlg, cb) {
  if (!dlg || !dlg.open) { if (cb) cb(); return; }
  dlg.classList.remove("open");
  const done = () => { dlg.close(); unlock(); if (cb) cb(); };
  if (reduced) done(); else setTimeout(done, 300);
}
$$("dialog").forEach((dlg) => {
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeDlg(dlg); });
  dlg.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) { closeDlg(dlg); return; }
    if (dlg.classList.contains("modal")) {
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDlg(dlg);
    }
  });
});

const menu = $("#menu-dialog");
const menuBtn = $(".menu-btn");
if (menuBtn && menu) {
  menuBtn.addEventListener("click", () => { menuBtn.setAttribute("aria-expanded", "true"); openDlg(menu); });
  menu.addEventListener("close", () => { menuBtn.setAttribute("aria-expanded", "false"); menuBtn.focus(); });
}

/* ---------- contact dialog: composes an email, no backend ---------- */
const cd = $("#contact-dialog");
const form = $("#cd-form");
const done = $("#cd-done");
const formWrap = $("#cd-wrap");
const topicEl = $("#cd-topic");
let topic = "";

function openContact(t) {
  if (!cd) { location.href = "/contact/"; return; }
  topic = t || "";
  if (topicEl) {
    topicEl.classList.toggle("on", !!topic);
    const b = $("b", topicEl);
    if (b) b.textContent = topic;
  }
  formWrap.hidden = false;
  done.hidden = true;
  const go = () => openDlg(cd);
  if (menu && menu.open) closeDlg(menu, go); else go();
}

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const f = new FormData(form);
    const subject = "Project enquiry" + (topic ? ": " + topic : "");
    const body = `Hi Dev,\n\n${f.get("msg")}\n\nName: ${f.get("name")}\nEmail: ${f.get("email")}`;
    location.href = `mailto:${HELLO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    formWrap.hidden = true;
    done.hidden = false;
    form.reset();
  });
}
const copyBtn = $("#cd-copy");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(HELLO); copyBtn.textContent = "Copied"; }
    catch { copyBtn.textContent = HELLO; }
  });
}

/* ---------- click routing ---------- */
d.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const c = e.target.closest("[data-contact]");
  if (c && !location.pathname.startsWith("/contact")) {
    e.preventDefault();
    openContact(c.dataset.topic || "");
    return;
  }
  const a = e.target.closest("a[href]");
  if (!a) return;
  const u = new URL(a.href, location.href);
  if (u.origin === location.origin && u.pathname === location.pathname && u.hash.length > 1) {
    const t = d.getElementById(decodeURIComponent(u.hash.slice(1)));
    if (!t) return;
    e.preventDefault();
    const go = () => { scrollToEl(t); history.pushState(null, "", u.hash); };
    if (menu && menu.open) closeDlg(menu, go); else go();
  }
});
