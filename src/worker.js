import { ask } from "./lib/agent.js";
import { page } from "./ui.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function handle(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/" && request.method === "GET")
    return new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
  if (url.pathname === "/api/health") return json({ ok: true, liveAnswers: Boolean(env.SANITY_ORG_TOKEN && env.OPENROUTER_API_KEY) });
  if (url.pathname === "/api/ask" && request.method === "POST") {
    if (!env.SANITY_ORG_TOKEN || !env.OPENROUTER_API_KEY) return json({ error: "Live answers are not configured on this deployment." }, 503);
    let body; try { body = await request.json(); } catch { return json({ error: "Send JSON: {\"question\":\"...\"}" }, 400); }
    const r = await ask(body.question, env);
    return json(r.body, r.status);
  }
  return json({ error: "Not found" }, 404);
}

export default { fetch: (req, env) => handle(req, env) };
