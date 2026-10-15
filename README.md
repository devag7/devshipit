# devshipit.com

Source for [devshipit.com](https://devshipit.com), the portfolio and product site of Dev Agarwalla.

Plain HTML and CSS in `public/`, served by a small Cloudflare Worker (`src/`).

## Deploying

Cloudflare Workers Builds is connected to this repository. A push to `main` deploys the site; there is nothing to run by hand.

- Worker name: `odd-fog-f7c1` (see `wrangler.jsonc`)
- Custom domains: `devshipit.com` and `www.devshipit.com` (www redirects to the apex)

## What the Worker does

Static files come from the assets binding. The Worker runs first on every request and adds:

- **Markdown for agents.** A page requested with `Accept: text/markdown` gets its Markdown twin (`index.md` next to each `index.html`) with `Content-Type: text/markdown` and `Vary: Accept`. HTML responses also carry `Vary: Accept`. q-values are honoured; a client that accepts neither format gets 406.
- **Agent-friendly errors.** Unknown paths return 404: the HTML 404 page for browsers, a short Markdown explanation for agents, and RFC 9457 problem details (`application/problem+json`, with `code` and `hint`) for clients that prefer JSON. A page asked for only as JSON gets a 406 problem pointing at the API.
- **JSON API.** `GET /api/v1/*` is a public, read-only API (`src/api.js`): profile, projects, services, FAQ, contact and every page as Markdown. It is described by OpenAPI 3.1 at `/openapi.json` (`src/openapi.js`), listed in `/.well-known/api-catalog` (RFC 9727) and advertised with `Link: rel="service-desc"` (RFC 8631) on every page.
- **MCP server.** `POST /mcp` is a public, read-only Model Context Protocol server (Streamable HTTP, JSON responses, no sign-in) with the tools `get_profile`, `list_projects`, `list_services`, `get_faq`, `list_pages`, `get_page` and `get_contact`. Its data comes from `public/agent/site.json` and the Markdown pages. Discovery: `/.well-known/mcp/server-card.json` (also `/.well-known/mcp`, `/.well-known/mcp.json`, `/.well-known/mcp/server-cards.json`).
- **Headers.** Security headers (CSP and friends) and cache rules, because `_headers` does not apply once a Worker runs first.

Machine-readable files: `/llms.txt` (with when-to-use guidance), `/llms-full.txt`, `/sitemap.xml`, `/robots.txt`, `/site.webmanifest`, and JSON-LD on every page (Person, ProfessionalService, WebSite, FAQPage, BreadcrumbList, the product behind each case study).

## CLI

`cli/` is the `devshipit` command-line client for the API, with no dependencies: `npx github:devag7/devshipit projects`. See `cli/README.md`. To publish it to npm: `cd cli && npm publish` (needs an npm account).

## Search engines

`.github/workflows/indexnow.yml` waits for each deploy that touches `public/`, then submits the sitemap URLs to IndexNow (Bing and others) with the key file in `public/`. Run it by hand with `npm run indexnow`.

## Editing

Edit any file under `public/`, commit to `main`, and the live site updates within a minute or two. Shared styles are in `public/assets/site.css`; icons are symbols in `public/assets/icons.svg`.

When you change a page's text, change its `index.md` too, and `public/llms.txt` or `public/agent/site.json` if the change affects them. The tests check that every page has a Markdown twin with the same H1.

## Tests

```
npm test                       # negotiation, Worker, API, OpenAPI, MCP, CLI, SEO and generated-file checks
npx wrangler dev               # run the Worker locally on http://localhost:8787
npm run verify                 # check the live site (or: node scripts/verify-live.mjs http://localhost:8787)
```
