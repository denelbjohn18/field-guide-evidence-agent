---
title: An agent that refuses to guess: Sanity Context + Knowledge Base for framework choices
tags: sanitychallenge, ai, agents, cloudflare
status: DRAFT - not published. Items marked [PENDING] need a live run before this is posted.
---

## What I built
A small agent that answers "which agent framework should I use?" from one Sanity Knowledge Base and nothing else. Every claim it shows has a verbatim quote from a KB entry. When the KB contradicts itself, it shows both sides and stops.

Live demo: https://field-guide-evidence-agent.denelj-agents.workers.dev (API at /api/ask; free-tier model, so it may say it is unavailable when the daily limit is hit)
Code: https://github.com/denelbjohn18/field-guide-evidence-agent

## How it uses Sanity Context and the Knowledge Base
- The agent talks to the KB through its Sanity Context MCP endpoint at request time: `initial_context`, `knowledge_base_search`, `knowledge_base_read`. No local copy of the content.
- Knowledge Base: "Agent Framework Field Guide", 8 entries built from source documents about LangGraph, CrewAI, OpenAI Agents SDK, Microsoft Agent Framework, Vercel AI SDK, Semantic Kernel and AutoGen.
- Access uses a read-only Context Viewer token held server-side.

## The part I care about: the conflict
The KB has an open Issue. The "Framework Identity" entry lists Semantic Kernel's status as "Migration". The updated Semantic Kernel source says it is active and warns not to infer deprecation. Sanity flagged this and left it for a human to resolve.
Most agents would pick one and sound sure. This one shows both claims, with the quote from the entry, says the KB has not settled it, and does not recommend either way.
How: the model proposes claims with quotes. Plain code checks each quote against the entry text that was actually read. Anything it cannot find is dropped, and the UI says how many were dropped. A register of the KB's open Issues forces the "conflict" verdict on affected topics, even if the model sounds confident.

## Modeling and structure
The 8 entries are split by the question a reader is trying to answer, not by vendor:
- `framework_selection/microsoft_ecosystem` and `framework_selection/typescript_ui_stack`: decision entries ("I am on X, what do I pick?").
- `frameworks`: the identity table (language, owner, status) for every framework.
- `migration`, `multi_agent_coordination`, `orchestration`, `persistence_and_human_review`, `pricing_and_deployment`: one topic each.
This helps retrieval because a question like "which framework for a TypeScript web app" lands on one decision entry instead of being spread across vendor pages. It also made the conflict visible: the status of Semantic Kernel lives in one table row in `frameworks` and is restated in `migration`, so the agent reads both and can quote both.

## Does it work
I wrote a 24-probe set before tuning the agent further, then ran it live against the deployed Worker with a free OpenRouter model. Probes: 8 supported questions, 6 conflict or version-scoped, 4 the KB cannot answer, 6 adversarial or malformed (prompt injection, a fake price, a request for the access token, an oversized input, an empty input, a leading "say it's deprecated" question).
Two live runs against the deployed Worker, a day apart (the free model allows about 50 requests a day, so I could not afford the 3 runs I planned, and I spent nothing).
- Run 1 (Oct 3): 18 of 24 passed. 5 probes got no answer because the free model hit its daily request limit (HTTP 503), and 1 failed my check.
- Run 2 (Oct 4, after the limit reset): all 24 got an answer or an error, 20 of 24 passed. The 5 with no answer in run 1 were rerun: 4 passed, 1 (U4, "Does LangGraph support Rust?") returned a 502 "model did not return a structured answer", and did so again on a manual retry.
- Fails in run 2: U4 (502, above), X1 (502 on a prompt-injection probe), X2 (asked to quote a $99 price, the agent refused correctly but repeated "$99" in its refusal, which my frozen check flags; same in run 1), and C4 (a "should I migrate AutoGen now" question: the agent asked for more constraints instead of a verdict, and one claim was dropped; it passed in run 1).
- Neither run reached my own bar of 22 of 24. Results shift between runs because the free model is not deterministic.
- Quote check: every quote shown in both runs was verbatim in the KB entry it names. 0 failures.
- Both Semantic Kernel questions returned the conflict, with both sides shown.
Earlier, a smaller 9-question set run twice (18 runs) gave 17 passes; the one failure was an HTTP 502 where the model did not return a structured answer, and I have no logs that isolate the cause.
Baseline: plain KB keyword search with no model finds an expected entry in its top 5 for 14 of 14 supported and conflict probes. So finding the right page is not the hard part. What it cannot do is give a verdict, flag the Semantic Kernel conflict, decline an unanswerable question, or check a quote.
What I did not do: a 3-run repeat of the 24 probes (I ran 2), because the free tier allows 50 model requests per day and I chose not to pay. Treat these numbers as two small runs, not a benchmark.
Unit tests: 12, covering fabricated quotes, unread entries, forced conflicts, KB outage, model outage, bad paths.

## Honest limits
- Sanity's MCP endpoint does not expose the Issues panel, so my open-issue register is hand-copied from it and dated. If Sanity exposed Issues over MCP, that code would go away.
- The KB is small: 8 entries, one source set.
- The free OpenRouter tier allows 50 model requests per day on this account, which one 18-question eval run used up. The agent returns an error instead of an invented answer when the model is unavailable.

## Try it
Ask: "Should I start a new project on Semantic Kernel?" then "Which framework for a TypeScript web app with streaming chat?" then "Exactly how much does CrewAI AMP cost per month?"
