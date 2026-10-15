# DevShipIt for developers and AI agents

> How developers and AI agents can read devshipit.com: Markdown for every page, llms.txt, and a public read-only MCP server, plus the developer tools Dev Agarwalla has published.

Every page on devshipit.com can be read as Markdown, the site has an llms.txt, and a public MCP server answers questions about Dev's work.

## Read any page as Markdown

Send `Accept: text/markdown` with a request for any page and you get Markdown instead of HTML, with `Vary: Accept` on both. You can also open the Markdown file directly by adding `index.md` to a page URL, for example </pricing/index.md>.

`curl -H "Accept: text/markdown" https://devshipit.com/`

A path that does not exist returns 404, with a Markdown explanation when Markdown was asked for.

## llms.txt

</llms.txt> describes the site, says when an agent should use it and lists every page. </llms-full.txt> holds the full text of every page in one file.

## MCP server

A public, read-only Model Context Protocol server runs at `https://devshipit.com/mcp` over Streamable HTTP. It needs no sign-in and does not store anything you send.

- `get_profile`: who Dev is, what he works with and what he is looking for
- `list_projects`: JantaHR, RentWise, linkedin-mcp and ISP Evidence with their status and links
- `list_pages` and `get_page`: every public page as Markdown
- `get_contact`: which email address to use for hiring, freelance work or JantaHR

Add it to Claude Code with `claude mcp add --transport http devshipit https://devshipit.com/mcp`, or to any client that accepts a remote server URL. The discovery document is at </.well-known/mcp/server-card.json>.

## Published developer tools

- [linkedin-mcp-tools](https://www.npmjs.com/package/linkedin-mcp-tools) on npm: a 36-tool LinkedIn integration for AI assistants, with caching, rate limiting and retries. [Case study](https://devshipit.com/work/linkedin-mcp/).
- [JantaHR developer docs](https://jantahr.devshipit.com/developers): the REST API with its [OpenAPI specification](https://jantahr.devshipit.com/openapi.json), and JantaHR's own MCP server for plans, pages and contact details.
- [github.com/devag7](https://github.com/devag7): source for JantaHR, RentWise and linkedin-mcp.

## Questions

Email [hello@devshipit.com](mailto:hello@devshipit.com).

---

Canonical page: https://devshipit.com/developers/  
Site guide for agents: https://devshipit.com/llms.txt  
Contact: hello@devshipit.com
