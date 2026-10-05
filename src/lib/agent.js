import { makeMcp, parseOutline } from "./mcp.js";
import { auditAnswer, openIssuesFor } from "./audit.js";

const MAX_STEPS = 6;
const MAX_QUESTION = 600;

const SYSTEM = (ctx) => `You answer developer questions about AI agent framework selection using ONLY a Sanity Context Knowledge Base, through two tools: kb_search and kb_read.
${ctx}

Process: search, then read the entries you need, then give a final answer. Never answer from memory.
Final answer must be ONE JSON object and nothing else:
{"verdict":"answer"|"conflict"|"unknown"|"needs_constraint","summary":"short plain-English answer","claims":[{"text":"...","entry":"<entry path you read>","quote":"<exact sentence copied from that entry>"}],"conflicts":[{"topic":"...","sides":[{"claim":"...","entry":"<path>","quote":"<exact text>"},{"claim":"...","entry":"<path>","quote":"<exact text>"}]}],"unknown":["things the KB does not say"],"question":"one concrete constraint question, or empty"}
Rules: every quote must be copied verbatim from an entry you read. If two retrieved statements disagree, or an entry's own labels disagree with its prose, use verdict "conflict" and show both sides. If the KB lacks evidence, use "unknown". Do not invent benchmarks, prices or dates.`;

export async function ask(question, env, deps = {}) {
  const q = String(question ?? "").trim();
  if (!q) return { status: 400, body: { error: "Ask a question." } };
  if (q.length > MAX_QUESTION) return { status: 400, body: { error: `Keep questions under ${MAX_QUESTION} characters.` } };

  const mcp = deps.mcp ?? makeMcp({ url: env.CONTEXT_MCP_URL, token: env.SANITY_ORG_TOKEN });
  const llm = deps.llm ?? ((messages, tools) => callOpenRouter(env, messages, tools));
  const trace = [];
  const entriesRead = {};

  let initial, outline;
  try {
    initial = await mcp.initialContext();
    outline = parseOutline(initial);
    trace.push({ step: "initial_context", kb: outline.kb, entries: outline.paths.length });
  } catch (e) {
    return { status: 502, body: { error: "The knowledge base is unreachable, so no answer is given.", detail: e.message, trace } };
  }
  if (!outline.kb) return { status: 502, body: { error: "Knowledge base outline not recognised.", trace } };

  const tools = [
    { type: "function", function: { name: "kb_search", description: "Keyword search over KB entries; returns ranked entry paths.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
    { type: "function", function: { name: "kb_read", description: "Read full entries by path.", parameters: { type: "object", properties: { paths: { type: "array", items: { type: "string" } } }, required: ["paths"] } } },
  ];
  const messages = [{ role: "system", content: SYSTEM(initial) }, { role: "user", content: q }];

  let final = null;
  for (let step = 0; step < MAX_STEPS && !final; step++) {
    let msg;
    try { msg = await llm(messages, tools); }
    catch (e) { return { status: 503, body: { error: "The language model is unavailable, so no answer is given.", detail: e.message, trace } }; }
    messages.push(msg);
    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        let args = {}; try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
        let out;
        try {
          if (tc.function.name === "kb_search") {
            out = await mcp.search(outline.kb, String(args.query ?? "").slice(0, 200));
            trace.push({ step: "knowledge_base_search", query: args.query });
          } else if (tc.function.name === "kb_read") {
            const paths = (args.paths ?? []).filter((p) => outline.paths.includes(p)).slice(0, 4);
            const parts = await Promise.all(paths.map(async (p) => [p, await mcp.read(outline.kb, [p])]));
            for (const [p, t] of parts) entriesRead[p] = t;
            out = parts.map(([p, t]) => `## ENTRY ${p}\n${t}`).join("\n\n") || "No valid paths.";
            trace.push({ step: "knowledge_base_read", paths });
          } else out = "Unknown tool.";
        } catch (e) { out = `Tool error: ${e.message}`; trace.push({ step: "tool_error", message: e.message }); }
        messages.push({ role: "tool", tool_call_id: tc.id, content: out });
      }
    } else final = msg.content ?? "";
  }
  if (final === null) return { status: 504, body: { error: "The agent did not finish within its step limit.", trace } };

  const draft = parseJson(final);
  if (!draft) return { status: 502, body: { error: "The model did not return a structured answer.", trace } };
  if (!Object.keys(entriesRead).length) {
    return { status: 200, body: { verdict: "unknown", summary: "The agent read no knowledge base entries, so it makes no claims.", claims: [], conflicts: [], unknown: draft.unknown ?? [], openIssues: [], dropped: [], trace } };
  }

  const audit = auditAnswer(draft, entriesRead);
  const issues = openIssuesFor(q, entriesRead, draft);
  let verdict = draft.verdict;
  if (issues.length) verdict = "conflict";
  else if (verdict === "answer" && !audit.verifiedClaims.length) verdict = "unknown";
  return {
    status: 200,
    body: {
      verdict,
      summary: issues.length ? "This topic has an unresolved conflict in the knowledge base. The agent will not pick a side." : draft.summary,
      claims: audit.verifiedClaims,
      conflicts: audit.verifiedConflicts,
      openIssues: issues.map(({ match, ...rest }) => rest),
      unknown: draft.unknown ?? [],
      question: draft.question ?? "",
      dropped: audit.droppedClaims,
      trace,
    },
  };
}

function parseJson(text) {
  const m = /\{[\s\S]*\}/.exec(text);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function callOpenRouter(env, messages, tools) {
  const models = (env.OPENROUTER_MODELS || "nvidia/nemotron-3-super-120b-a12b:free").split(",").map((s) => s.trim());
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, tools, temperature: 0.1 }),
      });
      if (res.ok) {
        const j = await res.json();
        const m = j.choices?.[0]?.message;
        if (m) return { role: "assistant", content: m.content ?? "", tool_calls: m.tool_calls };
        lastErr = new Error("empty completion");
      } else {
        const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 240);
        lastErr = new Error(`OpenRouter ${res.status} for ${model}: ${why}`);
        if (res.status !== 429 && res.status < 500) break;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
