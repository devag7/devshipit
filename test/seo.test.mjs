/** Search checks on the generated HTML: titles, descriptions, canonicals, structured data, breadcrumbs, links, icons. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const ROOT = new URL("../public/", import.meta.url);
const pub = (p) => readFile(new URL(p, ROOT), "utf8");
const exists = async (p) => { try { await stat(new URL(p, ROOT)); return true; } catch { return false; } };
const fileFor = (path) => (path === "/" ? "index.html" : `${path.slice(1)}index.html`);
const attr = (html, re) => (html.match(re) || [])[1];
const graphOf = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1])["@graph"]);

const sitemapPaths = async () => [...(await pub("sitemap.xml")).matchAll(/<loc>https:\/\/devshipit\.com([^<]*)<\/loc>/g)].map((m) => m[1]);

test("sitemap covers every public page, including about, services and work", async () => {
  const paths = await sitemapPaths();
  const pages = JSON.parse(await pub("agent/site.json")).pages.map((p) => p.path);
  assert.deepEqual([...paths].sort(), [...pages].sort());
  for (const p of ["/", "/about/", "/services/", "/work/", "/developers/", "/pricing/", "/contact/"]) assert.ok(paths.includes(p), p);
  for (const p of paths) assert.ok(await exists(fileFor(p)), p);
  assert.match(await pub("robots.txt"), /^Sitemap: https:\/\/devshipit\.com\/sitemap\.xml$/m);
  // The only cross-host entry is the personal site (its robots.txt names this sitemap: cross-submission).
  const hosts = [...(await pub("sitemap.xml")).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).host);
  assert.deepEqual([...new Set(hosts)].sort(), ["devshipit.com", "me.devshipit.com"]);
  assert.equal(hosts.filter((h) => h === "me.devshipit.com").length, 1);
});

test("every page: unique title with DevShipIt, unique description, canonical, lang, one H1", async () => {
  const titles = new Set(), descs = new Set();
  for (const p of await sitemapPaths()) {
    const html = await pub(fileFor(p));
    const title = attr(html, /<title>([^<]*)<\/title>/);
    const desc = attr(html, /<meta name="description" content="([^"]*)"/);
    assert.ok(title.includes("DevShipIt"), `${p}: title names DevShipIt`);
    assert.ok(title.length <= 70, `${p}: title length ${title.length}`);
    assert.ok(desc.length >= 50 && desc.length <= 170, `${p}: description length ${desc.length}`);
    assert.ok(!titles.has(title), `${p}: duplicate title`);
    assert.ok(!descs.has(desc), `${p}: duplicate description`);
    titles.add(title); descs.add(desc);
    assert.equal(attr(html, /<link rel="canonical" href="([^"]*)"/), `https://devshipit.com${p}`);
    assert.match(html, /<html lang="en-IN">/);
    assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large/);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${p}: one H1`);
    for (const img of html.match(/<img [^>]*>/g) || []) assert.match(img, / alt="/, `${p}: ${img.slice(0, 60)} has alt`);
  }
});

test("inner pages carry breadcrumbs, visible and as BreadcrumbList", async () => {
  for (const p of (await sitemapPaths()).filter((x) => x !== "/")) {
    const html = await pub(fileFor(p));
    assert.match(html, /<nav class="crumbs" aria-label="Breadcrumb">/, p);
    const crumb = graphOf(html).find((n) => n["@type"] === "BreadcrumbList");
    assert.ok(crumb, `${p}: BreadcrumbList`);
    const items = crumb.itemListElement;
    assert.equal(items[0].item, "https://devshipit.com/");
    assert.equal(items.at(-1).item, `https://devshipit.com${p}`);
    items.forEach((it, i) => assert.equal(it.position, i + 1));
  }
});

test("homepage structured data: site name, business, person and FAQ that matches the page", async () => {
  const html = await pub("index.html");
  const g = graphOf(html);
  const site = g.find((n) => n["@type"] === "WebSite");
  assert.equal(site.name, "DevShipIt");
  assert.ok(site.alternateName.includes("devshipit.com"));
  assert.equal(site.url, "https://devshipit.com/");
  assert.ok(g.find((n) => n["@type"] === "ProfessionalService" && n.name === "DevShipIt" && n.logo));
  assert.ok(g.find((n) => n["@type"] === "Person" && n.sameAs.includes("https://github.com/devag7")));
  const faq = g.find((n) => n["@type"] === "FAQPage");
  assert.ok(faq.mainEntity.length >= 4);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
  for (const q of faq.mainEntity) {
    assert.ok(html.includes(esc(q.name)), `visible question: ${q.name}`);
    assert.ok(html.includes(esc(q.acceptedAnswer.text)), `visible answer for: ${q.name}`);
  }
});

test("case studies describe their product, JantaHR with real prices", async () => {
  const types = { jantahr: "SoftwareApplication", rentwise: "WebApplication", "linkedin-mcp": "SoftwareApplication", "isp-evidence": "MobileApplication" };
  for (const [slug, type] of Object.entries(types)) {
    const node = graphOf(await pub(`work/${slug}/index.html`)).find((n) => n["@id"] === `https://devshipit.com/work/${slug}/#product`);
    assert.equal(node["@type"], type, slug);
    assert.equal(node.author["@id"], "https://me.devshipit.com/#person");
  }
  const jhr = graphOf(await pub("work/jantahr/index.html")).find((n) => n.name === "JantaHR" && n.offers);
  const pricing = await pub("pricing/index.md");
  for (const o of jhr.offers) {
    assert.equal(o.priceCurrency, "INR");
    if (o.price !== "0") assert.ok(pricing.includes(`₹${o.price} per employee a month`), `price ${o.price} is on the pricing page`);
  }
});

test("services and about pages carry Service, FAQPage and ProfilePage data", async () => {
  const s = graphOf(await pub("services/index.html"));
  const catalog = s.find((n) => n["@type"] === "OfferCatalog");
  assert.ok(catalog.itemListElement.length >= 4);
  assert.ok(catalog.itemListElement.every((o) => o.itemOffered["@type"] === "Service" && o.itemOffered.provider["@id"]));
  assert.ok(s.find((n) => n["@type"] === "FAQPage").mainEntity.length >= 5);
  const a = graphOf(await pub("about/index.html"));
  assert.equal(a.find((n) => n["@type"] === "AboutPage").mainEntity["@id"], "https://me.devshipit.com/#person");
  const w = graphOf(await pub("work/index.html"));
  assert.equal(w.find((n) => n["@type"] === "ItemList").itemListElement.length, 4);
});

test("every internal link and asset reference resolves", async () => {
  const workerPaths = ["/mcp", "/openapi.json", "/api/v1", "/.well-known/api-catalog", "/.well-known/mcp/server-card.json"];
  for (const p of [...await sitemapPaths(), "/404"]) {
    const html = await pub(p === "/404" ? "404.html" : fileFor(p));
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      const target = m[1];
      if (workerPaths.includes(target)) continue;
      const file = target.endsWith("/") ? `${target.slice(1)}index.html` : target.slice(1);
      assert.ok(await exists(file) || await exists(`${file}/index.html`), `${p} links to ${target}`);
    }
  }
});

test("icons, manifest and IndexNow key", async () => {
  const html = await pub("index.html");
  for (const f of ["favicon.ico", "favicon.svg", "favicon-48.png", "favicon-96.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]) assert.ok(await exists(f), f);
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="48x48">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
  const manifest = JSON.parse(await pub("site.webmanifest"));
  assert.equal(manifest.name, "DevShipIt");
  for (const i of manifest.icons) assert.ok(await exists(i.src.slice(1)), i.src);
  const robots = await pub("robots.txt");
  assert.match(robots, /Allow: \//);
  const { readdir } = await import("node:fs/promises");
  const keys = (await readdir(ROOT)).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  assert.equal(keys.length, 1);
  assert.equal((await pub(keys[0])).trim(), keys[0].replace(".txt", ""));
});

test("robots.txt names both sitemaps: this site and the personal site", async () => {
  const robots = await pub("robots.txt");
  assert.match(robots, /^Sitemap: https:\/\/devshipit\.com\/sitemap\.xml$/m);
  assert.match(robots, /^Sitemap: https:\/\/me\.devshipit\.com\/sitemap\.xml$/m);
});

test("image sitemap entries point at real screenshots", async () => {
  const sm = await pub("sitemap.xml");
  assert.match(sm, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  const imgs = [...sm.matchAll(/<image:loc>https:\/\/devshipit\.com(\/[^<]+)<\/image:loc>/g)].map((m) => m[1]);
  assert.ok(imgs.length >= 3);
  for (const src of imgs) assert.ok(await exists(src.slice(1)), src);
});

test("every image has non-empty alt text (Bing flags empty alt as missing)", async () => {
  for (const path of [...(await sitemapPaths()), "/404.html"]) {
    const file = path === "/404.html" ? "404.html" : fileFor(path);
    if (!(await exists(file))) continue;
    for (const [tag] of (await pub(file)).matchAll(/<img\b[^>]*>/g)) {
      assert.match(tag, /\balt="[^"]+"/, `${path}: ${tag.slice(0, 80)}`);
    }
  }
});
