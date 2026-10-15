import { test } from "node:test";
import assert from "node:assert/strict";
import { run, parseArgs, EXIT, VERSION, DEFAULT_BASE } from "../cli/lib/cli.mjs";
import worker from "../src/worker.js";
import { ASSETS } from "./assets-mock.mjs";

/** fetch that sends every request through the Worker, so the CLI is tested against the real API code. */
const viaWorker = (url, init) => worker.fetch(new Request(url, init), { ASSETS });

async function cli(...argv) {
  const out = [], err = [];
  const code = await run(argv, { fetch: viaWorker, stdout: (t) => out.push(t), stderr: (t) => err.push(t), env: {} });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

test("cli: argument parsing", () => {
  assert.deepEqual(parseArgs(["project", "jantahr", "--json"]), { command: "project", arg: "jantahr", json: true, base: DEFAULT_BASE, help: false, version: false });
  assert.equal(parseArgs(["pages", "--base=https://x.test/api/v1/"]).base, "https://x.test/api/v1");
  assert.equal(parseArgs([], { DEVSHIPIT_API: "https://y.test" }).base, "https://y.test");
  assert.ok(parseArgs(["--nope"]).error);
  assert.ok(parseArgs(["a", "b", "c"]).error);
});

test("cli: help, version and usage errors", async () => {
  assert.equal((await cli("--version")).out, VERSION);
  const help = await cli("--help");
  assert.equal(help.code, EXIT.ok);
  for (const c of ["profile", "projects", "project <slug>", "services", "faq", "contact", "pages", "page <path>"]) assert.match(help.out, new RegExp(c.replace(/[<>]/g, ".")));
  assert.equal((await cli()).code, EXIT.usage);
  const unknown = await cli("deploy");
  assert.equal(unknown.code, EXIT.usage);
  assert.match(unknown.err, /Unknown command: deploy/);
  const missing = await cli("project");
  assert.equal(missing.code, EXIT.usage);
  assert.match(missing.err, /needs a slug/);
});

test("cli: every command prints real data", async () => {
  const profile = await cli("profile");
  assert.equal(profile.code, 0);
  assert.match(profile.out, /^Dev Agarwalla \(DevShipIt\)/);
  const projects = await cli("projects");
  for (const n of ["JantaHR", "RentWise", "linkedin-mcp", "ISP Evidence"]) assert.match(projects.out, new RegExp(n));
  assert.match((await cli("project", "jantahr")).out, /JantaHR \[Live\]/);
  assert.match((await cli("services")).out, /written quote/);
  assert.match((await cli("faq")).out, /\?\n  /);
  assert.match((await cli("contact")).out, /hello@devshipit\.com/);
  assert.match((await cli("pages")).out, /\/pricing\//);
  assert.match((await cli("page", "/pricing/")).out, /^# Pricing/);
  assert.match((await cli("api")).out, /DevShipIt API/);
});

test("cli: --json prints the API body", async () => {
  const r = await cli("project", "rentwise", "--json");
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.out).slug, "rentwise");
});

test("cli: API errors exit 1 with the problem code and hint", async () => {
  const r = await cli("project", "nope");
  assert.equal(r.code, EXIT.api);
  assert.match(r.err, /Error 404 \(project_not_found\)/);
  assert.match(r.err, /Hint: /);
  const p = await cli("page", "/secret/");
  assert.equal(p.code, EXIT.api);
  assert.match(p.err, /page_not_found/);
});

test("cli: network failures exit 3", async () => {
  const err = [];
  const code = await run(["profile"], { fetch: async () => { throw new Error("offline"); }, stdout: () => {}, stderr: (t) => err.push(t), env: {} });
  assert.equal(code, EXIT.network);
  assert.match(err[0], /offline/);
});
