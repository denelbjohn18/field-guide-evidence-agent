import test from "node:test";
import assert from "node:assert/strict";
import { ask } from "../src/lib/agent.js";
import { quoteInEntry, auditAnswer } from "../src/lib/audit.js";
import { parseOutline } from "../src/lib/mcp.js";

const INITIAL = "# ctx\nKnowledge base id: `kbTEST`\n## Guide\n8 entries.\n\nframeworks [core]\n\nmigration\n\norchestration [core]\n";
const FRAMEWORKS = "# Framework Identity\n| Semantic Kernel | Microsoft | Python, .NET, Java | Migration | OSS package |\nLangGraph is a low-level graph runtime with explicit state, nodes, and edges.";
const mkMcp = (over = {}) => ({
  initialContext: async () => INITIAL,
  search: async () => "frameworks 3.2",
  read: async (_kb, [p]) => (p === "frameworks" ? FRAMEWORKS : "# other\nnothing"),
  ...over,
});
const script = (...steps) => { let i = 0; return async () => steps[i++]; };
const call = (name, args) => ({ role: "assistant", content: "", tool_calls: [{ id: "t" + Math.random(), function: { name, arguments: JSON.stringify(args) } }] });
const final = (obj) => ({ role: "assistant", content: JSON.stringify(obj) });

test("parseOutline reads kb id and entry paths", () => {
  const o = parseOutline(INITIAL);
  assert.equal(o.kb, "kbTEST");
  assert.deepEqual(o.paths, ["frameworks", "migration", "orchestration"]);
});

test("quote check is verbatim modulo markdown/whitespace, rejects fabrication", () => {
  assert.ok(quoteInEntry("LangGraph is a low-level graph runtime", FRAMEWORKS));
  assert.ok(!quoteInEntry("LangGraph is 3x faster than CrewAI in benchmarks", FRAMEWORKS));
  assert.ok(!quoteInEntry("short", FRAMEWORKS));
});

test("fabricated quote is dropped and answer degrades to unknown", async () => {
  const llm = script(call("kb_read", { paths: ["frameworks"] }),
    final({ verdict: "answer", summary: "x", claims: [{ text: "LangGraph is fastest", entry: "frameworks", quote: "LangGraph is the fastest framework in every benchmark" }] }));
  const r = await ask("Which is fastest?", {}, { mcp: mkMcp(), llm });
  assert.equal(r.body.verdict, "unknown");
  assert.equal(r.body.dropped.length, 1);
  assert.equal(r.body.claims.length, 0);
});

test("claim that quotes a read entry is kept", async () => {
  const llm = script(call("kb_read", { paths: ["frameworks"] }),
    final({ verdict: "answer", summary: "LangGraph is a graph runtime.", claims: [{ text: "graph runtime", entry: "frameworks", quote: "LangGraph is a low-level graph runtime with explicit state, nodes, and edges." }] }));
  const r = await ask("What is LangGraph?", {}, { mcp: mkMcp(), llm });
  assert.equal(r.body.verdict, "answer");
  assert.equal(r.body.claims.length, 1);
});

test("quote from an entry that was never read is rejected", async () => {
  const llm = script(final({ verdict: "answer", summary: "x", claims: [{ text: "t", entry: "frameworks", quote: "LangGraph is a low-level graph runtime" }] }));
  const r = await ask("What is LangGraph?", {}, { mcp: mkMcp(), llm });
  assert.equal(r.body.verdict, "unknown");
  assert.match(r.body.summary, /read no knowledge base entries/);
});

test("Semantic Kernel question forces conflict verdict with both sides, even if model says answer", async () => {
  const llm = script(call("kb_read", { paths: ["frameworks"] }),
    final({ verdict: "answer", summary: "SK is in migration.", claims: [{ text: "SK migration", entry: "frameworks", quote: "| Semantic Kernel | Microsoft | Python, .NET, Java | Migration |" }] }));
  const r = await ask("Should I start a new project on Semantic Kernel?", {}, { mcp: mkMcp(), llm });
  assert.equal(r.body.verdict, "conflict");
  assert.equal(r.body.openIssues.length, 1);
  assert.match(r.body.openIssues[0].sourceSide.claim, /active/);
  assert.match(r.body.summary, /will not pick a side/);
});

test("unrelated question does not trigger the open issue", async () => {
  const llm = script(call("kb_read", { paths: ["frameworks"] }),
    final({ verdict: "answer", summary: "ok", claims: [{ text: "t", entry: "frameworks", quote: "LangGraph is a low-level graph runtime" }] }));
  const r = await ask("Explain LangGraph", {}, { mcp: mkMcp(), llm });
  assert.equal(r.body.openIssues.length, 0);
});

test("KB unreachable: no answer, no model call", async () => {
  let called = false;
  const r = await ask("anything", {}, { mcp: mkMcp({ initialContext: async () => { throw new Error("MCP HTTP 401"); } }), llm: async () => { called = true; } });
  assert.equal(r.status, 502);
  assert.equal(called, false);
});

test("model unavailable returns an honest error, never an invented answer", async () => {
  const r = await ask("q", {}, { mcp: mkMcp(), llm: async () => { throw new Error("OpenRouter 429"); } });
  assert.equal(r.status, 503);
});

test("invalid paths requested by the model are ignored", async () => {
  const llm = script(call("kb_read", { paths: ["../../etc/passwd", "frameworks"] }), final({ verdict: "unknown", summary: "s", claims: [], unknown: ["x"] }));
  const r = await ask("q", {}, { mcp: mkMcp(), llm });
  assert.deepEqual(r.body.trace.find((t) => t.step === "knowledge_base_read").paths, ["frameworks"]);
});

test("empty and oversized questions rejected", async () => {
  assert.equal((await ask("  ", {}, {})).status, 400);
  assert.equal((await ask("x".repeat(601), {}, {})).status, 400);
});

test("two-sided conflict from the model needs both quotes verifiable", () => {
  const read = { frameworks: FRAMEWORKS };
  const a = auditAnswer({ conflicts: [{ topic: "t", sides: [{ claim: "a", entry: "frameworks", quote: "LangGraph is a low-level graph runtime" }, { claim: "b", entry: "frameworks", quote: "invented text that is not present" }] }] }, read);
  assert.equal(a.verifiedConflicts.length, 0);
});
