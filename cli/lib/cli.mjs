/**
 * devshipit: a small command-line client for the DevShipIt API (https://devshipit.com/api/v1).
 * No dependencies. `run()` takes its I/O as arguments so it can be tested without a network.
 */
export const VERSION = "1.0.0";
export const DEFAULT_BASE = "https://devshipit.com/api/v1";

export const EXIT = { ok: 0, api: 1, usage: 2, network: 3 };

export const USAGE = `devshipit ${VERSION}: Dev Agarwalla's work, services and contact details from devshipit.com

Usage
  devshipit <command> [argument] [--json]

Commands
  profile           Who Dev is, his experience and stack
  projects          Products and case studies
  project <slug>    One project, for example: devshipit project jantahr
  services          Freelance services and how a project works
  faq               Frequently asked questions
  contact           Which email address to use
  pages             Every public page of devshipit.com
  page <path>       One page as Markdown, for example: devshipit page /pricing/
  api               The API index and every endpoint

Options
  --json            Print the raw JSON from the API
  --base <url>      API base URL (default ${DEFAULT_BASE}, or $DEVSHIPIT_API)
  -h, --help        Show this help
  -v, --version     Show the version

Exit codes: 0 success, 1 API error, 2 usage error, 3 network error.
Docs: https://devshipit.com/developers/#cli`;

const COMMANDS = {
  profile: { path: () => "/profile" },
  projects: { path: () => "/projects" },
  project: { arg: "slug", path: (a) => `/projects/${encodeURIComponent(a)}` },
  services: { path: () => "/services" },
  faq: { path: () => "/faq" },
  contact: { path: () => "/contact" },
  pages: { path: () => "/pages" },
  page: { arg: "path", path: (a) => `/page?path=${encodeURIComponent(a)}` },
  api: { path: () => "/" },
};

/** Parses argv (without node and the script path). Returns { command, arg, json, base, help, version } or { error }. */
export function parseArgs(argv, env = {}) {
  const out = { command: null, arg: null, json: false, base: env.DEVSHIPIT_API || DEFAULT_BASE, help: false, version: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if (a === "-v" || a === "--version") out.version = true;
    else if (a === "--base") {
      if (!argv[i + 1]) return { error: "--base needs a URL" };
      out.base = argv[++i];
    } else if (a.startsWith("--base=")) out.base = a.slice(7);
    else if (a.startsWith("-") && a !== "-") return { error: `Unknown option: ${a}` };
    else rest.push(a);
  }
  out.base = out.base.replace(/\/+$/, "");
  [out.command = null, out.arg = null] = rest;
  if (rest.length > 2) return { error: `Too many arguments: ${rest.slice(2).join(" ")}` };
  return out;
}

const line = (label, value) => (value ? `${label}: ${value}` : null);
const block = (...rows) => rows.filter(Boolean).join("\n");

/** Human-readable output for each command. */
export const format = {
  profile: (p) => block(`${p.name} (${p.brand})`, p.role + ", " + p.location, "", line("Now", p.current_role), line("Freelance", p.freelance), (p.experience || []).length ? "\nExperience\n" + p.experience.map((e) => `  ${e.organisation}, ${e.role} (${e.dates})`).join("\n") + "\n" : null, line("Stack", (p.stack || []).join(", ")), line("Site", p.site), line("GitHub", p.github), line("LinkedIn", p.linkedin)),
  project: (p) => block(`${p.name} [${p.status}]`, p.summary, "", line("Stack", (p.stack || []).join(", ")), line("Live", p.url), line("Source", p.source), line("Case study", p.case_study)),
  projects: (d) => d.projects.map((p) => block(`${p.name} [${p.status}]  (devshipit project ${p.slug})`, `  ${p.summary}`, `  ${p.case_study}`)).join("\n\n"),
  services: (d) => block(
    ...d.services.map((s) => `- ${s.name}: ${s.summary}`),
    "",
    "Every project is priced by a written quote before work starts. Start with: devshipit contact",
  ),
  faq: (d) => d.questions.map((q) => `${q.question}\n  ${q.answer}`).join("\n\n"),
  contact: (c) => block(line("Freelance and general", c.hiring_and_freelance), line("JantaHR support, billing and legal", c.jantahr_support_billing_legal), line("Contact page", c.contact_page), c.note ? `\n${c.note}` : null),
  pages: (d) => d.pages.map((p) => `${p.path.padEnd(22)} ${p.title}`).join("\n"),
  page: (p) => p.markdown.trimEnd(),
  api: (d) => block(`${d.name} ${d.version}`, d.description, "", ...d.endpoints.map((e) => `  ${e}`), "", line("OpenAPI", d.openapi), line("Docs", d.docs)),
};

/**
 * Runs the CLI. io = { fetch, stdout(text), stderr(text), env }. Resolves to an exit code.
 */
export async function run(argv, io) {
  const { stdout, stderr } = io;
  const args = parseArgs(argv, io.env || {});
  if (args.error) { stderr(`${args.error}\n\nRun devshipit --help for usage.`); return EXIT.usage; }
  if (args.version) { stdout(VERSION); return EXIT.ok; }
  if (args.help || !args.command) { stdout(USAGE); return args.command || args.help ? EXIT.ok : EXIT.usage; }
  const cmd = COMMANDS[args.command];
  if (!cmd) { stderr(`Unknown command: ${args.command}\n\nRun devshipit --help for the list of commands.`); return EXIT.usage; }
  if (cmd.arg && !args.arg) { stderr(`devshipit ${args.command} needs a ${cmd.arg}. Example: devshipit ${args.command} ${cmd.arg === "slug" ? "jantahr" : "/pricing/"}`); return EXIT.usage; }

  const url = args.base + cmd.path(args.arg);
  let res;
  try {
    res = await io.fetch(url, { headers: { Accept: "application/json", "User-Agent": `devshipit-cli/${VERSION}` } });
  } catch (e) {
    stderr(`Could not reach ${url}: ${e && e.message ? e.message : e}\nCheck your connection, or set --base.`);
    return EXIT.network;
  }
  let body;
  try { body = await res.json(); } catch {
    stderr(`Unexpected response from ${url} (HTTP ${res.status}): not JSON.`);
    return EXIT.api;
  }
  if (!res.ok) {
    if (args.json) stdout(JSON.stringify(body, null, 2));
    stderr(block(`Error ${res.status}${body.code ? ` (${body.code})` : ""}: ${body.detail || body.title || "request failed"}`, body.hint ? `Hint: ${body.hint}` : null));
    return EXIT.api;
  }
  stdout(args.json ? JSON.stringify(body, null, 2) : format[args.command](body));
  return EXIT.ok;
}
