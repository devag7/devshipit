#!/usr/bin/env python3
"""Generate the devshipit.com pages into ../public.

Legal and case-study copy is extracted verbatim from the original pages kept in site/source/.
Icons come from npm (see site/package.json); Markdown twins need the markdownify Python package.

    npm --prefix site ci
    pip install markdownify==1.2.3
    python3 site/build.py
"""
import html as H
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source")
OUT = os.path.join(os.path.dirname(HERE), "public")
NPM = os.path.join(HERE, "node_modules")

SITE = "https://devshipit.com"
HELLO = "hello@devshipit.com"      # freelance projects and general enquiries
JANTAHR = "jantahr@devshipit.com"  # JantaHR support, billing and legal pages only
OG = SITE + "/assets/img/og.png"


# ---------- icons: one external sprite, pages only reference symbols ----------
SYMBOLS = {}


def _use(sym_id, cls, label=None):
    c = f' class="{cls}"' if cls else ""
    if label:
        return f'<svg{c} role="img" aria-label="{H.escape(label)}"><use href="/assets/icons.svg#{sym_id}"/></svg>'
    return f'<svg{c} aria-hidden="true" focusable="false"><use href="/assets/icons.svg#{sym_id}"/></svg>'


def phos(name, cls="icon"):
    sid = f"ph-{name}"
    if sid not in SYMBOLS:
        t = open(f"{NPM}/@phosphor-icons/core/assets/regular/{name}.svg", encoding="utf-8").read()
        inner = re.search(r"<svg[^>]*>(.*)</svg>", t, re.S).group(1)
        inner = re.sub(r"<rect[^>]*/>", "", inner)
        SYMBOLS[sid] = f'<symbol id="{sid}" viewBox="0 0 256 256">{inner}</symbol>'
    return _use(sid, cls)


def brand(slug, label=None, cls=None, hidden=False):
    sid = f"si-{slug}"
    t = open(f"{NPM}/simple-icons/icons/{slug}.svg", encoding="utf-8").read()
    title = re.search(r"<title>(.*?)</title>", t).group(1)
    if sid not in SYMBOLS:
        d = re.search(r'<path d="(.*?)"', t, re.S).group(1)
        SYMBOLS[sid] = f'<symbol id="{sid}" viewBox="0 0 24 24"><path d="{d}"/></symbol>'
    return _use(sid, cls, None if hidden else (label or title))


# ---------- extraction ----------
def read(p):
    return open(f"{SRC}/{p}", encoding="utf-8").read()


def balanced(text, start_marker):
    i = text.index(start_marker)
    j = text.index(">", i) + 1
    depth, k = 1, j
    pat = re.compile(r"<(/?)div\b[^>]*>")
    for m in pat.finditer(text, j):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return text[j:m.start()]
    raise ValueError(start_marker)


def grab(text, pat, flags=re.S):
    m = re.search(pat, text, flags)
    return m.group(1).strip() if m else None


def parse(path):
    t = read(path)
    d = {
        "title": grab(t, r"<title>(.*?)</title>"),
        "desc": grab(t, r'<meta name="description" content="(.*?)"'),
        "h1": grab(t, r"<h1>(.*?)</h1>"),
        "updated": grab(t, r'<p class="updated">(.*?)</p>'),
        "lead": grab(t, r'<p class="lead">(.*?)</p>'),
    }
    back = re.search(r'<a class="back" href="(.*?)">(.*?)</a>', t, re.S)
    d["back"] = (back.group(1), re.sub(r"&larr;\s*", "", back.group(2)).strip())
    dl = grab(t, r'<dl class="meta">(.*?)</dl>')
    d["meta"] = re.findall(r"<div><dt>(.*?)</dt><dd>(.*?)</dd></div>", dl, re.S) if dl else []
    d["prose"] = balanced(t, '<div class="prose">').strip()
    d["next"] = []
    if '<div class="next">' in t:
        nx = balanced(t, '<div class="next">')
        for m in re.finditer(r'<a class="btn( primary)?" href="(.*?)"[^>]*>(.*?)</a>', nx):
            d["next"].append((m.group(2), m.group(3), bool(m.group(1))))
    return d


# ---------- shared chrome ----------
NAV = [("Work", "/work/", "work"), ("Services", "/services/", "services"), ("About", "/about/", "about"), ("Pricing", "/pricing/", "pricing")]
MENU = [("Work", "/work/"), ("Services", "/services/"), ("About", "/about/"), ("Pricing", "/pricing/"), ("Developers", "/developers/"), ("Contact", "/contact/")]
LASTMOD = "2026-10-16"
INDEXNOW_KEY = "65e5a2c9e4e9ca153a417f71ef59cc9d"


PAGES = []  # (path, title, description) for every public page, in sitemap order


def ldjson(*nodes):
    """One JSON-LD script holding every node in a single @graph."""
    g = [n for n in nodes if n]
    return '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@graph": g}, ensure_ascii=False, separators=(",", ":")) + "</script>\n"


def head(title, desc, path, extra="", noindex=False, ogtitle=None, ld=None):
    canon = SITE + path
    assert len(title) <= 70, f"title too long ({len(title)}): {title}"
    assert noindex or 50 <= len(desc) <= 170, f"description length {len(desc)}: {path}"
    if not noindex:
        PAGES.append((path, title, desc))
        extra = f'<link rel="alternate" type="text/markdown" href="{canon}index.md" title="This page as Markdown">\n' + extra
    if ld:
        extra = ldjson(*ld) + extra
    robots = '<meta name="robots" content="noindex">\n' if noindex else '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">\n'
    ot = H.escape(ogtitle or title)
    return f"""<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{robots}<link rel="canonical" href="{canon}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="service-desc" type="application/json" href="/openapi.json" title="DevShipIt API (OpenAPI 3.1)">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#060507">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DevShipIt">
<meta property="og:locale" content="en_IN">
<meta property="og:title" content="{ot}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{OG}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/assets/fonts/onest-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js"></script>
{extra}</head>
<body>
<a class="skip" href="#main">Skip to content</a>
"""


def split(text, tone=None):
    """Words rise out of a clip. `tone` is the trailing phrase set in the muted colour."""
    out = ['<span class="w"><span>%s</span></span>' % H.escape(w) for w in text.split()]
    if tone:
        out += ['<span class="w"><span class="tone">%s</span></span>' % H.escape(w) for w in tone.split()]
    return " ".join(out)


def btn(label, href, kind="", icon="arrow-up-right", attrs=""):
    cls = "btn arrow" + (" " + kind if kind else "")
    return f'<a class="{cls}" href="{href}"{attrs}>{label}<span class="badge">{phos(icon)}</span></a>'


def crumbs(*items):
    """items: (label, path) pairs ending with the current page. Returns (visible nav, BreadcrumbList node)."""
    trail = [("Home", "/")] + list(items)
    lis = []
    for i, (label, href) in enumerate(trail):
        last = i == len(trail) - 1
        lis.append(f'<li aria-current="page">{H.escape(label)}</li>' if last else f'<li><a href="{href}">{H.escape(label)}</a></li>')
    nav = f'<nav class="crumbs" aria-label="Breadcrumb"><ol>{"".join(lis)}</ol></nav>'
    node = {"@type": "BreadcrumbList", "@id": SITE + trail[-1][1] + "#breadcrumb", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": label, "item": SITE + href} for i, (label, href) in enumerate(trail)]}
    return nav, node


def gnav(active=None):
    cur = ' aria-current="page"'
    links = "".join('<a href="%s"%s>%s</a>' % (h, cur if (k and k == active) else "", l) for l, h, k in NAV)
    return f"""<div id="top-sentinel" aria-hidden="true"></div>
<header class="gnav"><div class="gnav-in">
  <a class="brand" href="/"><img src="/assets/img/logo.svg" width="1969" height="453" alt="DevShipIt home"></a>
  <nav aria-label="Primary"><span class="pill" aria-hidden="true"></span>{links}</nav>
  <div class="gnav-r">{btn("Contact", "/contact/", attrs=" data-contact" + (cur if active == "contact" else ""))}<button class="menu-btn" type="button" aria-haspopup="dialog" aria-controls="menu-dialog" aria-expanded="false">{phos("list")}Menu</button></div>
</div></header>
"""


def dialogs():
    lis = "".join(
        '<li><a href="%s"%s><i>0%d</i>%s</a></li>' % (h, " data-contact" if l == "Contact" else "", n + 1, l) for n, (l, h) in enumerate(MENU)
    )
    return f"""<dialog class="menu" id="menu-dialog" aria-label="Menu">
  <div class="menu-top"><a class="brand" href="/"><img src="/assets/img/logo.svg" width="1969" height="453" alt="DevShipIt home"></a><button class="close" type="button" data-close>{phos("x")}Close</button></div>
  <nav aria-label="Menu"><ul>{lis}</ul></nav>
  <div class="menu-bot"><a href="mailto:{HELLO}">{HELLO}</a><a href="https://github.com/devag7" rel="noopener">GitHub</a></div>
</dialog>
<dialog class="modal" id="contact-dialog" aria-labelledby="cd-title">
  <button class="x" type="button" data-close aria-label="Close">{phos("x")}</button>
  <div id="cd-wrap">
    <h2 id="cd-title">Tell me what you're building.</h2>
    <p class="sub">A few lines is plenty. I read every message myself.</p>
    <p class="topic" id="cd-topic">Topic: <b></b></p>
    <form id="cd-form">
      <label>Name<input name="name" required autocomplete="name"></label>
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Project<textarea name="msg" rows="4" required placeholder="What it is, when you need it, and a rough budget."></textarea></label>
      <div class="actions"><p class="note">Opens your email app with this message ready to send.</p><button class="btn" type="submit">Send message</button></div>
    </form>
  </div>
  <div class="done" id="cd-done" hidden>
    <h2>Your email app should open now.</h2>
    <p class="sub">If nothing happened, write to {HELLO} or copy the address.</p>
    <div class="btns"><button class="btn" type="button" id="cd-copy">Copy address</button><button class="btn ghost" type="button" data-close>Close</button></div>
  </div>
</dialog>
"""


def footer(extra_js=""):
    return f"""<footer class="foot">
  <div class="foot-cta">
    <div class="glow" aria-hidden="true"></div><canvas aria-hidden="true"></canvas>
    <div class="wrap foot-cta-in">
      <h2 class="display split">{split("Have a project in mind?", "Let's get to work.")}</h2>
      <div class="rv">{btn("Contact", "/contact/", kind="light", attrs=" data-contact")}</div>
    </div>
  </div>
  <div class="wrap">
    <div class="foot-cols">
      <div class="f-about"><a class="brand" href="/"><img src="/assets/img/logo.svg" width="1969" height="453" alt="DevShipIt home"></a><p>DevShipIt is where Dev Agarwalla, a freelance full-stack developer in Bengaluru, ships products, case studies and client work.</p></div>
      <div><h3>Work</h3><ul>
        <li><a href="/work/">All work</a></li>
        <li><a href="/work/jantahr/">JantaHR</a></li>
        <li><a href="/work/rentwise/">RentWise</a></li>
        <li><a href="/work/linkedin-mcp/">linkedin-mcp</a></li>
        <li><a href="/work/isp-evidence/">ISP Evidence</a></li>
      </ul></div>
      <div><h3>Company</h3><ul>
        <li><a href="/about/">About</a></li>
        <li><a href="/services/">Services</a></li>
        <li><a href="/pricing/">Pricing</a></li>
        <li><a href="/terms/">Terms</a></li>
        <li><a href="/privacy/">Privacy</a></li>
        <li><a href="/refunds/">Cancellation and refunds</a></li>
        <li><a href="/shipping/">Shipping and delivery</a></li>
        <li><a href="/contact/">Contact</a></li>
      </ul></div>
      <div><h3>Elsewhere</h3><ul>
        <li><a href="https://me.devshipit.com/">Dev Agarwalla</a></li>
        <li><a href="https://jantahr.devshipit.com" rel="noopener">JantaHR app</a></li>
        <li><a href="https://github.com/devag7" rel="noopener">GitHub</a></li>
        <li><a href="mailto:{HELLO}">Email</a></li>
        <li><a href="/developers/">Developers and agents</a></li>
        <li><a href="https://www.linkedin.com/in/devagarwalla" rel="noopener">LinkedIn</a></li>
      </ul></div>
    </div>
    <div class="foot-legal">
      <span>&copy; 2026 Dev Agarwalla, trading as DevShipIt. Bengaluru, Karnataka, India.</span>
      <span>Each live project runs on its own subdomain of devshipit.com.</span>
    </div>
  </div>
  <span class="mark-word" aria-hidden="true" data-word="devshipit"></span>
</footer>
{dialogs()}<script type="module" src="/assets/app.js"></script>
{extra_js}</body>
</html>
"""


def write(rel, content):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(content)


# ---------- home ----------
ME = "https://me.devshipit.com"
DEV_ID = ME + "/#person"  # the Person entity lives on me.devshipit.com; both sites share this @id
BIZ_ID = SITE + "/#business"
SITE_ID = SITE + "/#site"
LINKEDIN = "https://www.linkedin.com/in/devagarwalla"
GITHUB = "https://github.com/devag7"

PERSON_NODE = {
    "@type": "Person", "@id": DEV_ID, "name": "Dev Agarwalla", "alternateName": ["devag7", "DevAgarwalla"], "url": ME + "/",
    "disambiguatingDescription": "Software engineer in Bengaluru, India, known as devag7 on GitHub; builder of JantaHR and linkedin-mcp and founder of DevShipIt. Spelled Agarwalla, not Agarwal.",
    "description": "Full-stack and applied AI engineer in Bengaluru, India. Technical Delivery Associate at Falcon Reality, an AI product company. Builds and ships products under the name DevShipIt: JantaHR (HR and payroll software for Indian companies), RentWise (a rental platform for Bangalore), linkedin-mcp (a LinkedIn integration for AI assistants) and ISP Evidence (an Android app), and takes freelance web development projects.",
    "jobTitle": "Full-stack and applied AI engineer",
    "worksFor": {"@type": "Organization", "name": "Falcon Reality"},
    "affiliation": {"@type": "CollegeOrUniversity", "name": "BITS Pilani"},
    "knowsAbout": ["TypeScript", "React", "Next.js", "Node.js", "NestJS", "PostgreSQL", "MongoDB", "Supabase", "MERN stack", "Applied AI", "Model Context Protocol", "Android"],
    "address": {"@type": "PostalAddress", "addressLocality": "Bengaluru", "addressRegion": "Karnataka", "addressCountry": "IN"},
    "email": "mailto:" + HELLO, "image": SITE + "/icon-512.png",
    "brand": {"@id": BIZ_ID},
    "sameAs": [ME + "/", GITHUB, LINKEDIN, "https://x.com/DevAgarwalla", "https://www.npmjs.com/package/linkedin-mcp-tools"],
}
BUSINESS_NODE = {
    "@type": "ProfessionalService", "@id": BIZ_ID, "name": "DevShipIt", "alternateName": "DevShipIt by Dev Agarwalla",
    "url": SITE + "/", "logo": SITE + "/icon-512.png", "image": OG,
    "description": "DevShipIt is the trading name of Dev Agarwalla, a freelance full-stack developer in Bengaluru. It builds websites and web apps for property agents, agencies and small businesses, and sells JantaHR, HR and payroll software for Indian companies.",
    "founder": {"@id": DEV_ID}, "email": HELLO,
    "address": {"@type": "PostalAddress", "addressLocality": "Bengaluru", "addressRegion": "Karnataka", "addressCountry": "IN"},
    "areaServed": [{"@type": "City", "name": "Bengaluru"}, {"@type": "Country", "name": "India"}],
    "knowsAbout": ["Web development", "Real estate websites", "SaaS development", "Next.js", "MERN stack", "HR and payroll software"],
    "sameAs": [GITHUB, LINKEDIN],
}
WEBSITE_NODE = {
    "@type": "WebSite", "@id": SITE_ID, "name": "DevShipIt", "alternateName": ["devshipit.com", "Dev Ship It"], "url": SITE + "/",
    "description": "DevShipIt is the portfolio and product site of Dev Agarwalla, a freelance full-stack developer in Bengaluru: live products, case studies and freelance web development.",
    "inLanguage": "en-IN", "publisher": {"@id": BIZ_ID}, "author": {"@id": DEV_ID},
}


def faq_node(items, path):
    return {"@type": "FAQPage", "@id": SITE + path + "#faq", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a, _ in items]}


def faq_html(items):
    out = []
    for q, a, link in items:
        more = f' <a href="{link[1]}">{H.escape(link[0])}</a>.' if link else ""
        out.append(f'<details><summary>{H.escape(q)}{phos("plus")}</summary><div class="a"><p>{H.escape(a)}{more}</p></div></details>')
    return '<div class="faq">' + "".join(out) + "</div>"


STACK = [("typescript", "TypeScript"), ("react", "React"), ("nextdotjs", "Next.js"), ("nodedotjs", "Node.js"),
         ("nestjs", "NestJS"), ("express", "Express"), ("postgresql", "PostgreSQL"), ("mongodb", "MongoDB"),
         ("redis", "Redis"), ("supabase", "Supabase"), ("docker", "Docker"), ("socketdotio", "Socket.IO")]


ROWS = [
    ("Real estate websites", "Listing and search pages, and landing sites for property agents and agencies.", "Real estate website"),
    ("Full-stack web apps", "Next.js, Node and PostgreSQL apps with real-time updates and map search, like RentWise.", "Full-stack web app"),
    ("SaaS products", "Subscription products with plans, roles and compliance, like JantaHR.", "SaaS product"),
    ("Android apps and AI tools", "Background apps that export reports, and MCP servers that connect AI assistants to your tools.", "Android app or AI tool"),
]
STATS = [  # (value, suffix, label); every figure is on a case study or the LinkedIn profile
    ("4", "", "Products designed, built and shipped solo"),
    ("36", "", "Tools in the linkedin-mcp server, published on npm"),
    ("3", "", "MERN apps taken to production as a full-stack intern"),
    ("15", "k+", "People following my engineering posts on LinkedIn"),
]


# Every answer restates something published elsewhere on the site (terms, refunds, shipping, pricing, contact).
FAQ = {
    "cost": ("How much does a website or web app cost?", "Every project is priced by a written quote with the scope, price and delivery dates, agreed before any work starts, and you pay only the amounts in that quote. Write to hello@devshipit.com with what you need, when you need it and a rough budget.", ("See pricing", "/pricing/")),
    "time": ("How long does a project take?", "It depends on the scope. The delivery dates are written into your quote before any work starts, so you know them up front.", None),
    "own": ("Who owns the code and the website?", "You do. For freelance work, ownership of what is built passes to you once it is paid for, unless the quote says otherwise.", ("Read the terms", "/terms/")),
    "deliver": ("How is the work delivered?", "Online: a live website, a code repository or files, on the dates in your quote. Nothing is shipped physically.", ("Shipping and delivery policy", "/shipping/")),
    "cancel": ("What if I need to cancel a project?", "Cancellation and refund terms for a project, including any advance, are written into the quote you accept before work starts.", ("Cancellation and refund policy", "/refunds/")),
    "stack": ("What do you build with?", "TypeScript, React, Next.js, Node.js, NestJS, Express, PostgreSQL, MongoDB, Redis, Supabase, Docker and Socket.IO. Websites for property agents are usually built on the MERN stack.", None),
    "reply": ("How quickly do you reply?", "Within 2 working days, usually sooner. Email is the fastest way to reach me.", ("Contact", "/contact/")),
    "who": ("Who will build my project?", "Dev Agarwalla, personally. He is a Technical Delivery Associate at Falcon Reality, an AI product company, shipped three MERN applications to production as a full-stack intern at Cyber Secure India, and has built and shipped four products of his own.", ("About Dev", "/about/")),
    "brand": ("What is DevShipIt, and how is it related to JantaHR?", "DevShipIt is the trading name of Dev Agarwalla, a full-stack developer in Bengaluru, and this is its website. JantaHR is HR and payroll software for Indian companies that DevShipIt builds and sells at jantahr.devshipit.com.", ("JantaHR case study", "/work/jantahr/")),
}
HOME_FAQ = [FAQ[k] for k in ("brand", "who", "cost", "own", "time")]
SERVICES_FAQ = [FAQ[k] for k in ("who", "cost", "time", "own", "deliver", "cancel", "stack", "reply")]

SERVICES = [
    {"slug": "real-estate-websites", "name": "Real estate websites", "summary": "Listing and search pages, enquiry capture and landing sites for property agents and agencies, easy to keep up to date.", "example": SITE + "/work/rentwise/"},
    {"slug": "full-stack-web-apps", "name": "Full-stack web apps", "summary": "Next.js, Node and PostgreSQL apps with real-time updates and map search, like RentWise.", "example": SITE + "/work/rentwise/"},
    {"slug": "saas-products", "name": "SaaS products", "summary": "Subscription products with plans, roles and compliance, like JantaHR.", "example": SITE + "/work/jantahr/"},
    {"slug": "android-apps-and-ai-tools", "name": "Android apps and AI tools", "summary": "Background apps that export reports, and MCP servers that connect AI assistants to your tools.", "example": SITE + "/work/linkedin-mcp/"},
]
STEPS = [
    ("Tell me what you need", "Email a few lines: what it is, when you need it and a rough budget. I reply within 2 working days."),
    ("Get a written quote", "Scope, price and delivery dates, agreed before any work starts. You pay only the amounts in the quote."),
    ("I build it", "I design and build what the quote describes, from the database to the interface."),
    ("Delivered online", "A live website, a code repository or files, on the dates in your quote. Once paid for, it is yours."),
]


def home():
    h = head("DevShipIt | Dev Agarwalla, freelance full-stack developer in Bengaluru",
             "DevShipIt is Dev Agarwalla, a freelance full-stack developer in Bengaluru: websites and web apps for clients, JantaHR HR and payroll software, and case studies.",
             "/", ld=[PERSON_NODE, BUSINESS_NODE, WEBSITE_NODE, faq_node(HOME_FAQ, "/")],
             extra='<link rel="stylesheet" href="/assets/home.css">\n<link rel="preload" as="image" href="/assets/img/code-dim.webp" imagesrcset="/assets/img/code-dim-1200.webp 1200w, /assets/img/code-dim.webp 2400w" imagesizes="100vw" type="image/webp" fetchpriority="high">\n')
    b = '<div class="loader" id="loader" aria-hidden="true"><div class="ld-in"><div class="ld-mark"><img src="/assets/img/logo.svg" width="1969" height="453" alt="DevShipIt logo"></div><p class="ld-tag">Ideas in. Products out.</p></div><div class="ld-prog"><div class="ld-bar"><i></i></div><div class="ld-row"><span>Loading</span><b id="ldn">000</b></div></div></div>\n'
    b += gnav()
    b += f"""<main id="main">

<section class="hero" aria-labelledby="h-hero">
  <div class="hero-panel">
    <div class="hero-media" aria-hidden="true">
      <img class="real" src="/assets/img/code-lit.webp" srcset="/assets/img/code-lit-1200.webp 1200w, /assets/img/code-lit.webp 2400w" sizes="100vw" width="2400" height="1500" alt="Source code from a DevShipIt product in a code editor, lit" decoding="async">
      <img class="bp" src="/assets/img/code-dim.webp" srcset="/assets/img/code-dim-1200.webp 1200w, /assets/img/code-dim.webp 2400w" sizes="100vw" width="2400" height="1500" alt="Source code from a DevShipIt product in a code editor, dimmed" decoding="async" fetchpriority="high">
      <canvas></canvas>
    </div>
    <div class="hero-scrim"></div>
    <div class="hero-copy">
      <p class="chip-label rv">Full-stack and applied AI engineer, Bengaluru</p>
      <h1 id="h-hero" class="display split">{split("I build products", "and ship them.")}</h1>
      <p class="lead rv d1">I'm Dev Agarwalla. I build full-stack and AI products, and DevShipIt is where I ship them and take on freelance work. Most of it is live and open to look at.</p>
      <div class="btns rv d2">{btn("See work", "#work", icon="arrow-right")}<a class="btn ghost" href="/contact/" data-contact>Contact</a></div>
    </div>
  </div>
</section>

<section class="stack" aria-labelledby="h-stack">
  <div class="wrap stack-in rv">
    <h2 id="h-stack">Built with</h2>
    <ul>{''.join(f'<li>{brand(s, l)}</li>' for s, l in STACK)}</ul>
  </div>
</section>

<section class="about" id="about" aria-labelledby="h-about">
  <div class="wrap about-in">
    <ul class="about-side facts-list rv">
      <li>{phos("briefcase")}<span>Technical Delivery Associate at Falcon Reality, an AI product company</span></li>
      <li>{phos("rocket-launch")}<span>Four products designed, built and shipped solo</span></li>
      <li>{phos("storefront")}<span>Freelance websites and web apps for real estate teams</span></li>
    </ul>
    <div>
      <h2 id="h-about" class="sr-only">About</h2>
      <p class="statement split">{split("I learn fastest by building something people can use,", "so most of my work is shipped, deployed and open to look at.")}</p>
      <div class="about-foot rv">
        <a class="textlink" href="/about/">More about Dev {phos("arrow-right")}</a>
        <span class="muted">Find me online</span>
        <div class="socials"><a href="https://github.com/devag7" rel="noopener" aria-label="GitHub">{phos("github-logo")}</a><a href="{LINKEDIN}" rel="noopener" aria-label="LinkedIn">{phos("linkedin-logo")}</a><a href="mailto:{HELLO}" aria-label="Email {HELLO}">{phos("envelope-simple")}</a></div>
      </div>
    </div>
  </div>
</section>

<section class="band" aria-label="How I work: idea, build, ship">
  <div class="wrap"><ul>
    <li class="rv"><div class="b1">Idea</div></li>
    <li class="rv d1"><div class="b2">Build</div></li>
    <li class="rv d2"><div class="b3">{phos("arrow-right")}</div></li>
    <li class="rv d3"><div class="b4">Ship</div></li>
  </ul></div>
</section>

<section class="live" id="live" aria-labelledby="h-live">
  <div class="wrap">
    <div class="live-head">
      <h2 id="h-live" class="display-sm split">{split("JantaHR is live.", "HR and payroll for Indian companies.")}</h2>
      <p class="lead rv">PF, ESI, professional tax, LWF and TDS calculated every month, with filing-ready files and a compliance calendar. Open source under AGPL-3.0.</p>
    </div>
    <div class="live-stage rv">
      <img class="shot" src="/assets/img/jantahr-payroll.webp" width="1400" height="875" loading="lazy" decoding="async" alt="A JantaHR payroll run with gross pay, deductions, net pay and employer contributions">
      <div class="phone"><img src="/assets/img/jantahr-mobile.webp" width="520" height="1040" loading="lazy" decoding="async" alt="JantaHR employee home screen on a phone with attendance check-in and leave balance"></div>
    </div>
    <ul class="live-facts">
      <li class="rv"><b>Free</b><span>For up to 20 employees</span></li>
      <li class="rv d1"><b>&#8377;49 and &#8377;99</b><span>Standard from &#8377;49 per employee a month, Professional from &#8377;99 (billed yearly; minimum 10 seats)</span></li>
      <li class="rv d2"><b>14 days</b><span>Free trial, no card needed; cancel any time</span></li>
    </ul>
    <div class="btns rv">{btn("Visit JantaHR", "https://jantahr.devshipit.com", attrs=' rel="noopener"')}<a class="btn ghost" href="/work/jantahr/">Case study</a><a class="textlink" href="/pricing/">All prices {phos("arrow-right")}</a></div>
  </div>
</section>

<section class="work" id="work" aria-labelledby="h-work">
  <div class="wrap">
    <div class="work-head head-row"><h2 id="h-work" class="display-sm split">{split("Selected work")}</h2><a class="textlink rv" href="/work/">All work and case studies {phos("arrow-right")}</a></div>
    <div class="work-grid">
      <a class="wcard tall rv" href="/work/rentwise/">
        <div class="art art-rent" aria-hidden="true"></div>{brand("mapbox", cls="ghost", hidden=True)}<span class="spot" aria-hidden="true"></span>
        <div class="top"><div class="marks">{brand("nextdotjs", hidden=True)}{brand("postgresql", hidden=True)}</div><span class="arrow-badge" aria-hidden="true">{phos("arrow-up-right")}</span></div>
        <div>
          <p class="status">Live</p>
          <h3>RentWise</h3>
          <p>A rental platform for Bangalore with automated listing collection, real-time updates, map search and role-based access.</p>
          <ul class="tags"><li class="tag">Next.js</li><li class="tag">TypeScript</li><li class="tag">PostgreSQL</li><li class="tag">Socket.io</li></ul>
        </div>
      </a>
      <a class="wcard rv d1" href="/work/linkedin-mcp/">
        <div class="art art-mcp" aria-hidden="true"></div>{brand("nodedotjs", cls="ghost", hidden=True)}<span class="spot" aria-hidden="true"></span>
        <div class="top"><div class="marks">{brand("nodedotjs", hidden=True)}{brand("npm", hidden=True)}</div><span class="arrow-badge" aria-hidden="true">{phos("arrow-up-right")}</span></div>
        <div>
          <p class="status">On npm</p>
          <h3>linkedin-mcp</h3>
          <p>A 36-tool LinkedIn integration for AI assistants, with caching, rate limiting and retries.</p>
          <ul class="tags"><li class="tag">Node.js</li><li class="tag">MCP</li><li class="tag">npm</li></ul>
        </div>
      </a>
      <a class="wcard rv d2" href="/work/isp-evidence/">
        <div class="art art-isp" aria-hidden="true"></div>{brand("android", cls="ghost", hidden=True)}<span class="spot" aria-hidden="true"></span>
        <div class="top"><div class="marks">{brand("android", hidden=True)}{brand("googleplay", hidden=True)}</div><span class="arrow-badge" aria-hidden="true">{phos("arrow-up-right")}</span></div>
        <div>
          <p class="status">In testing</p>
          <h3>ISP Evidence</h3>
          <p>An Android app that logs connection drops, latency and jitter, then exports a PDF report you can attach to an ISP complaint.</p>
          <ul class="tags"><li class="tag">Android</li><li class="tag">Google Play</li></ul>
        </div>
      </a>
    </div>
  </div>
</section>

<section class="services" id="services" aria-labelledby="h-services">
  <div class="wrap">
    <div class="services-head head-row"><h2 id="h-services" class="display-sm split">{split("What I can build for you")}</h2><a class="textlink rv" href="/services/">Freelance services and how a project works {phos("arrow-right")}</a></div>
    <ul class="rows">
      {''.join(f'<li class="rv"><a class="row" href="/contact/" data-contact data-topic="{t}"><span class="n">0{i+1}</span><h3>{ti}</h3><p>{de}</p><span class="rbadge" aria-hidden="true">{phos("arrow-up-right")}</span></a></li>' for i, (ti, de, t) in enumerate(ROWS))}
    </ul>
  </div>
</section>

<section class="numbers" aria-labelledby="h-numbers">
  <div class="wrap"><div class="numbers-panel rv">
    <h2 id="h-numbers" class="display-sm split">{split("Proof in the work,", "not the words.")}</h2>
    <ul class="stats">
      {''.join(f'<li class="rv d{min(i,3)}"><span class="num" data-to="{n}" data-suffix="{x}">{n}{x}</span><p>{l}</p></li>' for i, (n, x, l) in enumerate(STATS))}
    </ul>
  </div></div>
</section>

<section class="qa" id="questions" aria-labelledby="h-qa">
  <div class="wrap">
    <div class="qa-head head-row"><h2 id="h-qa" class="display-sm split">{split("Questions")}</h2><a class="textlink rv" href="/services/#questions">More answers {phos("arrow-right")}</a></div>
    <div class="rv">{faq_html(HOME_FAQ)}</div>
  </div>
</section>

</main>
"""
    write("index.html", h + b + footer('<script type="module" src="/assets/home.js"></script>\n'))


# ---------- inner pages ----------
DOC_META = {
    "pricing": ("JantaHR and freelance pricing in rupees | DevShipIt",
                "JantaHR prices per employee in rupees (Free, Standard, Professional and Enterprise), and how DevShipIt quotes freelance web development projects."),
    "contact": ("Contact for freelance projects and enquiries | DevShipIt",
                "Email Dev Agarwalla at DevShipIt about a freelance website or web app in Bengaluru, or reach JantaHR support. Replies within 2 working days."),
}


def doc_page(slug, active=None, extra_meta_row=None):
    d = parse(f"{slug}/index.html")
    path = f"/{slug}/"
    title, desc = DOC_META.get(slug, (d["title"], d["desc"] or ""))
    nav, crumb = crumbs((re.sub(r"<[^>]+>", "", d["h1"]), path))
    h = head(title, desc, path, ld=[crumb])
    b = gnav(active)
    updated = f'<p class="updated">{d["updated"]}</p>' if d["updated"] else ""
    prose = d["prose"]
    meta = ""
    if d["meta"]:
        rows = list(d["meta"])
        if extra_meta_row:
            rows.insert(2, extra_meta_row)
        meta = '<div class="card meta-card"><dl class="meta">' + "".join(
            f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in rows) + "</dl></div>\n"
    b += f"""<main id="main">
<section class="page-head">
  <div class="wrap">
    {nav}
    <h1>{d['h1']}</h1>
    {updated}
  </div>
</section>
<section class="doc">
  <div class="wrap"><div class="doc-in">
{meta}    <div class="prose">
{prose}
    </div>
  </div></div>
</section>
</main>
"""
    write(f"{slug}/index.html", h + b + footer())


GALLERY = f"""<div class="gallery">
  <figure class="wide"><img src="/assets/img/jantahr-compliance.webp" width="1400" height="875" loading="lazy" decoding="async" alt="Compliance calendar listing salary, TDS, EPF, ESI and return deadlines with their status" class="shot"><figcaption>The compliance calendar lists each deadline with its status.</figcaption></figure>
  <figure><img src="/assets/img/jantahr-payroll.webp" width="1400" height="875" loading="lazy" decoding="async" alt="A payroll run with gross pay, deductions, net pay and employer contributions for each month" class="shot"><figcaption>A payroll run, with gross pay, deductions, net pay and employer contributions.</figcaption></figure>
  <figure class="phone-fig"><div class="phone"><img src="/assets/img/jantahr-mobile.webp" width="520" height="1040" loading="lazy" decoding="async" alt="Employee home screen on a phone with attendance check-in and leave balance"></div><figcaption>The employee home screen, with attendance check-in and leave balance.</figcaption></figure>
</div>
"""


CASE_TITLES = {
    "jantahr": "JantaHR case study: Indian HR and payroll SaaS | DevShipIt",
    "rentwise": "RentWise case study: Bangalore rental platform | DevShipIt",
    "linkedin-mcp": "linkedin-mcp case study: LinkedIn MCP server | DevShipIt",
    "isp-evidence": "ISP Evidence case study: Android network logger | DevShipIt",
}


def project_node(slug):
    """schema.org node for the product a case study describes. Prices come from the pricing page."""
    p = next(x for x in AGENT_PROJECTS if x["slug"] == slug)
    base = {"@id": f"{SITE}/work/{slug}/#product", "name": p["name"], "description": p["summary"],
            "author": {"@id": DEV_ID}, "publisher": {"@id": BIZ_ID}, "mainEntityOfPage": f"{SITE}/work/{slug}/"}
    if p.get("source"):
        base["sameAs"] = [p["source"]]
    if slug == "jantahr":
        offer = lambda name, price, d: {"@type": "Offer", "name": name, "price": price, "priceCurrency": "INR", "description": d, "url": SITE + "/pricing/"}
        return {"@type": "SoftwareApplication", **base, "url": p["url"], "applicationCategory": "BusinessApplication",
                "applicationSubCategory": "HR and payroll software", "operatingSystem": "Web",
                "license": "https://www.gnu.org/licenses/agpl-3.0.html", "countriesSupported": "IN",
                "offers": [
                    offer("Free", "0", "Up to 20 employees: core HR, leave and attendance"),
                    offer("Standard, billed monthly", "59", "Per employee a month; minimum 10 seats"),
                    offer("Standard, billed yearly", "49", "Per employee a month, billed yearly; minimum 10 seats"),
                    offer("Professional, billed monthly", "119", "Per employee a month; minimum 10 seats"),
                    offer("Professional, billed yearly", "99", "Per employee a month, billed yearly; minimum 10 seats"),
                ]}
    if slug == "rentwise":
        return {"@type": "WebApplication", **base, "applicationCategory": "LifestyleApplication", "operatingSystem": "Web"}
    if slug == "linkedin-mcp":
        return {"@type": "SoftwareApplication", **base, "url": p["url"], "applicationCategory": "DeveloperApplication",
                "operatingSystem": "Node.js", "isAccessibleForFree": True}
    return {"@type": "MobileApplication", **base, "applicationCategory": "UtilitiesApplication", "operatingSystem": "Android"}


def case_page(slug, gallery=""):
    d = parse(f"work/{slug}/index.html")
    path = f"/work/{slug}/"
    nav, crumb = crumbs(("Work", "/work/"), (d["h1"], path))
    h = head(CASE_TITLES[slug], d["desc"] or "", path, ld=[crumb, project_node(slug)], ogtitle=f"{d['h1']} case study | DevShipIt")
    b = gnav("work")
    btns = "".join(
        '<a class="btn%s" href="%s"%s>%s</a>' % (
            "" if prim else " ghost", href,
            "" if href.startswith("mailto:") else ' rel="noopener"', label)
        for href, label, prim in d["next"])
    meta = '<div class="card meta-card"><dl class="meta">' + "".join(
        f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in d["meta"]) + "</dl></div>"
    b += f"""<main id="main">
<section class="page-head">
  <div class="wrap">
    {nav}
    <h1>{d['h1']}</h1>
    <p class="lead">{d['lead']}</p>
    <div class="btns">{btns}</div>
  </div>
</section>
<section class="doc">
  <div class="wrap">
    {meta}
    {gallery}
    <div class="doc-in doc-prose"><div class="prose">
{d['prose']}
    </div></div>
  </div>
</section>
</main>
"""
    write(f"work/{slug}/index.html", h + b + footer())


API_ERRORS = [
    ("not_found", 404, "No endpoint, page or file at that path.", "List what exists with GET /api/v1/ or read /openapi.json."),
    ("project_not_found", 404, "No project with that slug.", "Call GET /api/v1/projects for the valid slugs."),
    ("page_not_found", 404, "No public page at that path.", "Call GET /api/v1/pages for the valid paths."),
    ("missing_parameter", 400, "A required query parameter is missing.", "Add it and retry, for example ?path=/pricing/."),
    ("invalid_parameter", 400, "A parameter has the wrong format.", "Check the format in the OpenAPI document."),
    ("method_not_allowed", 405, "The API is read-only.", "Use GET or HEAD."),
    ("not_acceptable", 406, "A page was asked for as JSON.", "Use /api/v1/page?path=..., or ask for text/html or text/markdown."),
    ("unavailable", 503, "The site data could not be loaded.", "Retry after the Retry-After header."),
]
API_ENDPOINTS = [
    ("/api/v1/", "getApiIndex", "API name, version and every endpoint"),
    ("/api/v1/profile", "getProfile", "Who Dev is, his experience and stack"),
    ("/api/v1/projects", "listProjects", "JantaHR, RentWise, linkedin-mcp and ISP Evidence"),
    ("/api/v1/projects/{slug}", "getProject", "One project, for example jantahr"),
    ("/api/v1/services", "listServices", "Freelance services"),
    ("/api/v1/faq", "listFaq", "Frequently asked questions with answers"),
    ("/api/v1/contact", "getContact", "Which email address to use"),
    ("/api/v1/pages", "listPages", "Every public page"),
    ("/api/v1/page?path=/pricing/", "getPage", "One page as Markdown"),
]


def developers():
    path = "/developers/"
    nav, crumb = crumbs(("Developers", path))
    api_node = {"@type": "WebAPI", "@id": SITE + "/api/v1#api", "name": "DevShipIt API",
                "description": "Read-only public JSON API with Dev Agarwalla's profile, projects, services, FAQ, contact details and every devshipit.com page as Markdown.",
                "url": SITE + "/api/v1", "documentation": SITE + "/developers/", "provider": {"@id": BIZ_ID},
                "termsOfService": SITE + "/terms/"}
    h = head("DevShipIt developer docs: API, OpenAPI, CLI and MCP server",
             "The DevShipIt public API with its OpenAPI 3.1 document, the devshipit command-line tool, the MCP server, llms.txt and Markdown for every page of devshipit.com.",
             path, ld=[crumb, api_node])
    b = gnav()
    rows = "".join(f'<tr><td><code>GET {H.escape(e)}</code></td><td><code>{o}</code></td><td>{d}</td></tr>' for e, o, d in API_ENDPOINTS)
    errs = "".join(f'<tr id="error-{c}"><td><code>{c}</code></td><td>{st}</td><td>{m}</td><td>{hint}</td></tr>' for c, st, m, hint in API_ERRORS)
    b += f"""<main id="main">
<section class="page-head">
  <div class="wrap">
    {nav}
    <h1>DevShipIt for developers and AI agents</h1>
    <p class="lead">A public JSON API with an OpenAPI 3.1 document, a command-line tool, an MCP server, llms.txt, and Markdown for every page. No sign-in, read-only.</p>
    <div class="btns"><a class="btn" href="/openapi.json">OpenAPI document</a><a class="btn ghost" href="/api/v1">Try the API</a></div>
  </div>
</section>
<section class="doc">
  <div class="wrap"><div class="doc-in"><div class="prose">
<h2 id="api">DevShipIt API</h2>
<p>A read-only JSON API at <code>https://devshipit.com/api/v1</code> with the same facts as the site. It needs no key, sends <code>Access-Control-Allow-Origin: *</code>, and is described by an OpenAPI 3.1 document at <a href="/openapi.json">/openapi.json</a>, where every operation has an <code>operationId</code>, typed parameters and response schemas. The API catalog is at <a href="/.well-known/api-catalog">/.well-known/api-catalog</a> (RFC 9727).</p>
<p><code>curl https://devshipit.com/api/v1/projects/jantahr</code></p>
<div class="table-wrap"><table><thead><tr><th>Endpoint</th><th>operationId</th><th>Returns</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>To use it as tools for a model with function calling, load the OpenAPI document: each <code>operationId</code> becomes a function name and its description says when to call it.</p>
<h2 id="errors">Errors</h2>
<p>Every error is RFC 9457 problem details, sent as <code>application/problem+json</code>, with three extra members: <code>code</code> (stable and machine-readable), <code>hint</code> (what to do next) and <code>docs</code>. The <code>type</code> URI of each error opens its row below. Clients that ask for JSON also get problem details for a missing page or file anywhere on the site.</p>
<p><code>{{"type": "https://devshipit.com/developers/#error-project_not_found", "title": "Project not found", "status": 404, "detail": "There is no project \"x\". Valid slugs: jantahr, rentwise, linkedin-mcp, isp-evidence.", "code": "project_not_found", "hint": "Call GET /api/v1/projects for the valid slugs.", "instance": "/api/v1/projects/x"}}</code></p>
<div class="table-wrap"><table><thead><tr><th>code</th><th>Status</th><th>Meaning</th><th>What to do</th></tr></thead><tbody>{errs}</tbody></table></div>
<h2 id="cli">Command-line tool</h2>
<p>The <code>devshipit</code> CLI reads the API from a terminal. It needs Node.js 20 or newer and has no dependencies.</p>
<p><code>npx github:devag7/devshipit projects</code></p>
<ul>
<li><code>devshipit profile</code>, <code>devshipit projects</code>, <code>devshipit project jantahr</code></li>
<li><code>devshipit services</code>, <code>devshipit faq</code>, <code>devshipit contact</code></li>
<li><code>devshipit pages</code> and <code>devshipit page /pricing/</code> to print a page as Markdown</li>
<li>Add <code>--json</code> to any command for raw JSON. Errors exit with code 1 and print the API's <code>code</code> and <code>hint</code>.</li>
</ul>
<p>Source: <a href="https://github.com/devag7/devshipit/tree/main/cli" rel="noopener">github.com/devag7/devshipit/tree/main/cli</a>.</p>
<h2 id="mcp">MCP server</h2>
<p>A public, read-only Model Context Protocol server runs at <code>https://devshipit.com/mcp</code> over Streamable HTTP. It needs no sign-in and does not store anything you send.</p>
<ul>
<li><code>get_profile</code>: who Dev is, where he works, his experience and stack</li>
<li><code>list_projects</code>: JantaHR, RentWise, linkedin-mcp and ISP Evidence with their status and links</li>
<li><code>list_services</code> and <code>get_faq</code>: freelance services and answers to common questions</li>
<li><code>list_pages</code> and <code>get_page</code>: every public page as Markdown</li>
<li><code>get_contact</code>: which email address to use for freelance work, general enquiries or JantaHR</li>
</ul>
<p>Add it to Claude Code with <code>claude mcp add --transport http devshipit https://devshipit.com/mcp</code>, or to any client that accepts a remote server URL. The discovery document is at <a href="/.well-known/mcp/server-card.json">/.well-known/mcp/server-card.json</a>.</p>
<h2 id="markdown">Read any page as Markdown</h2>
<p>Send <code>Accept: text/markdown</code> with a request for any page and you get Markdown instead of HTML, with <code>Vary: Accept</code> on both. You can also open the Markdown file directly by adding <code>index.md</code> to a page URL, for example <a href="/pricing/index.md">/pricing/index.md</a>.</p>
<p><code>curl -H "Accept: text/markdown" https://devshipit.com/</code></p>
<h2 id="llms">llms.txt</h2>
<p><a href="/llms.txt">/llms.txt</a> describes the site, says when an agent should use it and lists every page. <a href="/llms-full.txt">/llms-full.txt</a> holds the full text of every page in one file.</p>
<h2 id="tools">Published developer tools</h2>
<ul>
<li><a href="https://www.npmjs.com/package/linkedin-mcp-tools" rel="noopener">linkedin-mcp-tools</a> on npm: a 36-tool LinkedIn integration for AI assistants, with caching, rate limiting and retries. <a href="/work/linkedin-mcp/">linkedin-mcp case study</a>.</li>
<li><a href="https://jantahr.devshipit.com/developers" rel="noopener">JantaHR developer docs</a>: the REST API with its <a href="https://jantahr.devshipit.com/openapi.json" rel="noopener">OpenAPI specification</a>, and JantaHR's own MCP server for plans, pages and contact details.</li>
<li><a href="https://github.com/devag7" rel="noopener">github.com/devag7</a>: source for JantaHR, RentWise, linkedin-mcp and this site.</li>
</ul>
<h2 id="questions">Questions</h2>
<p>Email <a href="mailto:{HELLO}">{HELLO}</a>.</p>
  </div></div></div>
</section>
</main>
"""
    write("developers/index.html", h + b + footer())


def about():
    path = "/about/"
    nav, crumb = crumbs(("About", path))
    page = {"@type": "AboutPage", "@id": SITE + path + "#page", "url": SITE + path, "name": "About DevShipIt and Dev Agarwalla",
            "about": {"@id": BIZ_ID}, "mainEntity": {"@id": DEV_ID}, "isPartOf": {"@id": SITE_ID}, "breadcrumb": {"@id": crumb["@id"]},
            "relatedLink": ME + "/"}
    h = head("About Dev Agarwalla, the developer behind DevShipIt | DevShipIt",
             "DevShipIt is Dev Agarwalla, a full-stack and applied AI engineer in Bengaluru who builds every project himself. Who he is, what DevShipIt does, and where to read more.",
             path, ld=[crumb, page, PERSON_NODE, BUSINESS_NODE])
    b = gnav("about")
    b += f"""<main id="main">
<section class="page-head">
  <div class="wrap">
    {nav}
    <h1>About Dev Agarwalla</h1>
    <p class="lead">DevShipIt is Dev Agarwalla, a full-stack and applied AI engineer in Bengaluru. Every DevShipIt project is built by him personally.</p>
    <div class="btns">{btn("Full profile", ME + "/")}<a class="btn ghost" href="/contact/" data-contact>Contact</a></div>
  </div>
</section>
<section class="doc">
  <div class="wrap"><div class="doc-in"><div class="prose">
<h2>Who builds your project</h2>
<p>Dev is a Technical Delivery Associate at Falcon Reality, an AI product company, where he turns operations workflows into product specs and MVP scope. Before that he shipped three MERN applications to production as a full-stack intern at Cyber Secure India. On his own he has built and shipped four products: <a href="/work/jantahr/">JantaHR</a>, <a href="/work/rentwise/">RentWise</a>, <a href="/work/linkedin-mcp/">linkedin-mcp</a> and <a href="/work/isp-evidence/">ISP Evidence</a>.</p>
<h2>What DevShipIt does</h2>
<ul>
<li><strong>Freelance:</strong> {AGENT_PROFILE["freelance"]}. Every project is priced by a written quote before work starts. See <a href="/services/">freelance services</a>.</li>
<li><strong>Products:</strong> software Dev builds and runs himself, starting with JantaHR. See <a href="/work/">all work</a>.</li>
</ul>
<h2>DevShipIt and JantaHR</h2>
<p>DevShipIt is Dev's trading name, and devshipit.com is its website. JantaHR is HR and payroll software for Indian companies that DevShipIt builds and sells at <a href="https://jantahr.devshipit.com" rel="noopener">jantahr.devshipit.com</a>. Each live project runs on its own subdomain of devshipit.com.</p>
<h2>More about Dev</h2>
<p>His full experience, skills, writing and résumé are on his personal site, <a href="{ME}/">me.devshipit.com</a>.</p>
<ul>
<li>Email: <a href="mailto:{HELLO}">{HELLO}</a></li>
<li>LinkedIn: <a href="{LINKEDIN}" rel="noopener">linkedin.com/in/devagarwalla</a></li>
<li>GitHub: <a href="{GITHUB}" rel="noopener">github.com/devag7</a></li>
</ul>
  </div></div></div>
</section>
</main>
"""
    write("about/index.html", h + b + footer())


def services_page():
    path = "/services/"
    nav, crumb = crumbs(("Services", path))
    catalog = {"@type": "OfferCatalog", "@id": SITE + path + "#catalog", "name": "DevShipIt freelance web development",
               "itemListElement": [{"@type": "Offer", "itemOffered": {"@type": "Service", "@id": f"{SITE}{path}#{x['slug']}", "name": x["name"],
                                    "description": x["summary"], "serviceType": x["name"], "provider": {"@id": BIZ_ID},
                                    "areaServed": {"@type": "City", "name": "Bengaluru"}}} for x in SERVICES]}
    biz = {**BUSINESS_NODE, "hasOfferCatalog": {"@id": catalog["@id"]}}
    h = head("Freelance web development in Bengaluru | DevShipIt",
             "Websites and web apps for property agents, agencies and small businesses in Bengaluru, built by Dev Agarwalla at DevShipIt. Priced by a written quote before work starts.",
             path, ld=[crumb, biz, catalog, faq_node(SERVICES_FAQ, path)], extra='<link rel="stylesheet" href="/assets/home.css">\n')
    b = gnav("services")
    rows = "".join(f'<li class="rv" id="{x["slug"]}"><a class="row" href="/contact/" data-contact data-topic="{t}"><span class="n">0{i+1}</span><h3>{x["name"]}</h3><p>{x["summary"]}</p><span class="rbadge" aria-hidden="true">{phos("arrow-up-right")}</span></a></li>'
                   for i, (x, (_, _, t)) in enumerate(zip(SERVICES, ROWS)))
    steps = "".join(f"<li><h3>{a}</h3><p>{d}</p></li>" for a, d in STEPS)
    b += f"""<main id="main">
<section class="page-head">
  <div class="wrap">
    {nav}
    <h1>Freelance web development in Bengaluru</h1>
    <p class="lead">I build websites and web apps for property agents, agencies and small businesses: sites that list properties, capture enquiries and are easy to keep up to date. Every project is priced by a written quote before work starts.</p>
    <div class="btns">{btn("Start a project", "/contact/", attrs=' data-contact data-topic="Freelance project"')}<a class="btn ghost" href="/pricing/">See pricing</a></div>
  </div>
</section>
<section class="services" aria-labelledby="h-build">
  <div class="wrap">
    <div class="services-head"><h2 id="h-build" class="display-sm split">{split("What I can build for you")}</h2></div>
    <ul class="rows">{rows}</ul>
  </div>
</section>
<section class="block" aria-labelledby="h-steps">
  <div class="wrap">
    <h2 id="h-steps">How a project works</h2>
    <ol class="steps">{steps}</ol>
  </div>
</section>
<section class="block" id="questions" aria-labelledby="h-faq">
  <div class="wrap">
    <h2 id="h-faq">Questions</h2>
    {faq_html(SERVICES_FAQ)}
  </div>
</section>
</main>
"""
    write("services/index.html", h + b + footer())


WORK_CARDS = {
    "jantahr": ("art-jhr", "nestjs", ["nestjs", "nextdotjs"], ["NestJS", "Next.js", "PostgreSQL", "Supabase"]),
    "rentwise": ("art-rent", "mapbox", ["nextdotjs", "postgresql"], ["Next.js", "TypeScript", "PostgreSQL", "Socket.io"]),
    "linkedin-mcp": ("art-mcp", "nodedotjs", ["nodedotjs", "npm"], ["Node.js", "MCP", "npm"]),
    "isp-evidence": ("art-isp", "android", ["android", "googleplay"], ["Android", "Google Play"]),
}


def work_page():
    path = "/work/"
    nav, crumb = crumbs(("Work", path))
    items = {"@type": "ItemList", "@id": SITE + path + "#list", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "url": p["case_study"], "name": p["name"]} for i, p in enumerate(AGENT_PROJECTS)]}
    page = {"@type": "CollectionPage", "@id": SITE + path + "#page", "url": SITE + path, "name": "Work and case studies",
            "mainEntity": {"@id": items["@id"]}, "isPartOf": {"@id": SITE_ID}, "author": {"@id": DEV_ID}, "breadcrumb": {"@id": crumb["@id"]}}
    h = head("Work and case studies by Dev Agarwalla | DevShipIt",
             "Products Dev Agarwalla has built and shipped as DevShipIt, each with a case study: JantaHR, RentWise, linkedin-mcp and ISP Evidence, with their stack, status and links.",
             path, ld=[crumb, page, items], extra='<link rel="stylesheet" href="/assets/home.css">\n')
    b = gnav("work")
    cards = []
    for i, p in enumerate(AGENT_PROJECTS):
        art, ghost, marks, tags = WORK_CARDS[p["slug"]]
        cards.append(f"""<a class="wcard rv d{min(i, 3)}" href="/work/{p['slug']}/">
        <div class="art {art}" aria-hidden="true"></div>{brand(ghost, cls="ghost", hidden=True)}<span class="spot" aria-hidden="true"></span>
        <div class="top"><div class="marks">{"".join(brand(m, hidden=True) for m in marks)}</div><span class="arrow-badge" aria-hidden="true">{phos("arrow-up-right")}</span></div>
        <div>
          <p class="status">{p['status']}</p>
          <h2 class="h3">{p['name']}</h2>
          <p>{p['summary']}</p>
          <ul class="tags">{"".join(f'<li class="tag">{t}</li>' for t in tags)}</ul>
        </div>
      </a>""")
    b += f"""<main id="main">
<section class="page-head">
  <div class="wrap">
    {nav}
    <h1>Work and case studies</h1>
    <p class="lead">Four products I've built and shipped, each with a case study: what it does, how it is built and where to see it.</p>
  </div>
</section>
<section class="work" aria-label="Projects">
  <div class="wrap">
    <div class="work-grid even">
      {"".join(cards)}
    </div>
  </div>
</section>
</main>
"""
    write("work/index.html", h + b + footer())


def notfound():
    h = head("Page not found | DevShipIt", "That page does not exist.", "/404", noindex=True)
    b = gnav()
    b += f"""<main id="main" class="err">
  <div class="wrap">
    <h1>That page does not exist.</h1>
    <p class="lead">It may have moved, or the link may be wrong.</p>
    <div class="btns"><a class="btn" href="/">Back to the homepage</a><a class="btn ghost" href="/work/">See work</a><a class="btn ghost" href="/services/">Services</a></div>
  </div>
</main>
"""
    write("404.html", h + b + footer())


def md_page(path, title, desc):
    from markdownify import markdownify as mdify
    rel = (path.strip("/") + "/index.html") if path != "/" else "index.html"
    t = open(os.path.join(OUT, rel), encoding="utf-8").read()
    main = re.search(r'<main id="main"[^>]*>(.*?)</main>', t, re.S).group(1)
    main = re.sub(r'<svg[\s\S]*?</svg>|<canvas[\s\S]*?</canvas>|<script[\s\S]*?</script>', '', main)
    main = re.sub(r'<div class="(hero-media|hero-scrim|art[^"]*)"[^>]*>[\s\S]*?</div>', '', main)
    main = re.sub(r'<span class="(spot|arrow-badge|badge|rbadge|n)"[^>]*>[\s\S]*?</span>', '', main)
    main = re.sub(r'<a class="back"[\s\S]*?</a>', '', main)
    main = re.sub(r'<nav class="crumbs"[\s\S]*?</nav>', '', main)
    main = re.sub(r'<details><summary>([\s\S]*?)</summary><div class="a">([\s\S]*?)</div></details>', r'<h3>\1</h3>\2', main)
    main = re.sub(r'<div><dt>([\s\S]*?)</dt><dd>([\s\S]*?)</dd></div>', r'<li><strong>\1</strong>: \2</li>', main)
    main = re.sub(r'<dl[^>]*>', '<ul>', main).replace('</dl>', '</ul>')
    if path == "/":
        return home_md(desc)
    if path in CUSTOM_MD:
        return CUSTOM_MD[path](path, desc)
    body = mdify(main, heading_style="ATX", bullets="-", strip=["span", "figure"])
    body = re.sub(r"\]\(/", f"]({SITE}/", body)
    body = re.sub(r"\)\[", ") [", body)
    body = re.sub(r"!\[\]\([^)]*\)", "", body)
    body = re.sub(r"[ \t]+\n", "\n", body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()
    m = re.search(r"^# (.+)$", body, re.M)
    h1 = m.group(1).strip() if m else title.split(" | ")[0]
    if m:
        body = (body[:m.start()] + body[m.end():]).strip()
    out = (f"# {h1}\n\n> {desc}\n\n{body}\n\n---\n\nCanonical page: {SITE}{path}  \n"
           f"Site guide for agents: {SITE}/llms.txt  \nContact: {HELLO}\n")
    write(rel.replace("index.html", "index.md"), out)
    return out


def md_footer(path):
    return f"---\n\nCanonical page: {SITE}{path}  \nSite guide for agents: {SITE}/llms.txt  \nContact: {HELLO}\n"


def faq_md(items):
    out = []
    for q, a, link in items:
        more = f" [{link[0]}]({SITE}{link[1]})." if link else ""
        out += [f"### {q}", "", a + more, ""]
    return out


def services_md(path, desc):
    lines = ["# Freelance web development in Bengaluru", "", f"> {desc}", "",
             "I build websites and web apps for property agents, agencies and small businesses: sites that list properties, capture enquiries and are easy to keep up to date. Every project is priced by a written quote before work starts.", "",
             "## What I can build for you", ""]
    lines += [f"- **{x['name']}**: {x['summary']} Example: {x['example']}" for x in SERVICES]
    lines += ["", "## How a project works", ""]
    lines += [f"{i + 1}. **{a}**: {d}" for i, (a, d) in enumerate(STEPS)]
    lines += ["", "## Questions", ""] + faq_md(SERVICES_FAQ)
    lines += [f"Start a project: email {HELLO} or use {SITE}/contact/. Prices: {SITE}/pricing/", "", md_footer(path)]
    out = "\n".join(lines)
    write("services/index.md", out)
    return out


def work_md(path, desc):
    lines = ["# Work and case studies", "", f"> {desc}", "",
             "Four products I've built and shipped, each with a case study: what it does, how it is built and where to see it.", ""]
    for p in AGENT_PROJECTS:
        links = [f"[{p['name']} case study]({p['case_study']})"]
        if p.get("url"):
            links.append(f"[Live product or package]({p['url']})")
        if p.get("source"):
            links.append(f"[Source]({p['source']})")
        lines += [f"## {p['name']} ({p['status']})", "", p["summary"], "", "Stack: " + ", ".join(p["stack"]), "", " | ".join(links), ""]
    lines.append(md_footer(path))
    out = "\n".join(lines)
    write("work/index.md", out)
    return out


CUSTOM_MD = {"/services/": services_md, "/work/": work_md}


def home_md(desc):
    lines = [
        "# DevShipIt: Dev Agarwalla, full-stack developer in Bengaluru",
        "",
        f"> {desc}",
        "",
        "## I build products and ship them.",
        "",
        "I'm Dev Agarwalla. I build full-stack and AI products, and DevShipIt is where I ship them and take on freelance work. Most of it is live and open to look at.",
        "",
        "- Now: " + AGENT_PROFILE["current_role"],
        "- Freelance: " + AGENT_PROFILE["freelance"],
        "- Built with: " + ", ".join(AGENT_PROFILE["stack"]),
        "",
        "I learn fastest by building something people can use, so most of my work is shipped, deployed and open to look at.",
        "",
        "## Products",
        "",
    ]
    for p in AGENT_PROJECTS:
        links = [f"[Case study]({p['case_study']})"]
        if p.get("url"):
            links.insert(0, f"[{'Open' if p['name'] != 'linkedin-mcp' else 'npm package'}]({p['url']})")
        if p.get("source"):
            links.append(f"[Source]({p['source']})")
        lines += [f"### {p['name']} ({p['status']})", "", p["summary"], "", " | ".join(links), ""]
    lines += [
        "## JantaHR pricing",
        "",
        "- Free for up to 20 employees",
        "- Standard from ₹49 per employee a month, Professional from ₹99 (billed yearly; minimum 10 seats)",
        "- 14-day free trial, no card needed; cancel any time",
        f"- Full price list: {SITE}/pricing/",
        "",
        "## What I can build for you",
        "",
        "I build MERN-stack sites for property agents and agencies in Bangalore that list properties, capture enquiries and are easy to keep up to date.",
        "",
    ]
    lines += [f"- **{t}**: {d}" for t, d, _ in ROWS]
    lines += ["", f"How a project works, and more answers: {SITE}/services/", ""]
    lines += ["## Proof in the work, not the words.", ""]
    lines += [f"- **{n}{x}**: {l}" for n, x, l in STATS]
    lines += ["", "## Questions", ""] + faq_md(HOME_FAQ)
    lines += [
        "",
        "## Contact",
        "",
        f"- Freelance projects and general enquiries: {HELLO}",
        f"- JantaHR support, billing and legal: {JANTAHR}",
        f"- Contact page: {SITE}/contact/",
        "- GitHub: https://github.com/devag7",
        f"- LinkedIn: {LINKEDIN}",
        "",
        "---",
        "",
        f"Canonical page: {SITE}/  ",
        f"Site guide for agents: {SITE}/llms.txt  ",
        f"Developers and agents: {SITE}/developers/  ",
        f"API: {SITE}/api/v1 (OpenAPI: {SITE}/openapi.json)",
        "",
    ]
    out = "\n".join(lines)
    write("index.md", out)
    return out


AGENT_PROFILE = {
    "name": "Dev Agarwalla",
    "brand": "DevShipIt",
    "site": SITE + "/",
    "role": "Full-stack and applied AI engineer",
    "current_role": "Technical Delivery Associate at Falcon Reality, an AI product company, since September 2026",
    "location": "Bengaluru, Karnataka, India",
    "freelance": "MERN-stack websites and web apps for property agents and agencies in Bangalore that list properties, capture enquiries and are easy to keep up to date",
    "stack": [l for _, l in STACK],
    "github": "https://github.com/devag7",
    "linkedin": "https://www.linkedin.com/in/devagarwalla",
    "personal_site": "https://me.devshipit.com/",
}
# From Dev's LinkedIn profile (experience section), October 2026.
EXPERIENCE = [
    {"organisation": "Falcon Reality", "role": "Technical Delivery Associate", "dates": "September 2026 to now",
     "summary": "Joined as an intern in August 2026 and moved to full-time. Turns operations workflows into product specs, user stories and MVP scope for an AI product, and plans how it integrates with the systems customers already run."},
    {"organisation": "Cyber Secure India", "role": "Full-stack Developer Intern", "dates": "January to June 2025",
     "summary": "Shipped three MERN applications to production and built 15+ REST APIs with JWT authentication and role-based access, cutting API latency by about 30% through query indexing, caching and modular routes."},
    {"organisation": "GDSC", "role": "Student Developer", "dates": "2023 to 2024",
     "summary": "Ran technical workshops and coding sessions, and built frontend projects with other student developers."},
    {"organisation": "Bobble AI", "role": "Data Annotator Intern", "dates": "2021",
     "summary": "Prepared conversational datasets for the NLP models behind an AI keyboard."},
]
AGENT_PROFILE["experience"] = EXPERIENCE
AGENT_PROJECTS = [
    {"slug": "jantahr", "name": "JantaHR", "status": "Live", "stack": ["NestJS", "Prisma", "PostgreSQL", "Next.js", "Supabase", "Vercel", "Razorpay", "Expo"], "summary": "HR and payroll software for Indian companies: PF, ESI, professional tax, LWF and TDS every month, filing-ready files and a compliance calendar. Open source under AGPL-3.0.", "url": "https://jantahr.devshipit.com", "case_study": SITE + "/work/jantahr/", "source": "https://github.com/devag7/jantahr"},
    {"slug": "rentwise", "name": "RentWise", "status": "Live", "stack": ["Next.js", "TypeScript", "PostgreSQL", "Redis", "Socket.io", "Docker", "Playwright", "Mapbox GL JS", "Supabase"], "summary": "A rental platform for Bangalore with automated listing collection, real-time updates, map search and role-based access.", "case_study": SITE + "/work/rentwise/", "source": "https://github.com/devag7/rentwise"},
    {"slug": "linkedin-mcp", "name": "linkedin-mcp", "status": "On npm", "stack": ["Node.js", "MCP"], "summary": "A 36-tool LinkedIn integration for AI assistants, with caching, rate limiting and retries.", "url": "https://www.npmjs.com/package/linkedin-mcp-tools", "case_study": SITE + "/work/linkedin-mcp/"},
    {"slug": "isp-evidence", "name": "ISP Evidence", "status": "In testing", "stack": ["Android"], "summary": "An Android app that logs connection drops, latency and jitter, then exports a PDF report you can attach to an ISP complaint.", "case_study": SITE + "/work/isp-evidence/"},
]
AGENT_CONTACT = {
    "hiring_and_freelance": HELLO,
    "jantahr_support_billing_legal": JANTAHR,
    "contact_page": SITE + "/contact/",
    "note": "Use hello@devshipit.com for freelance projects and general enquiries. Use jantahr@devshipit.com only for JantaHR support, billing and legal questions.",
}

LLMS_WHEN = """## When to use devshipit.com

Use this site, or its MCP server, when the task is one of these:

- Someone asks who Dev Agarwalla is, where he works, what he has built or which technologies he works with.
- Someone evaluating Dev's work wants evidence of shipped work: live products, case studies, source code, his experience and the stack behind each one.
- A property agent, agency or small business in Bangalore wants a website or web app built (listings, enquiry capture, admin dashboards) and needs to know how to start and how pricing works.
- Someone needs the operator details, terms, privacy, refund or shipping policies behind JantaHR payments, which live on this site.
- A developer is looking for linkedin-mcp-tools, the LinkedIn MCP integration Dev published on npm.

## When not to use it

- HR or payroll questions about JantaHR itself, its features, API or prices for a company: use https://jantahr.devshipit.com and its own llms.txt at https://jantahr.devshipit.com/llms.txt.
- Live rental listings: this site describes RentWise, it does not serve listings.

## How an agent should use it

- Read any page as Markdown with the request header `Accept: text/markdown`, or by adding `index.md` to the page URL.
- Or call the JSON API at https://devshipit.com/api/v1 (read-only, no key). OpenAPI 3.1: https://devshipit.com/openapi.json. Errors are RFC 9457 problem details with `code` and `hint`.
- Or call the MCP server at https://devshipit.com/mcp (Streamable HTTP, no sign-in, read-only). Tools: `get_profile`, `list_projects`, `list_services`, `get_faq`, `list_pages`, `get_page`, `get_contact`. Discovery: https://devshipit.com/.well-known/mcp/server-card.json
- From a terminal: `npx github:devag7/devshipit projects` (the devshipit CLI).
- To contact Dev, give the person the right address rather than sending mail yourself: hello@devshipit.com for freelance projects and general enquiries, jantahr@devshipit.com for JantaHR support, billing and legal.
- Do not invent availability dates, rates or quotes. Freelance work is quoted per project in writing; say so and point to the contact page.
"""


def agents_pass():
    full = []
    for path, title, desc in PAGES:
        full.append(md_page(path, title, desc))
    label = lambda p, t: "Home" if p == "/" else t.split(" | ")[0].split(":")[0]
    pages_md = "\n".join(f"- [{label(p, t)}]({SITE}{p}index.md): {d}" for p, t, d in PAGES)
    llms = (
        "# DevShipIt\n\n"
        "> DevShipIt (devshipit.com) is the portfolio and product site of Dev Agarwalla, a freelance full-stack developer in Bengaluru, India. "
        "It covers his live products (JantaHR, RentWise, linkedin-mcp, ISP Evidence), case studies, freelance web development for real estate teams, "
        "and the policy pages behind JantaHR payments.\n\n"
        "Every page listed here is also served as Markdown: request it with the header `Accept: text/markdown`.\n\n"
        "About the name: Dev Agarwalla is spelled with a double L and a final A, and is devag7 on GitHub. "
        "He is not the same person as anyone named Dev Agarwal. His personal page is " + ME + "/.\n\n"
        + LLMS_WHEN +
        "\n## Pages\n\n" + pages_md + "\n\n"
        "## About Dev\n\n"
        "- [Dev Agarwalla](https://me.devshipit.com/): personal site with experience, skills, writing and résumé (also https://me.devshipit.com/llms.txt)\n\n"
        "## Developer resources\n\n"
        f"- [DevShipIt developer docs]({SITE}/developers/index.md): the API, CLI, MCP server, Markdown negotiation and llms.txt\n"
        f"- [DevShipIt API OpenAPI 3.1 document]({SITE}/openapi.json): every operation with an operationId, typed parameters and response schemas\n"
        f"- [DevShipIt API]({SITE}/api/v1): read-only JSON; start at the index\n"
        f"- [API catalog]({SITE}/.well-known/api-catalog): RFC 9727 linkset\n"
        "- [devshipit CLI](https://github.com/devag7/devshipit/tree/main/cli): `npx github:devag7/devshipit`\n"
        f"- [MCP server card]({SITE}/.well-known/mcp/server-card.json): discovery document for https://devshipit.com/mcp\n"
        "- [linkedin-mcp-tools on npm](https://www.npmjs.com/package/linkedin-mcp-tools): LinkedIn integration for AI assistants\n"
        "- [JantaHR developer docs](https://jantahr.devshipit.com/developers): REST API, OpenAPI specification and MCP server\n"
        "- [Source on GitHub](https://github.com/devag7): JantaHR, RentWise, linkedin-mcp\n\n"
        "## Frequently asked questions\n\n"
        + "\n".join(f"- **{q}** {a}" for q, a, _ in FAQ.values()) + "\n\n"
        "## Optional\n\n"
        f"- [Full text of every page]({SITE}/llms-full.txt)\n"
        f"- [Sitemap]({SITE}/sitemap.xml)\n"
    )
    write("llms.txt", llms)
    write("llms-full.txt", "# DevShipIt: full text of every page\n\n> Generated from the same source as the HTML pages. Canonical URLs are given under each page.\n\n" + "\n\n".join(full))
    data = {
        "profile": AGENT_PROFILE,
        "projects": AGENT_PROJECTS,
        "services": SERVICES,
        "process": [{"step": a, "detail": d} for a, d in STEPS],
        "faq": [{"question": q, "answer": a} for q, a, _ in FAQ.values()],
        "contact": AGENT_CONTACT,
        "pages": [{"path": p, "title": t, "description": d} for p, t, d in PAGES],
    }
    write("agent/site.json", json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    write("assets/icons.svg", '<svg xmlns="http://www.w3.org/2000/svg">' + "".join(SYMBOLS[k] for k in sorted(SYMBOLS)) + "</svg>\n")


def page_images(path):
    """Content images on a page (real screenshots with alt text), for the image sitemap. Logos and decoration are skipped."""
    rel = "index.html" if path == "/" else path.strip("/") + "/index.html"
    html = open(os.path.join(OUT, rel), encoding="utf-8").read()
    found = []
    for tag in re.findall(r"<img\b[^>]*>", html):
        src = re.search(r'src="(/assets/img/[^"]+)"', tag)
        alt = re.search(r'alt="([^"]+)"', tag)
        if src and alt and "logo" not in src.group(1) and src.group(1) not in found:
            found.append(src.group(1))
    return found


def housekeeping():
    urls = [p for p, _, _ in PAGES]
    # The personal site is listed too. That is a cross-host entry, allowed because me.devshipit.com/robots.txt
    # names this sitemap (sitemaps.org cross-submission) and Search Console verifies the whole domain.
    entries = [(SITE + u, LASTMOD, page_images(u)) for u in urls] + [(ME + "/", LASTMOD, [])]

    def url_xml(loc, mod, imgs):
        img = "".join(f"<image:image><image:loc>{SITE}{src}</image:loc></image:image>" for src in imgs)
        return f"  <url><loc>{loc}</loc><lastmod>{mod}</lastmod>{img}</url>\n"

    sm = ('<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
          + "".join(url_xml(*e) for e in entries) + "</urlset>\n")
    write("sitemap.xml", sm)
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\nSitemap: {ME}/sitemap.xml\n# Agent guide: {SITE}/llms.txt\n# API description: {SITE}/openapi.json\n# Dev Agarwalla's personal site: {ME}/\n")
    write(f"{INDEXNOW_KEY}.txt", INDEXNOW_KEY + "\n")
    write("site.webmanifest", json.dumps({
        "name": "DevShipIt", "short_name": "DevShipIt", "description": "Dev Agarwalla, freelance full-stack developer in Bengaluru.",
        "start_url": "/", "scope": "/", "display": "browser", "background_color": "#060507", "theme_color": "#060507", "lang": "en-IN",
        "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
                  {"src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml"}],
    }, indent=2) + "\n")
    write("_headers", """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'

/assets/*
  Cache-Control: public, max-age=300, must-revalidate

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/img/*
  Cache-Control: public, max-age=86400
""")


if __name__ == "__main__":
    home()
    work_page()
    services_page()
    about()
    doc_page("pricing", "pricing")
    doc_page("terms")
    doc_page("privacy")
    doc_page("refunds")
    doc_page("shipping")
    doc_page("contact", "contact", extra_meta_row=("Projects and general", f'<a href="mailto:{HELLO}">{HELLO}</a>'))
    case_page("jantahr", GALLERY)
    case_page("rentwise")
    case_page("linkedin-mcp")
    case_page("isp-evidence")
    developers()
    notfound()
    agents_pass()
    housekeeping()
    # Pre-flight: no dash characters anywhere in generated pages
    bad = []
    for root, _, files in os.walk(OUT):
        for f in files:
            if f.endswith((".html", ".css", ".js", ".xml", ".txt", ".md", ".json")):
                t = open(os.path.join(root, f), encoding="utf-8").read()
                if re.search("[—–]", t):
                    bad.append(f)
    print("dash files:", bad or "none")
