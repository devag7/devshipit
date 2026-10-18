# DevShipIt for developers and AI agents

> The DevShipIt public API with its OpenAPI 3.1 document, the devshipit command-line tool, the MCP server, llms.txt and Markdown for every page of devshipit.com.

A public JSON API with an OpenAPI 3.1 document, a command-line tool, an MCP server, llms.txt, and Markdown for every page. No sign-in, read-only.

[OpenAPI document](https://devshipit.com/openapi.json) [Try the API](https://devshipit.com/api/v1)

## DevShipIt API

A read-only JSON API at `https://devshipit.com/api/v1` with the same facts as the site. It needs no key, sends `Access-Control-Allow-Origin: *`, and is described by an OpenAPI 3.1 document at </openapi.json>, where every operation has an `operationId`, typed parameters and response schemas. The API catalog is at </.well-known/api-catalog> (RFC 9727).

`curl https://devshipit.com/api/v1/projects/jantahr`

| Endpoint | operationId | Returns |
| --- | --- | --- |
| `GET /api/v1/` | `getApiIndex` | API name, version and every endpoint |
| `GET /api/v1/profile` | `getProfile` | Who Dev is, his experience and stack |
| `GET /api/v1/projects` | `listProjects` | JantaHR, RentWise, linkedin-mcp and ISP Evidence |
| `GET /api/v1/projects/{slug}` | `getProject` | One project, for example jantahr |
| `GET /api/v1/services` | `listServices` | Freelance services |
| `GET /api/v1/faq` | `listFaq` | Frequently asked questions with answers |
| `GET /api/v1/contact` | `getContact` | Which email address to use |
| `GET /api/v1/pages` | `listPages` | Every public page |
| `GET /api/v1/page?path=/pricing/` | `getPage` | One page as Markdown |

To use it as tools for a model with function calling, load the OpenAPI document: each `operationId` becomes a function name and its description says when to call it.

## Errors

Every error is RFC 9457 problem details, sent as `application/problem+json`, with three extra members: `code` (stable and machine-readable), `hint` (what to do next) and `docs`. Errors never repeat the request path or parameters back. The `type` URI of each error opens its row below. Clients that ask for JSON also get problem details for a missing page or file anywhere on the site.

`{"type": "https://devshipit.com/developers/#error-project_not_found", "title": "Project not found", "status": 404, "detail": "There is no project with that slug. Valid slugs: jantahr, rentwise, linkedin-mcp, isp-evidence.", "code": "project_not_found", "hint": "Call GET /api/v1/projects for the valid slugs.", "docs": "https://devshipit.com/developers/"}`

| code | Status | Meaning | What to do |
| --- | --- | --- | --- |
| `not_found` | 404 | No endpoint, page or file at that path. | List what exists with GET /api/v1/ or read /openapi.json. |
| `project_not_found` | 404 | No project with that slug. | Call GET /api/v1/projects for the valid slugs. |
| `page_not_found` | 404 | No public page at that path. | Call GET /api/v1/pages for the valid paths. |
| `missing_parameter` | 400 | A required query parameter is missing. | Add it and retry, for example ?path=/pricing/. |
| `invalid_parameter` | 400 | A parameter has the wrong format. | Check the format in the OpenAPI document. |
| `method_not_allowed` | 405 | The API is read-only. | Use GET or HEAD. |
| `not_acceptable` | 406 | A page was asked for as JSON. | Use /api/v1/page?path=..., or ask for text/html or text/markdown. |
| `unavailable` | 503 | The site data could not be loaded. | Retry after the Retry-After header. |

## Command-line tool

The `devshipit` CLI reads the API from a terminal. It needs Node.js 20 or newer and has no dependencies.

`npx github:devag7/devshipit projects`

- `devshipit profile`, `devshipit projects`, `devshipit project jantahr`
- `devshipit services`, `devshipit faq`, `devshipit contact`
- `devshipit pages` and `devshipit page /pricing/` to print a page as Markdown
- Add `--json` to any command for raw JSON. Errors exit with code 1 and print the API's `code` and `hint`.

Source: [github.com/devag7/devshipit/tree/main/cli](https://github.com/devag7/devshipit/tree/main/cli).

## MCP server

A public, read-only Model Context Protocol server runs at `https://devshipit.com/mcp` over Streamable HTTP. It needs no sign-in and does not store anything you send.

- `get_profile`: who Dev is, where he works, his experience and stack
- `list_projects`: JantaHR, RentWise, linkedin-mcp and ISP Evidence with their status and links
- `list_services` and `get_faq`: freelance services and answers to common questions
- `list_pages` and `get_page`: every public page as Markdown
- `get_contact`: which email address to use for freelance work, general enquiries or JantaHR

Add it to Claude Code with `claude mcp add --transport http devshipit https://devshipit.com/mcp`, or to any client that accepts a remote server URL. The discovery document is at </.well-known/mcp/server-card.json>.

## Read any page as Markdown

Send `Accept: text/markdown` with a request for any page and you get Markdown instead of HTML, with `Vary: Accept` on both. You can also open the Markdown file directly by adding `index.md` to a page URL, for example </pricing/index.md>.

`curl -H "Accept: text/markdown" https://devshipit.com/`

## llms.txt

</llms.txt> describes the site, says when an agent should use it and lists every page. </llms-full.txt> holds the full text of every page in one file.

## Published developer tools

- [linkedin-mcp-tools](https://www.npmjs.com/package/linkedin-mcp-tools) on npm: a 36-tool LinkedIn integration for AI assistants, with caching, rate limiting and retries. [linkedin-mcp case study](https://devshipit.com/work/linkedin-mcp/).
- [JantaHR developer docs](https://jantahr.devshipit.com/developers): the REST API with its [OpenAPI specification](https://jantahr.devshipit.com/openapi.json), and JantaHR's own MCP server for plans, pages and contact details.
- [github.com/devag7](https://github.com/devag7): source for JantaHR, RentWise, linkedin-mcp and this site.

## Questions

Email [hello@devshipit.com](mailto:hello@devshipit.com).

---

Canonical page: https://devshipit.com/developers/  
Site guide for agents: https://devshipit.com/llms.txt  
Contact: hello@devshipit.com
