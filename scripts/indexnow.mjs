/**
 * Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others) that the pages in the live sitemap changed.
 * Usage: node scripts/indexnow.mjs [base]   (default https://devshipit.com)
 * The key file must already be live at {base}/{key}.txt, so run this after a deploy.
 */
import { readdirSync, readFileSync } from "node:fs";

const base = (process.argv[2] || "https://devshipit.com").replace(/\/+$/, "");
const host = new URL(base).host;
const keyFile = readdirSync(new URL("../public/", import.meta.url)).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error("No IndexNow key file (32 hex characters + .txt) in public/."); process.exit(1); }
const key = readFileSync(new URL(`../public/${keyFile}`, import.meta.url), "utf8").trim();

const live = await fetch(`${base}/${key}.txt`);
if (!live.ok || (await live.text()).trim() !== key) { console.error(`The key file is not live at ${base}/${key}.txt yet. Deploy first.`); process.exit(1); }

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation: `${base}/${key}.txt`, urlList }),
});
console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} URLs`);
if (res.status >= 300) { console.error(await res.text()); process.exit(1); }
