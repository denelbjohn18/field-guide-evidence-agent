import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import { handle } from "../src/worker.js";
const env = {
  CONTEXT_MCP_URL: process.env.CONTEXT_MCP_URL || "https://api.sanity.io/v1/context/organizations/ow7ag3fuf/mcp/agent-framework-field-guide",
  SANITY_ORG_TOKEN: process.env.SANITY_ORG_TOKEN || fs.readFileSync(os.homedir() + "/.secrets/sanity_org_token", "utf8").trim(),
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || (fs.existsSync(os.homedir() + "/.secrets/openrouter_key") ? fs.readFileSync(os.homedir() + "/.secrets/openrouter_key", "utf8").trim() : ""),
  OPENROUTER_MODELS: process.env.OPENROUTER_MODELS,
};
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await handle(new Request("http://localhost" + req.url, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(Number(process.env.PORT || 8788), () => console.log("dev server on", process.env.PORT || 8788));
