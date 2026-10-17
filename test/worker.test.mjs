import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { isPagePath, markdownPathFor, CSP } from "../src/app.js";
import { ASSETS } from "./assets-mock.mjs";

const env = { ASSETS };
const get = (path, headers = {}, init = {}) => worker.fetch(new Request(`https://devshipit.com${path}`, { headers, ...init }), env);

test("homepage: Markdown for Accept text/markdown, with Vary: Accept", async () => {
  const r = await get("/", { Accept: "text/markdown" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /^text\/markdown/);
  assert.match(r.headers.get("Vary"), /Accept/);
  const body = await r.text();
  assert.ok(body.startsWith("# DevShipIt"), "starts with an H1");
  assert.ok(body.length > 1000, "non-trivial body");
  assert.ok(!/<[a-z][^>]*>/i.test(body), "no HTML tags in the Markdown");
});

test("homepage: HTML for browsers, still with Vary: Accept and the security headers", async () => {
  const r = await get("/", { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /^text\/html/);
  assert.match(r.headers.get("Vary"), /Accept/);
  assert.equal(r.headers.get("Content-Security-Policy"), CSP);
  assert.equal(r.headers.get("X-Frame-Options"), "DENY");
  assert.match(r.headers.get("Link"), /rel="alternate"; type="text\/markdown"/);
  assert.match(await r.text(), /<h1/);
});

test("every page in the sitemap has a Markdown twin", async () => {
  const sm = await (await get("/sitemap.xml")).text();
  const paths = [...sm.matchAll(/<loc>https:\/\/devshipit\.com([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(paths.length >= 12);
  for (const p of paths) {
    const r = await get(p, { Accept: "text/markdown" });
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("Content-Type"), /^text\/markdown/, p);
    assert.match(await r.text(), /^# /, p);
  }
});

test("Markdown works without a trailing slash and for direct .md URLs", async () => {
  const a = await get("/pricing", { Accept: "text/markdown" });
  assert.equal(a.status, 200);
  assert.match(a.headers.get("Link"), /<https:\/\/devshipit\.com\/pricing\/>; rel="canonical"/);
  const b = await get("/pricing/index.md");
  assert.equal(b.status, 200);
  assert.match(b.headers.get("Content-Type"), /^text\/markdown/);
});

test("404: Markdown body for agents, HTML 404 page for browsers", async () => {
  const md = await get("/__probe-does-not-exist", { Accept: "text/markdown" });
  assert.equal(md.status, 404);
  assert.match(md.headers.get("Content-Type"), /^text\/markdown/);
  const body = await md.text();
  assert.ok(body.length >= 20);
  assert.match(body, /llms\.txt/);
  assert.match(body, /sitemap\.xml/);
  const html = await get("/__probe-does-not-exist", { Accept: "text/html" });
  assert.equal(html.status, 404);
  assert.match(html.headers.get("Content-Type"), /^text\/html/);
  const missingMd = await get("/nope/index.md");
  assert.equal(missingMd.status, 404);
  assert.match(missingMd.headers.get("Content-Type"), /^text\/markdown/);
});

test("406 when neither HTML nor Markdown is acceptable", async () => {
  const r = await get("/", { Accept: "application/json" });
  assert.equal(r.status, 406);
  assert.match(r.headers.get("Vary"), /Accept/);
});

test("HEAD returns headers without a body", async () => {
  const r = await get("/", { Accept: "text/markdown" }, { method: "HEAD" });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /^text\/markdown/);
  assert.equal(await r.text(), "");
});

test("static assets pass through untouched by negotiation, with cache headers", async () => {
  const css = await get("/assets/styles.css", { Accept: "text/markdown" });
  assert.equal(css.status, 200);
  assert.match(css.headers.get("Content-Type"), /text\/css/);
  assert.equal(css.headers.get("Cache-Control"), "public, max-age=300, must-revalidate");
  const img = await get("/assets/img/og.png");
  assert.equal(img.headers.get("Cache-Control"), "public, max-age=86400");
});

test("www redirects to the apex domain, keeping path and query", async () => {
  const r = await worker.fetch(new Request("https://www.devshipit.com/pricing/?a=1"), env);
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("Location"), "https://devshipit.com/pricing/?a=1");
});

test("path helpers", () => {
  assert.equal(isPagePath("/"), true);
  assert.equal(isPagePath("/pricing"), true);
  assert.equal(isPagePath("/assets/styles.css"), false);
  assert.equal(markdownPathFor("/"), "/index.md");
  assert.equal(markdownPathFor("/work/jantahr"), "/work/jantahr/index.md");
  assert.equal(markdownPathFor("/terms/index.html"), "/terms/index.md");
});
