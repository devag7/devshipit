# linkedin-mcp

> Case study: linkedin-mcp, a 36-tool LinkedIn integration for AI assistants, published on npm as linkedin-mcp-tools.

A Model Context Protocol server that lets AI assistants work with LinkedIn through 36 tools, with the caching, rate limiting and retries you need to run it for real.

[View on npm](https://www.npmjs.com/package/linkedin-mcp-tools)

- **Role**: Design, development and publishing, solo
- **Built**: June 2026
- **Status**: Published on npm
- **Package**: linkedin-mcp-tools
- **Stack**: Node.js, MCP

## The problem

AI assistants are useful for job search and networking work, but they can only act on LinkedIn if something exposes it to them in a form they can call safely. I built that layer.

## What I built

- **36 tools** covering LinkedIn API operations, exposed through an MCP server.
- **LRU caching** so repeated lookups are fast and do not waste calls.
- **Rate limiting** to stay inside LinkedIn's limits instead of getting blocked.
- **Retry logic** so transient failures do not break a longer task.
- **Published to npm** as `linkedin-mcp-tools`, so it installs with one command.

---

Canonical page: https://devshipit.com/work/linkedin-mcp/  
Site guide for agents: https://devshipit.com/llms.txt  
Contact: hello@devshipit.com
