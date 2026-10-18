/**
 * A small Model Context Protocol server core: JSON-RPC 2.0 over the Streamable HTTP transport, stateless, tools only.
 * Spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
 * The same core runs JantaHR's public MCP server; this is its JavaScript port.
 */

export const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const MCP_DEFAULT_VERSION = "2025-06-18";

const fail = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** Handles one JSON-RPC message. Notifications and responses (no method with an id) get no reply: null. */
export async function handleMcpMessage(message, server) {
  if (!isObject(message) || message.jsonrpc !== "2.0") return fail(null, -32600, "Invalid Request");
  if (typeof message.method !== "string") {
    // a response sent by the client (to a server request we never make): accept and ignore
    if ("result" in message || "error" in message) return null;
    return fail(null, -32600, "Invalid Request");
  }
  const hasId = typeof message.id === "string" || typeof message.id === "number";
  if (!hasId) return null;
  const id = message.id;
  const params = isObject(message.params) ? message.params : {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });

  switch (message.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return ok({
        protocolVersion: MCP_PROTOCOL_VERSIONS.includes(asked) ? asked : MCP_DEFAULT_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: server.info,
        instructions: server.instructions,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({
        tools: server.tools.map(({ name, title, description, inputSchema }) => ({
          name, title, description, inputSchema,
          annotations: { title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const tool = server.tools.find((t) => t.name === params.name);
      if (!tool) return fail(id, -32602, "Unknown tool. Call tools/list for the available tools.");
      const args = isObject(params.arguments) ? params.arguments : {};
      const missing = (tool.inputSchema.required || []).filter((k) => args[k] === undefined || args[k] === null || args[k] === "");
      if (missing.length) return ok({ content: [{ type: "text", text: `Missing required argument: ${missing.join(", ")}` }], isError: true });
      try {
        const out = await tool.call(args);
        const text = typeof out === "string" ? out : JSON.stringify(out, null, 2);
        const result = { content: [{ type: "text", text }], isError: false };
        if (typeof out !== "string") result.structuredContent = Array.isArray(out) ? { items: out } : out;
        return ok(result);
      } catch (e) {
        return ok({ content: [{ type: "text", text: e instanceof Error ? e.message : "The tool failed." }], isError: true });
      }
    }
    default:
      return fail(id, -32601, "Method not found.");
  }
}

/** Handles a POST body: one message or a batch. body null = only notifications or responses: 202 Accepted. */
export async function handleMcpPayload(payload, server) {
  if (Array.isArray(payload)) {
    if (!payload.length) return { status: 400, body: fail(null, -32600, "Invalid Request") };
    const replies = (await Promise.all(payload.map((m) => handleMcpMessage(m, server)))).filter((r) => r !== null);
    return replies.length ? { status: 200, body: replies } : { status: 202, body: null };
  }
  const reply = await handleMcpMessage(payload, server);
  if (!reply) return { status: 202, body: null };
  return { status: reply.error && reply.id === null ? 400 : 200, body: reply };
}

/** Discovery document: where the server is and what it offers, without a handshake. */
export function mcpServerCard(server, endpoint, more) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    version: "1.0",
    name: more.registryName,
    title: server.info.title,
    description: more.description,
    websiteUrl: more.website,
    documentationUrl: more.documentation,
    protocolVersion: MCP_DEFAULT_VERSION,
    supportedProtocolVersions: MCP_PROTOCOL_VERSIONS,
    serverInfo: server.info,
    endpoint,
    transport: { type: "streamable-http", endpoint },
    remotes: [{ type: "streamable-http", url: endpoint }],
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false, schemes: [] },
    instructions: server.instructions,
    tools: server.tools.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })),
  };
}
