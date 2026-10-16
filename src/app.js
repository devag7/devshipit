/**
 * devshipit.com edge Worker logic (src/worker.js is the entry point). Static files come from the assets binding; this script adds what static hosting cannot:
 * - Markdown for every page when an agent asks for it (Accept: text/markdown), with Vary: Accept on pages
 * - a Markdown 404 for agents, and 406 when a client accepts neither HTML nor Markdown
 * - the public, read-only MCP server at /mcp (Streamable HTTP) and its discovery documents
 * - the public, read-only JSON API at /api/v1, its OpenAPI 3.1 document and the RFC 9727 API catalog
 * - RFC 9457 problem details (application/problem+json) for errors whenever the client prefers JSON
 * - security and cache headers (a Worker in front of assets means _headers no longer applies)
 * - one canonical host: www.devshipit.com redirects to devshipit.com
 */
import { negotiate, varyAccept, prefersJson } from "./negotiate.js";
import { handleMcpPayload, mcpServerCard, MCP_PROTOCOL_VERSIONS } from "./mcp.js";
import { handleApi, problem, API_BASE } from "./api.js";
import { openapi, apiCatalog } from "./openapi.js";

export const APEX = "devshipit.com";
const ORIGIN = `https://${APEX}`;

export const CSP = "default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};
const MARKDOWN = "text/markdown; charset=utf-8";
export const OPENAPI_PATHS = ["/openapi.json", "/.well-known/openapi.json"];
export const CATALOG_PATH = "/.well-known/api-catalog";
const CATALOG_TYPE = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';
/** Advertised on every HTML page (RFC 8631 service-desc, RFC 9727 api-catalog). */
const API_LINKS = `<${ORIGIN}/openapi.json>; rel="service-desc"; type="application/json", <${ORIGIN}/developers/>; rel="service-doc"; type="text/html", <${ORIGIN}${CATALOG_PATH}>; rel="api-catalog"`;
export const CARD_PATHS = ["/.well-known/mcp", "/.well-known/mcp.json", "/.well-known/mcp/server-card.json", "/.well-known/mcp/server-cards.json"];

/* ---------- paths ---------- */

/** A page is a directory URL, an extensionless path or an .html file. Assets such as CSS, images and fonts are not. */
export function isPagePath(pathname) {
  if (pathname.endsWith("/")) return true;
  const last = pathname.slice(pathname.lastIndexOf("/") + 1);
  return !last.includes(".") || last.endsWith(".html");
}

/** Where the Markdown twin of a page lives: /x/ and /x and /x/index.html all map to /x/index.md. */
export function markdownPathFor(pathname) {
  if (pathname.endsWith("/")) return `${pathname}index.md`;
  if (pathname.endsWith("/index.html")) return pathname.replace(/index\.html$/, "index.md");
  if (pathname.endsWith(".html")) return pathname.replace(/\.html$/, ".md");
  return `${pathname}/index.md`;
}

/** The canonical HTML URL for a page path. */
function canonicalFor(pathname) {
  if (pathname.endsWith("/index.md") || pathname.endsWith("/index.html")) return ORIGIN + pathname.replace(/index\.(md|html)$/, "");
  if (pathname.endsWith("/")) return ORIGIN + pathname;
  return `${ORIGIN}${pathname}/`;
}

function cacheControlFor(pathname, status) {
  if (status >= 400) return "no-store";
  if (pathname.startsWith("/assets/fonts/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/assets/img/")) return "public, max-age=86400";
  if (pathname.startsWith("/assets/")) return "public, max-age=300, must-revalidate";
  return "public, max-age=0, must-revalidate";
}

/* ---------- responses ---------- */

function withHeaders(response, pathname, extra = {}) {
  const r = new Response(response.body, response);
  const type = r.headers.get("Content-Type") || "";
  for (const [k, v] of Object.entries(SECURITY)) r.headers.set(k, v);
  if (type.includes("text/html")) r.headers.set("Content-Security-Policy", CSP);
  r.headers.set("Cache-Control", cacheControlFor(pathname, r.status));
  for (const [k, v] of Object.entries(extra)) r.headers.set(k, v);
  return r;
}

function text(body, status, headers, method) {
  return new Response(method === "HEAD" ? null : body, { status, headers });
}

export function notFoundMarkdown(pathname) {
  return [
    "# Page not found",
    "",
    `There is no page at \`${pathname}\` on devshipit.com. It may have moved, or the link may be wrong.`,
    "",
    "Try one of these instead:",
    "",
    `- [Home](${ORIGIN}/index.md)`,
    `- [Site guide for agents (llms.txt)](${ORIGIN}/llms.txt)`,
    `- [Sitemap](${ORIGIN}/sitemap.xml)`,
    `- [Developers and agents](${ORIGIN}/developers/index.md)`,
    "",
  ].join("\n");
}

async function serveMarkdown(request, env, url, label) {
  const mdPath = url.pathname.endsWith(".md") ? url.pathname : markdownPathFor(url.pathname);
  const asset = await env.ASSETS.fetch(new Request(`${url.origin}${mdPath}`, { method: "GET" }));
  const type = label === "plain" ? "text/plain; charset=utf-8" : MARKDOWN;
  const base = { "Content-Type": type, Vary: "Accept", ...SECURITY };
  if (asset.status !== 200) {
    return text(notFoundMarkdown(url.pathname), 404, { ...base, "Cache-Control": "no-store" }, request.method);
  }
  const body = await asset.text();
  return text(body, 200, {
    ...base,
    "Cache-Control": "public, max-age=300",
    Link: `<${canonicalFor(mdPath)}>; rel="canonical"`,
    "X-Robots-Tag": "noindex",
  }, request.method);
}

/* ---------- MCP ---------- */

let siteCache = null;
async function siteData(env, origin) {
  if (siteCache) return siteCache;
  const r = await env.ASSETS.fetch(new Request(`${origin}/agent/site.json`));
  if (r.status !== 200) throw new Error("Site data is not available right now. Try again shortly.");
  siteCache = await r.json();
  return siteCache;
}

export const MCP_DESCRIPTION = "Read-only public information about Dev Agarwalla (DevShipIt), a full-stack developer in Bengaluru: profile and availability, products and case studies, every site page as Markdown, and which email address to use.";

export function publicMcpServer(env, origin) {
  const normalise = (p) => {
    if (typeof p !== "string" || !p.startsWith("/")) return null;
    const clean = p.split(/[?#]/)[0].replace(/index\.(md|html)$/, "");
    return clean.endsWith("/") ? clean : `${clean}/`;
  };
  return {
    info: { name: "devshipit", title: "DevShipIt", version: "1.0.0" },
    instructions: "Public, read-only information about Dev Agarwalla and his work at devshipit.com. Use get_profile for who he is, where he works, his experience and stack; list_projects for JantaHR, RentWise, linkedin-mcp and ISP Evidence; list_services and get_faq for freelance work and common questions; list_pages then get_page to read any page as Markdown; get_contact for the right email address. Give people the address instead of sending email yourself, and do not invent rates, dates or quotes. For JantaHR product, API or company-data questions use https://jantahr.devshipit.com/mcp instead.",
    tools: [
      {
        name: "get_profile", title: "Dev Agarwalla's profile",
        description: "Returns who Dev Agarwalla is: role, current employer, location, work experience, the freelance work he takes on, and the technologies he works with.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        call: async () => (await siteData(env, origin)).profile,
      },
      {
        name: "list_projects", title: "Products and case studies",
        description: "Lists Dev's products (JantaHR, RentWise, linkedin-mcp, ISP Evidence) with their status, a one-line summary and links to the live product, source code and case study.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        call: async () => (await siteData(env, origin)).projects,
      },
      {
        name: "list_services", title: "Freelance services",
        description: "Lists the freelance services Dev offers (real estate websites, full-stack web apps, SaaS products, Android apps and AI tools) and the four steps of a project, from the written quote to delivery. Never returns prices: every project is quoted in writing.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        call: async () => { const d = await siteData(env, origin); return { services: d.services, process: d.process }; },
      },
      {
        name: "get_faq", title: "Frequently asked questions",
        description: "Returns the published answers to common questions from clients: who builds the project, cost, timelines, ownership, delivery, cancellation, stack, reply times, and how DevShipIt relates to JantaHR.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        call: async () => (await siteData(env, origin)).faq,
      },
      {
        name: "list_pages", title: "List devshipit.com pages",
        description: "Lists every public page of devshipit.com with its path and a one-line summary. Use it to choose a path for get_page.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        call: async () => (await siteData(env, origin)).pages.map((p) => `- ${p.path}: ${p.description}`).join("\n"),
      },
      {
        name: "get_page", title: "Read a devshipit.com page",
        description: "Returns one public page of devshipit.com as Markdown, for example /, /pricing/, /work/jantahr/ or /contact/. Call list_pages for the available paths.",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string", description: "Path of a public page, starting with a slash, for example /work/rentwise/" } },
          required: ["path"],
          additionalProperties: false,
        },
        call: async (args) => {
          const { pages } = await siteData(env, origin);
          const path = normalise(args.path);
          const known = pages.map((p) => p.path);
          if (!path || !known.includes(path)) throw new Error(`No public page at ${String(args.path)}. Available paths: ${known.join(", ")}`);
          const r = await env.ASSETS.fetch(new Request(`${origin}${markdownPathFor(path)}`));
          if (r.status !== 200) throw new Error(`The page ${path} could not be loaded just now. Try again shortly.`);
          return r.text();
        },
      },
      {
        name: "get_contact", title: "Contact Dev",
        description: "Returns which email address to use: one for freelance projects and general enquiries, one only for JantaHR support, billing and legal questions, plus the contact page.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        call: async () => (await siteData(env, origin)).contact,
      },
    ],
  };
}

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...SECURITY, ...headers } });

async function handleMcp(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS } });
  if (request.method !== "POST") {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "This server does not offer an event stream. Send JSON-RPC messages with POST." } }, 405, { Allow: "POST, OPTIONS" });
  }
  const version = request.headers.get("MCP-Protocol-Version");
  if (version && !MCP_PROTOCOL_VERSIONS.includes(version)) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: `Unsupported MCP-Protocol-Version: ${version}. Supported: ${MCP_PROTOCOL_VERSIONS.join(", ")}` } }, 400);
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const { status, body } = await handleMcpPayload(payload, publicMcpServer(env, new URL(request.url).origin));
  return body === null ? new Response(null, { status, headers: { ...CORS } }) : json(body, status);
}

function serverCard(env, origin) {
  return mcpServerCard(publicMcpServer(env, origin), `${ORIGIN}/mcp`, {
    registryName: "com.devshipit/portfolio",
    description: MCP_DESCRIPTION,
    website: `${ORIGIN}/`,
    documentation: `${ORIGIN}/developers/`,
  });
}

/* ---------- entry ---------- */

export const handler = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === `www.${APEX}`) {
      url.hostname = APEX;
      return new Response(null, { status: 301, headers: { Location: url.toString(), ...SECURITY } });
    }

    if (url.pathname === "/mcp" || url.pathname === "/mcp/") return handleMcp(request, env);

    if (url.pathname === API_BASE || url.pathname.startsWith(`${API_BASE}/`)) {
      const r = await handleApi(request, env, openapi);
      for (const [k, v] of Object.entries(SECURITY)) r.headers.set(k, v);
      return r;
    }

    if (OPENAPI_PATHS.includes(url.pathname)) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS } });
      if (request.method !== "GET" && request.method !== "HEAD") return problem("method_not_allowed", `${request.method} is not supported on ${url.pathname}.`, { instance: url.pathname, headers: SECURITY });
      return new Response(request.method === "HEAD" ? null : JSON.stringify(openapi, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600", Link: `<${ORIGIN}/developers/>; rel="service-doc"`, ...CORS, ...SECURITY },
      });
    }

    if (url.pathname === CATALOG_PATH) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS } });
      if (request.method !== "GET" && request.method !== "HEAD") return problem("method_not_allowed", `${request.method} is not supported on ${url.pathname}.`, { instance: url.pathname, headers: SECURITY });
      return new Response(request.method === "HEAD" ? null : JSON.stringify(apiCatalog, null, 2), {
        status: 200,
        headers: { "Content-Type": CATALOG_TYPE, "Cache-Control": "public, max-age=3600", Link: `<${ORIGIN}${CATALOG_PATH}>; rel="api-catalog"`, ...CORS, ...SECURITY },
      });
    }

    if (CARD_PATHS.includes(url.pathname)) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...CORS } });
      return json(serverCard(env, url.origin), 200, { "Cache-Control": "public, max-age=3600" });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return withHeaders(await env.ASSETS.fetch(request), url.pathname);
    }

    if (url.pathname.endsWith(".md")) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 200) return text(notFoundMarkdown(url.pathname), 404, { "Content-Type": MARKDOWN, "Cache-Control": "no-store", ...SECURITY }, request.method);
      return withHeaders(asset, url.pathname, { "Content-Type": MARKDOWN, Link: `<${canonicalFor(url.pathname)}>; rel="canonical"`, "X-Robots-Tag": "noindex" });
    }

    const accept = request.headers.get("Accept");
    const wantsJson = prefersJson(accept);

    if (!isPagePath(url.pathname)) {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404 && wantsJson) return problem("not_found", `There is no file at ${url.pathname}.`, { instance: url.pathname, method: request.method, headers: { Vary: "Accept", ...SECURITY } });
      return withHeaders(res, url.pathname);
    }

    const choice = negotiate(accept);
    if (choice === null) {
      const twin = await env.ASSETS.fetch(new Request(`${url.origin}${markdownPathFor(url.pathname)}`));
      const headers = { Vary: "Accept", ...SECURITY };
      if (twin.status !== 200) {
        if (wantsJson) return problem("not_found", `There is no page at ${url.pathname}.`, { instance: url.pathname, method: request.method, headers });
        return text("404 Not Found: there is no page at this path. See https://devshipit.com/sitemap.xml.\n", 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers }, request.method);
      }
      if (wantsJson) {
        return problem("not_acceptable", `${url.pathname} is a page, available as text/html or text/markdown. For JSON use the API: ${ORIGIN}${API_BASE}/page?path=${encodeURIComponent(url.pathname.endsWith("/") ? url.pathname : url.pathname + "/")}`, { instance: url.pathname, method: request.method, headers });
      }
      return text("406 Not Acceptable: this page is available as text/html or text/markdown.\n", 406, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers }, request.method);
    }
    if (choice === "markdown" || choice === "plain") return serveMarkdown(request, env, url, choice);

    const res = await env.ASSETS.fetch(request);
    if (res.status === 404 && wantsJson) return problem("not_found", `There is no page at ${url.pathname}.`, { instance: url.pathname, method: request.method, headers: { Vary: "Accept", ...SECURITY } });
    const extra = { Vary: varyAccept(res.headers.get("Vary")) };
    if (res.status === 200) extra.Link = `<${ORIGIN}${markdownPathFor(url.pathname)}>; rel="alternate"; type="text/markdown", ${API_LINKS}`;
    return withHeaders(res, url.pathname, extra);
  },
};
