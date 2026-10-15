/* Shared UI: smooth scroll, live clock, menu overlay, contact dialog. Everything degrades to plain links. */
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

/* ---------- live clock (Bengaluru) ---------- */
const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
function tick() {
  const t = fmt.format(new Date()).replace(" ", " ").toLowerCase() + " IST";
  $$("[data-clock]").forEach((n) => { n.textContent = t; });
}
tick();
setInterval(tick, 10000);

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
