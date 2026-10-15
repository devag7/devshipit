import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
import { CARD_PATHS } from "../src/app.js";
import { ASSETS } from "./assets-mock.mjs";

const env = { ASSETS };
const rpc = (body, headers = {}) => worker.fetch(new Request("https://devshipit.com/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
}), env);
const call = async (id, method, params) => (await (await rpc({ jsonrpc: "2.0", id, method, params })).json());

test("initialize negotiates the protocol version and names the server", async () => {
  const r = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /application\/json/);
  const j = await r.json();
  assert.equal(j.result.protocolVersion, "2025-06-18");
  assert.equal(j.result.serverInfo.name, "devshipit");
  assert.deepEqual(j.result.capabilities, { tools: { listChanged: false } });
  const odd = await call(2, "initialize", { protocolVersion: "1999-01-01" });
  assert.equal(odd.result.protocolVersion, "2025-06-18");
});

test("notifications are accepted with 202 and no body", async () => {
  const r = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(r.status, 202);
  assert.equal(await r.text(), "");
});

test("tools/list exposes read-only tools with schemas", async () => {
  const j = await call(3, "tools/list", {});
  const names = j.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["get_contact", "get_faq", "get_page", "get_profile", "list_pages", "list_projects", "list_services"]);
  for (const t of j.result.tools) {
    assert.equal(t.inputSchema.type, "object");
    assert.equal(t.annotations.readOnlyHint, true);
  }
});

test("tools/call returns real site content", async () => {
  const profile = await call(4, "tools/call", { name: "get_profile", arguments: {} });
  assert.equal(profile.result.isError, false);
  assert.equal(profile.result.structuredContent.name, "Dev Agarwalla");
  const projects = await call(5, "tools/call", { name: "list_projects", arguments: {} });
  assert.deepEqual(projects.result.structuredContent.items.map((p) => p.name), ["JantaHR", "RentWise", "linkedin-mcp", "ISP Evidence"]);
  const page = await call(6, "tools/call", { name: "get_page", arguments: { path: "/work/rentwise" } });
  assert.equal(page.result.isError, false);
  assert.match(page.result.content[0].text, /^# RentWise/);
  const contact = await call(7, "tools/call", { name: "get_contact", arguments: {} });
  assert.equal(contact.result.structuredContent.hiring_and_freelance, "hello@devshipit.com");
  const services = await call(71, "tools/call", { name: "list_services", arguments: {} });
  assert.equal(services.result.isError, false);
  assert.ok(services.result.structuredContent.services.length >= 4);
  assert.equal(services.result.structuredContent.process.length, 4);
  const faq = await call(72, "tools/call", { name: "get_faq", arguments: {} });
  assert.equal(faq.result.isError, false);
  assert.ok(faq.result.structuredContent.items.every((q) => q.question.endsWith("?") && q.answer.length > 20));
});

test("tool errors are reported in the result, protocol errors as JSON-RPC errors", async () => {
  const bad = await call(8, "tools/call", { name: "get_page", arguments: { path: "/secret/" } });
  assert.equal(bad.result.isError, true);
  const missing = await call(9, "tools/call", { name: "get_page", arguments: {} });
  assert.equal(missing.result.isError, true);
  const unknown = await call(10, "tools/call", { name: "nope", arguments: {} });
  assert.equal(unknown.error.code, -32602);
  const method = await call(11, "resources/list", {});
  assert.equal(method.error.code, -32601);
  const parse = await rpc("{not json");
  assert.equal(parse.status, 400);
  assert.equal((await parse.json()).error.code, -32700);
});

test("ping, unsupported protocol header, GET without a stream", async () => {
  assert.deepEqual((await call(12, "ping", {})).result, {});
  const v = await rpc({ jsonrpc: "2.0", id: 13, method: "ping" }, { "MCP-Protocol-Version": "1999-01-01" });
  assert.equal(v.status, 400);
  const g = await worker.fetch(new Request("https://devshipit.com/mcp", { headers: { Accept: "text/event-stream" } }), env);
  assert.equal(g.status, 405);
  assert.match(g.headers.get("Allow"), /POST/);
  const o = await worker.fetch(new Request("https://devshipit.com/mcp", { method: "OPTIONS" }), env);
  assert.equal(o.status, 204);
  assert.equal(o.headers.get("Access-Control-Allow-Origin"), "*");
});

test("server card is published at every discovery path", async () => {
  for (const p of CARD_PATHS) {
    const r = await worker.fetch(new Request(`https://devshipit.com${p}`), env);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("Content-Type"), /application\/json/);
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*");
    const card = await r.json();
    assert.equal(card.serverInfo.name, "devshipit");
    assert.equal(card.transport.type, "streamable-http");
    assert.equal(card.endpoint, "https://devshipit.com/mcp");
    assert.equal(card.remotes[0].url, "https://devshipit.com/mcp");
    assert.ok(card.tools.length === 7);
  }
});
