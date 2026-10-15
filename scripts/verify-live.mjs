/**
 * Checks the deployed site the way agent-readiness scanners do. Usage: node scripts/verify-live.mjs [base-url]
 * Exits non-zero if any check fails.
 */
const BASE = (process.argv[2] || "https://devshipit.com").replace(/\/$/, "");
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
};
const get = (path, headers = {}, init = {}) => fetch(BASE + path, { redirect: "follow", headers, ...init });

const md = await get("/", { Accept: "text/markdown" });
const mdBody = await md.text();
check("homepage Markdown for Accept: text/markdown", md.status === 200 && /^text\/markdown/.test(md.headers.get("content-type") || "") && mdBody.startsWith("# "), md.headers.get("content-type"));
check("homepage Markdown has Vary: Accept", /accept/i.test(md.headers.get("vary") || ""), md.headers.get("vary"));

const html = await get("/", { Accept: "text/html" });
const htmlBody = await html.text();
check("homepage HTML for Accept: text/html", html.status === 200 && /^text\/html/.test(html.headers.get("content-type") || ""));
check("homepage HTML has Vary: Accept", /accept/i.test(html.headers.get("vary") || ""));
check("homepage HTML keeps the CSP", /default-src 'self'/.test(html.headers.get("content-security-policy") || ""));
const text = htmlBody.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
check("raw HTML content ratio above 5%", text.length / htmlBody.length > 0.05, `${text.length} chars, ${(100 * text.length / htmlBody.length).toFixed(1)}%`);

const nf = await get("/__probe-does-not-exist-" + Date.now(), { Accept: "text/markdown" });
const nfBody = await nf.text();
check("404 with Markdown body for agents", nf.status === 404 && /^text\/markdown/.test(nf.headers.get("content-type") || "") && nfBody.length >= 20 && /llms\.txt|sitemap/.test(nfBody));
const nfh = await get("/__probe-does-not-exist-" + Date.now(), { Accept: "text/html" });
check("404 HTML page for browsers", nfh.status === 404 && /^text\/html/.test(nfh.headers.get("content-type") || ""));
check("406 for unsupported Accept", (await get("/", { Accept: "application/json" })).status === 406);

const llms = await get("/llms.txt");
const llmsBody = await llms.text();
check("llms.txt with when-to-use guidance", llms.status === 200 && llmsBody.startsWith("# DevShipIt") && /## When to use/.test(llmsBody));
check("llms-full.txt", (await get("/llms-full.txt")).status === 200);

const card = await get("/.well-known/mcp/server-card.json");
const cardJson = card.status === 200 ? await card.json() : {};
check("MCP server card", card.status === 200 && cardJson.transport?.type === "streamable-http" && card.headers.get("access-control-allow-origin") === "*");
const init = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "verify", version: "1" } } }) });
const initJson = init.status === 200 ? await init.json() : {};
check("MCP initialize over Streamable HTTP", initJson.result?.serverInfo?.name === "devshipit", `protocol ${initJson.result?.protocolVersion}`);
const tools = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_page", arguments: { path: "/pricing/" } } }) });
const toolsJson = await tools.json();
check("MCP tools/call get_page", toolsJson.result?.isError === false && /^# Pricing/.test(toolsJson.result.content[0].text));

const ld = htmlBody.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
const person = ld ? JSON.parse(ld[1])["@graph"]?.find((n) => n["@type"] === "Person") : null;
check("JSON-LD Person with description", !!person?.description);

const www = await fetch("https://www.devshipit.com/pricing/", { redirect: "manual" });
if (BASE === "https://devshipit.com") check("www redirects to apex", www.status === 301 && www.headers.get("location") === "https://devshipit.com/pricing/", `${www.status} ${www.headers.get("location")}`);

const sm = await (await get("/sitemap.xml")).text();
const paths = [...sm.matchAll(/<loc>https:\/\/devshipit\.com([^<]*)<\/loc>/g)].map((m) => m[1]);
let mdOk = 0;
for (const p of paths) {
  const r = await get(p, { Accept: "text/markdown" });
  if (r.status === 200 && /^text\/markdown/.test(r.headers.get("content-type") || "")) mdOk++;
}
check("every sitemap page negotiates Markdown", mdOk === paths.length, `${mdOk}/${paths.length}`);

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
