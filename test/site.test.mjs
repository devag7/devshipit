/** Checks on the generated files agents read: llms.txt, JSON-LD, raw-HTML content, Markdown twins. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pub = (p) => readFile(new URL(`../public/${p}`, import.meta.url), "utf8");

test("llms.txt follows llmstxt.org: H1, summary blockquote, link sections, when-to-use guidance", async () => {
  const t = await pub("llms.txt");
  const lines = t.split("\n");
  assert.equal(lines[0], "# DevShipIt");
  assert.ok(lines.find((l) => l.startsWith("> ")), "summary blockquote");
  assert.match(t, /^## When to use devshipit\.com$/m);
  assert.match(t, /^## How an agent should use it$/m);
  assert.match(t, /https:\/\/devshipit\.com\/mcp/);
  assert.match(t, /^## Pages$/m);
  assert.match(t, /^## Optional$/m);
  for (const m of t.matchAll(/\]\((https:\/\/devshipit\.com[^)]*)\)/g)) assert.ok(!m[1].includes(" "), m[1]);
});

test("JSON-LD Person has a description and the site is described", async () => {
  const html = await pub("index.html");
  const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const graph = JSON.parse(raw)["@graph"];
  const person = graph.find((n) => n["@type"] === "Person");
  assert.ok(person.description && person.description.length > 50);
  assert.ok(graph.find((n) => n["@type"] === "WebSite" && n.name === "DevShipIt"));
});

test("homepage raw HTML carries real content: H1, sequential headings, text ratio above 10%", async () => {
  const html = await pub("index.html");
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, `heading jump h${levels[i - 1]} to h${levels[i]}`);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  assert.ok(text.length > 1500, `text ${text.length}`);
  assert.ok(text.length / html.length > 0.1, `ratio ${(100 * text.length / html.length).toFixed(1)}%`);
  assert.match(html, /<title>DevShipIt/);
});

test("each page links its Markdown twin and the twin starts with the same H1", async () => {
  const pages = JSON.parse(await pub("agent/site.json")).pages;
  for (const { path } of pages) {
    if (path === "/") continue;
    const dir = path.replace(/^\//, "");
    const html = await pub(`${dir}index.html`);
    const md = await pub(`${dir}index.md`);
    assert.match(html, new RegExp(`<link rel="alternate" type="text/markdown" href="https://devshipit.com${path}index.md"`));
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").trim();
    assert.equal(md.split("\n")[0], `# ${h1}`, path);
  }
});

test("no em or en dashes in anything agents read", async () => {
  for (const f of ["llms.txt", "llms-full.txt", "index.md", "agent/site.json"]) assert.ok(!/[–—]/.test(await pub(f)), f);
});
