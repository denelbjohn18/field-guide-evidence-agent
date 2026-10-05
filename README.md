# Field Guide Evidence Agent

An agent that answers "which agent framework should I use?" using only a Sanity Knowledge Base, read live through Sanity Context (MCP). Built for the Sanity Challenge, Path One.

## What it does
- Calls the KB endpoint over MCP at request time: `initial_context`, `knowledge_base_search`, `knowledge_base_read`. A read-only Context Viewer token is used server-side only.
- The model proposes claims, each with a verbatim quote. Plain code (`src/lib/audit.js`) checks every quote against the entry text that was actually read. Unverifiable claims are dropped and shown as dropped.
- A dated register of the KB's open Issues forces a `conflict` verdict on affected topics. Today that is Semantic Kernel: the KB entry says "Migration", the updated source says "active". The agent shows both and does not pick.
- Price and benchmark questions return "unknown" because the KB says it holds no such evidence.

## Honest limits
- Sanity's MCP endpoint does not expose the KB Issues panel, so the open-issue register is hand-maintained (`OPEN_ISSUES` in `audit.js`).
- The KB has 8 entries from one source. It is small by design.
- Free OpenRouter models rate-limit. Eval results are in `docs/eval-results.json` once run, including failures.

## Run
Node 22. `npm ci`, `npm test`.
Local: set `SANITY_ORG_TOKEN` and `OPENROUTER_API_KEY`, then `npm run dev:node`.
Deploy: `wrangler secret put SANITY_ORG_TOKEN`, `wrangler secret put OPENROUTER_API_KEY`, `npm run deploy`.
Eval (live KB + model): `node scripts/eval.mjs 3`.
See `docs/RELEASE-GATES.md` for what must pass before this ships.

## Not in this package
Secrets, `node_modules`, build output.
