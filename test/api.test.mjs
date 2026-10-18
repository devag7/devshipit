import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { openapi, apiCatalog } from "../src/openapi.js";
import { ERRORS, normalisePagePath } from "../src/api.js";
import { ASSETS } from "./assets-mock.mjs";

const env = { ASSETS };
const get = (path, headers = {}, init = {}) => worker.fetch(new Request(`https://devshipit.com${path}`, { headers, ...init }), env);
const PROBLEM_KEYS = ["type", "title", "status", "detail", "code", "hint", "docs"];

async function expectProblem(res, status, code) {
  assert.equal(res.status, status);
  assert.equal(res.headers.get("Content-Type"), "application/problem+json");
  const body = await res.json();
  for (const k of PROBLEM_KEYS) assert.ok(k in body, `problem has ${k}`);
  assert.ok(!("instance" in body), "problem never repeats the request path");
  assert.equal(body.status, status);
  assert.equal(body.code, code);
  assert.equal(body.type, `https://devshipit.com/developers/#error-${code}`);
  assert.ok(body.hint.length > 10);
  return body;
}

test("api: index lists every endpoint in the OpenAPI document", async () => {
  const r = await get("/api/v1");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /^application\/json/);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*");
  const j = await r.json();
  assert.equal(j.endpoints.length, Object.keys(openapi.paths).length);
  assert.equal((await get("/api/v1/")).status, 200);
});

test("api: data endpoints return the site facts", async () => {
  assert.equal((await (await get("/api/v1/profile")).json()).brand, "DevShipIt");
  const { projects } = await (await get("/api/v1/projects")).json();
  assert.deepEqual(projects.map((p) => p.slug), ["jantahr", "rentwise", "linkedin-mcp", "isp-evidence"]);
  for (const p of projects) {
    const one = await (await get(`/api/v1/projects/${p.slug}`)).json();
    assert.equal(one.name, p.name);
  }
  const { services } = await (await get("/api/v1/services")).json();
  assert.ok(services.length >= 4 && services.every((s) => s.slug && s.name && s.summary));
  const { questions } = await (await get("/api/v1/faq")).json();
  assert.ok(questions.length >= 5);
  assert.equal((await (await get("/api/v1/contact")).json()).hiring_and_freelance, "hello@devshipit.com");
  const { pages } = await (await get("/api/v1/pages")).json();
  assert.ok(pages.some((p) => p.path === "/services/"));
});

test("api: getPage returns Markdown and accepts loose paths", async () => {
  for (const p of ["/pricing/", "/pricing", "/pricing/index.md"]) {
    const j = await (await get(`/api/v1/page?path=${encodeURIComponent(p)}`)).json();
    assert.equal(j.path, "/pricing/");
    assert.equal(j.url, "https://devshipit.com/pricing/");
    assert.match(j.markdown, /^# Pricing/);
  }
  assert.equal(normalisePagePath("../etc"), null);
  assert.equal(normalisePagePath("/a/../b"), null);
});

test("api: errors are RFC 9457 problem details with code and hint", async () => {
  await expectProblem(await get("/api/v1/nope"), 404, "not_found");
  const p = await expectProblem(await get("/api/v1/projects/nope"), 404, "project_not_found");
  assert.match(p.detail, /jantahr/);
  await expectProblem(await get("/api/v1/projects/Bad_Slug!"), 400, "invalid_parameter");
  await expectProblem(await get("/api/v1/page"), 400, "missing_parameter");
  await expectProblem(await get("/api/v1/page?path=pricing"), 400, "invalid_parameter");
  await expectProblem(await get("/api/v1/page?path=/secret/"), 404, "page_not_found");
  const m = await get("/api/v1/profile", {}, { method: "POST", body: "{}" });
  await expectProblem(m, 405, "method_not_allowed");
  assert.equal(m.headers.get("Allow"), "GET, HEAD, OPTIONS");
});

test("api: HEAD and CORS preflight", async () => {
  const h = await get("/api/v1/profile", {}, { method: "HEAD" });
  assert.equal(h.status, 200);
  assert.equal(await h.text(), "");
  const o = await get("/api/v1/profile", {}, { method: "OPTIONS" });
  assert.equal(o.status, 204);
  assert.match(o.headers.get("Access-Control-Allow-Methods"), /GET/);
});

test("site: clients that prefer JSON get problem details, browsers keep HTML", async () => {
  const missing = await expectProblem(await get("/no-such-page/", { Accept: "application/json" }), 404, "not_found");
  await expectProblem(await get("/no-such-file.json", { Accept: "application/json" }), 404, "not_found");
  const page = await expectProblem(await get("/pricing/", { Accept: "application/json" }), 406, "not_acceptable");
  assert.match(page.detail, /\/api\/v1\/page\?path=/);
  const axiosLike = await get("/pricing/", { Accept: "application/json, text/plain, */*" });
  assert.equal(axiosLike.status, 200);
  assert.match(axiosLike.headers.get("Content-Type"), /^text\/html/);
  const browser = await get("/no-such-page/", { Accept: "text/html" });
  assert.equal(browser.status, 404);
  assert.match(browser.headers.get("Content-Type"), /^text\/html/);
});

test("openapi: valid 3.1 shape, unique operationIds, every operation described and implemented", async () => {
  const r = await get("/openapi.json");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /^application\/json/);
  const doc = await r.json();
  assert.deepEqual(doc, JSON.parse(JSON.stringify(openapi)));
  assert.equal(doc.openapi, "3.1.0");
  assert.ok(doc.info.title.includes("DevShipIt"));
  assert.deepEqual(await (await get("/api/v1/openapi.json")).json(), doc);
  const ids = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(item)) {
      ids.push(op.operationId);
      assert.ok(op.description && op.description.length > 30, `${op.operationId} has a description`);
      assert.ok(op.summary, `${op.operationId} has a summary`);
      assert.ok(op.responses["200"].content, `${op.operationId} has a typed 200 response`);
      assert.ok(op.responses.default, `${op.operationId} documents errors`);
      for (const p of op.parameters || []) assert.ok(p.schema && p.schema.type && p.description, `${op.operationId}.${p.name} is typed`);
      let concrete = path.replace("{slug}", "jantahr");
      if (op.operationId === "getPage") concrete += "?path=/pricing/";
      const res = await get(`/api/v1${concrete === "/" ? "" : concrete}`, {}, { method: method.toUpperCase() });
      assert.equal(res.status, 200, `${method.toUpperCase()} ${concrete} is implemented`);
    }
  }
  assert.equal(new Set(ids).size, ids.length, "operationIds are unique");
  assert.deepEqual(doc.components.schemas.Problem.properties.code.enum, Object.keys(ERRORS));
  const refs = JSON.stringify(doc).match(/#\/components\/(schemas|responses)\/[A-Za-z]+/g);
  for (const ref of refs) {
    const [, , kind, name] = ref.split("/");
    assert.ok(doc.components[kind][name], `${ref} resolves`);
  }
});

test("api-catalog (RFC 9727) and service-desc links (RFC 8631)", async () => {
  const r = await get("/.well-known/api-catalog");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Content-Type"), 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"');
  assert.match(r.headers.get("Link"), /rel="api-catalog"/);
  const j = await r.json();
  assert.deepEqual(j, apiCatalog);
  assert.equal(j.linkset[0]["service-desc"][0].href, "https://devshipit.com/openapi.json");
  assert.equal((await get("/.well-known/api-catalog", {}, { method: "HEAD" })).status, 200);
  const home = await get("/", { Accept: "text/html" });
  const link = home.headers.get("Link");
  assert.match(link, /<https:\/\/devshipit\.com\/openapi\.json>; rel="service-desc"/);
  assert.match(link, /rel="api-catalog"/);
  assert.match(await home.text(), /<link rel="service-desc" type="application\/json" href="\/openapi\.json"/);
});

test("no response repeats text from the address (stops anyone making devshipit.com show their message)", async () => {
  const bait = "Your account is locked call +1-800-555-0100";
  const enc = encodeURIComponent(bait);
  const paths = [`/${enc}`, `/${enc}/`, `/${enc}/index.md`, `/work/${enc}`, `/api/v1/projects/${enc}`, `/api/v1/projects/abc${enc.slice(0, 20)}`,
    `/api/v1/page?path=/${enc}/`, `/api/v1/${enc}`, `/?q=${enc}`];
  for (const p of paths) {
    for (const accept of ["text/html", "application/json", "text/markdown", "text/plain", "*/*"]) {
      const r = await get(p, { Accept: accept });
      const body = await r.text();
      assert.ok(!body.includes(bait) && !body.includes("1-800-555-0100") && !body.toLowerCase().includes("account is locked"), `${p} (${accept}) echoed the address`);
    }
  }
});
