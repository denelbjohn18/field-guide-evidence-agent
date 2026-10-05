// Minimal MCP-over-HTTP client for the Sanity Context knowledge-base endpoint.
// Every call is a JSON-RPC request with a Bearer token. The token never leaves the server.
let rpcId = 0;

export function makeMcp({ url, token, fetchImpl = fetch }) {
  async function rpc(method, params) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    });
    const text = await res.text();
    if (!res.ok) throw new McpError(`MCP HTTP ${res.status}`, res.status);
    let body;
    try { body = JSON.parse(text); } catch { throw new McpError("MCP returned non-JSON", 502); }
    if (body.error) throw new McpError(`MCP error ${body.error.code}: ${body.error.message}`, 502);
    return body.result;
  }
  async function callTool(name, args) {
    const result = await rpc("tools/call", { name, arguments: args });
    if (result.isError) throw new McpError(`tool ${name} failed`, 502);
    return (result.content || []).map((c) => c.text || "").join("\n");
  }
  return {
    initialContext: () => callTool("initial_context", {}),
    search: (knowledgeBase, query, limit = 5) =>
      callTool("knowledge_base_search", { knowledgeBase, query, limit }),
    read: (knowledgeBase, paths) => callTool("knowledge_base_read", { knowledgeBase, paths }),
  };
}

export class McpError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// Outline lines look like "framework_selection/microsoft_ecosystem [core]".
export function parseOutline(initialContextText) {
  const kb = /Knowledge base id: `(kb[A-Za-z0-9]+)`/.exec(initialContextText)?.[1] ?? null;
  const paths = [];
  for (const line of initialContextText.split("\n")) {
    const m = /^([a-z0-9_]+(?:\/[a-z0-9_]+)*)(?: \[[a-z]+\])?\s*$/.exec(line.trim());
    if (m) paths.push(m[1]);
  }
  return { kb, paths };
}

// knowledge_base_read returns entries separated by a line with "---". Split on "# Title" headings.
export function splitEntries(readText, requestedPaths) {
  const parts = readText.split(/\n---\n/).map((s) => s.trim()).filter(Boolean);
  const out = {};
  parts.forEach((p, i) => { out[requestedPaths[i] ?? `entry_${i}`] = p; });
  return out;
}
