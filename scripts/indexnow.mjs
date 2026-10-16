/**
 * Tells IndexNow search engines (Bing, Yandex, Seznam, Naver and others) about the URLs in the live sitemap.
 * Usage: node scripts/indexnow.mjs [base]   (default https://devshipit.com)
 *
 * The sitemap also lists me.devshipit.com. IndexNow needs one request per host, with the key file live on that host,
 * so URLs are grouped by host and a host whose key file is not live yet is skipped with a message.
 */
import { readdirSync, readFileSync } from "node:fs";

const base = (process.argv[2] || "https://devshipit.com").replace(/\/+$/, "");
const keyFile = readdirSync(new URL("../public/", import.meta.url)).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.error("No IndexNow key file (32 hex characters + .txt) in public/."); process.exit(1); }
const key = readFileSync(new URL(`../public/${keyFile}`, import.meta.url), "utf8").trim();

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const byHost = new Map();
for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const u = new URL(loc);
  if (!byHost.has(u.host)) byHost.set(u.host, { origin: u.origin, urls: [] });
  byHost.get(u.host).urls.push(loc);
}

let failed = 0;
for (const [host, { origin, urls }] of byHost) {
  const keyLocation = `${origin}/${key}.txt`;
  const live = await fetch(keyLocation).catch(() => null);
  if (!live || !live.ok || (await live.text()).trim() !== key) {
    console.log(`IndexNow: skipped ${host}, key file not live at ${keyLocation}`);
    if (host === new URL(base).host) failed++;
    continue;
  }
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
  });
  console.log(`IndexNow: HTTP ${res.status} for ${urls.length} URLs on ${host}`);
  if (res.status >= 300) { console.error(await res.text()); failed++; }
}
process.exit(failed ? 1 : 0);
