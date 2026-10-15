/** A stand-in for the Workers static-assets binding, reading ./public the way Cloudflare does for this config
 * (html_handling auto-trailing-slash, not_found_handling 404-page). Good enough to test the Worker's logic. */
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = new URL("../public/", import.meta.url).pathname;
const TYPES = { ".html": "text/html; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".xml": "application/xml", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2" };

async function isFile(p) { try { return (await stat(p)).isFile(); } catch { return false; } }

export const ASSETS = {
  async fetch(input) {
    const req = input instanceof Request ? input : new Request(input);
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    let file = null;
    if (p.endsWith("/")) file = join(ROOT, p, "index.html");
    else if (extname(p)) file = join(ROOT, p);
    else if (await isFile(join(ROOT, p, "index.html"))) return new Response(null, { status: 307, headers: { Location: `${p}/` } });
    if (file && await isFile(file)) {
      const body = req.method === "HEAD" ? null : await readFile(file);
      return new Response(body, { status: 200, headers: { "Content-Type": TYPES[extname(file)] || "application/octet-stream" } });
    }
    const body = await readFile(join(ROOT, "404.html"));
    return new Response(req.method === "HEAD" ? null : body, { status: 404, headers: { "Content-Type": TYPES[".html"] } });
  },
};
