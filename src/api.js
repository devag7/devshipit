/**
 * The public, read-only JSON API at /api/v1. Same facts as the site, the MCP server and the CLI, from one source:
 * public/agent/site.json plus each page's Markdown twin.
 *
 * Every error is RFC 9457 problem details (application/problem+json) with three extra members agents can act on:
 * `code` (stable, machine-readable), `hint` (what to do next) and `docs` (where to read more). Each `type` URI opens
 * that code's entry in the errors table on /developers/.
 */

export const API_BASE = "/api/v1";
export const API_VERSION = "1.0.0";
const ORIGIN = "https://devshipit.com";
const DOCS = `${ORIGIN}/developers/#errors`;

export const API_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
};

/** Error catalogue: one entry per `code`, used by responses and documented in the OpenAPI spec. */
export const ERRORS = {
  not_found: { status: 404, title: "Not found", hint: `List what exists with GET ${API_BASE}/ or read ${ORIGIN}/openapi.json.` },
  project_not_found: { status: 404, title: "Project not found", hint: `Call GET ${API_BASE}/projects for the valid slugs.` },
  page_not_found: { status: 404, title: "Page not found", hint: `Call GET ${API_BASE}/pages for the valid paths.` },
  missing_parameter: { status: 400, title: "Missing parameter", hint: "Add the required query parameter and retry." },
  invalid_parameter: { status: 400, title: "Invalid parameter", hint: "Check the parameter format in the OpenAPI spec and retry." },
  method_not_allowed: { status: 405, title: "Method not allowed", hint: "This API is read-only: use GET (or HEAD)." },
  not_acceptable: { status: 406, title: "Not acceptable", hint: "Ask for application/json, or for pages text/html or text/markdown." },
  unavailable: { status: 503, title: "Temporarily unavailable", hint: "Retry after a few seconds." },
};

/** Builds an RFC 9457 problem response. */
export function problem(code, detail, { instance, method = "GET", headers = {} } = {}) {
  const e = ERRORS[code] || ERRORS.not_found;
  const body = {
    type: `${ORIGIN}/developers/#error-${code}`,
    title: e.title,
    status: e.status,
    detail,
    code,
    hint: e.hint,
    docs: DOCS,
    ...(instance ? { instance } : {}),
  };
  const h = { "Content-Type": "application/problem+json", "Cache-Control": "no-store", ...API_HEADERS, ...headers };
  if (e.status === 405) h.Allow = "GET, HEAD, OPTIONS";
  if (e.status === 503) h["Retry-After"] = "5";
  return new Response(method === "HEAD" ? null : JSON.stringify(body, null, 2), { status: e.status, headers: h });
}

const ok = (data, method, extra = {}) =>
  new Response(method === "HEAD" ? null : JSON.stringify(data, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", ...API_HEADERS, ...extra },
  });

/** Normalises a page path: "/pricing", "/pricing/", "/pricing/index.md" all become "/pricing/". */
export function normalisePagePath(p) {
  if (typeof p !== "string" || !p.startsWith("/") || p.includes("..")) return null;
  const clean = p.split(/[?#]/)[0].replace(/index\.(md|html)$/, "");
  return clean.endsWith("/") ? clean : `${clean}/`;
}

let cache = null;
async function siteData(env, origin) {
  if (cache) return cache;
  const r = await env.ASSETS.fetch(new Request(`${origin}/agent/site.json`));
  if (r.status !== 200) return null;
  cache = await r.json();
  return cache;
}

/** Routes /api/v1/* requests. Returns a Response for every input; never HTML. */
export async function handleApi(request, env, openapi) {
  const url = new URL(request.url);
  const method = request.method;
  const instance = url.pathname + url.search;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: { ...API_HEADERS } });
  if (method !== "GET" && method !== "HEAD") return problem("method_not_allowed", `${method} is not supported on ${url.pathname}.`, { instance });

  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === API_BASE || path === `${API_BASE}/index.json`) {
    return ok({
      name: "DevShipIt API",
      version: API_VERSION,
      description: "Read-only public data about Dev Agarwalla (DevShipIt): profile, projects, services, contact and every site page as Markdown.",
      openapi: `${ORIGIN}/openapi.json`,
      docs: `${ORIGIN}/developers/`,
      endpoints: Object.keys(openapi.paths).map((p) => `${ORIGIN}${API_BASE}${p}`),
    }, method);
  }
  if (path === `${API_BASE}/openapi.json`) return ok(openapi, method);

  const data = await siteData(env, url.origin);
  if (!data) return problem("unavailable", "The site data could not be loaded.", { instance, method });

  const rest = path.slice(API_BASE.length);
  if (rest === "/profile") return ok(data.profile, method);
  if (rest === "/contact") return ok(data.contact, method);
  if (rest === "/services") return ok({ services: data.services }, method);
  if (rest === "/faq") return ok({ questions: data.faq }, method);
  if (rest === "/projects") return ok({ projects: data.projects }, method);
  if (rest.startsWith("/projects/")) {
    const slug = decodeURIComponent(rest.slice("/projects/".length));
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) return problem("invalid_parameter", `"${slug}" is not a valid project slug (lowercase letters, digits and hyphens).`, { instance, method });
    const project = data.projects.find((p) => p.slug === slug);
    if (!project) return problem("project_not_found", `There is no project "${slug}". Valid slugs: ${data.projects.map((p) => p.slug).join(", ")}.`, { instance, method });
    return ok(project, method);
  }
  if (rest === "/pages") return ok({ pages: data.pages }, method);
  if (rest === "/page") {
    const raw = url.searchParams.get("path");
    if (raw === null || raw === "") return problem("missing_parameter", "The query parameter `path` is required, for example ?path=/pricing/.", { instance, method });
    const p = normalisePagePath(raw);
    if (!p) return problem("invalid_parameter", "`path` must start with a slash, for example /work/jantahr/.", { instance, method });
    const meta = data.pages.find((x) => x.path === p);
    if (!meta) return problem("page_not_found", `There is no public page at ${p}.`, { instance, method });
    const r = await env.ASSETS.fetch(new Request(`${url.origin}${p}index.md`));
    if (r.status !== 200) return problem("unavailable", `The page ${p} could not be loaded just now.`, { instance, method });
    return ok({ ...meta, url: `${ORIGIN}${p}`, markdown: await r.text() }, method);
  }
  return problem("not_found", `There is no API endpoint at ${url.pathname}.`, { instance, method });
}
