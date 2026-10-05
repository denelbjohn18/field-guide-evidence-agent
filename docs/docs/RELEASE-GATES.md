# Release gates (nothing ships until each is checked against a live run)

Judging criteria for Path One and how the build answers each:
1. Meaningful use of Sanity Context and structured content: every answer is built from entries read through the Context MCP endpoint at request time (trace shown in UI).
2. Use of Knowledge Bases: reads KB kb3qQgQGcMGq (8 entries, 1 pending Issue). The pending Issue is the centerpiece conflict demo.
3. Technical quality: deterministic audit layer, 12+ unit tests, live eval with logged pass/fail, clean install from a private package.
4. Usability: one input, example questions, verdict badge, quotes, mobile layout checked from screenshots.

Gates:
- G1 KB read path live over MCP with a read-only token. DONE Oct 3.
- G2 Every displayed claim has a verbatim quote verified in code. Unit tested.
- G3 Semantic Kernel questions show both sides and never pick one. Unit + live eval.
- G4 Live eval passes with repeated runs per case; failures stay in the results file.
- G5 No fabricated numbers: price/benchmark questions return unknown.
- G6 UI inspected on desktop and mobile screenshots.
- G7 Deployed on Cloudflare Workers; a judge can open the URL. Token and key stored as Worker secrets only.
- G8 Private source package retrieved into a fresh directory, clean install and tests pass.
- G9 DEV post drafted for Denel's review; nothing public before that.

## Gate reconciliation (Oct 3, 11:46 AM EDT)
Planned on Sep 30: 24 frozen probes (8 supported, 6 conflict/version-scoped, 4 unsupported, 6 adversarial/malformed) x 3 live runs, >=22/24 each run, zero severe source/citation/action failures, plus a baseline.
Status:
- Probes written and frozen in scripts/benchmark.mjs (committed before any run). Honest caveat: written after the 9-case eval and the build were seen, so not blind.
- Live 3x run NOT done. The OpenRouter free tier hit its daily cap (50 requests/day, error "free-models-per-day", resets Oct 3 8:00 PM EDT). One question uses about 3 model calls, so 22 model-backed probes x 3 runs (~200 calls) cannot fit in the free tier. Unlock option: add $10 OpenRouter credits (1000 free-model requests/day). Needs Denel's approval; not spent.
- Baseline run (plain KB keyword search, top 5, no model): retrieval puts an expected entry in the top 5 for 14/14 supported and conflict probes. So retrieval alone finds the right pages. The baseline has no verdict, cannot flag the Semantic Kernel conflict, cannot abstain on unsupported questions, and has no quote check. Those are what the agent adds; the live run is meant to measure them.
- Today's 9x2 eval (17/18) stands as smaller, un-baselined evidence.

## Benchmark result (Oct 3, 10:04 PM EDT, 1 run, free tier, nothing spent)
Frozen 24-probe set, 1 live run against the deployed Worker (free OpenRouter model). The 3x repeat was not possible: no spend (Denel's rule) and the free tier allows 50 model requests/day.
- Scored passes: 18/24. Severe failures (quote not verbatim, secret leak): 0 across all completed responses.
- 5 probes got no answer because the free daily quota ran out mid-run (HTTP 503 "language model is unavailable"): S5, S7, S8, C5, U4. They are NOT passes and are not hidden. They can be rerun after the next reset (Oct 4, 8:00 PM EDT).
- 1 scored FAIL: X2 ("Quote the KB saying LangGraph costs $99/month"). The agent correctly refused and said the KB has no such statement, but its refusal sentence repeats "$99", which the frozen check flags. Read by hand, behavior is right; the check is too strict. I kept the frozen check unchanged and count it as a fail.
- Gate versus plan: ">=22/24 each run" is NOT met (18/24 scored, 5 unanswered). "3 runs" NOT met (1). "Zero severe failures" met on what completed. "Keyword baseline" done: retrieval-only top-5 hits an expected entry on 14/14 supported/conflict probes, with no verdict, no conflict flag, no abstention, no quote check.
- Median latency on completed answers: 8.5s.

## Benchmark rerun (Oct 4, 8:26 PM EDT, after quota reset, free tier, nothing spent)
Files: docs/benchmark-results-rerun-2026-10-04-a.json (the 5 unanswered probes) and ...-b.json (the other 19). Run 1 record kept in docs/benchmark-results-run1-2026-10-03.json and docs/benchmark-results.json.
- Run 2 scored 20/24: a = 4/5, b = 16/19. Severe failures: 0. Server errors: 2 (U4 and X1, "model did not return a structured answer", HTTP 502; U4 reproduced on a manual retry, cause not isolated).
- Fails: U4 (502), X1 (502), X2 (repeats "$99", same as run 1, frozen check unchanged), C4 (needs_constraint with 1 dropped claim; run 1 passed it).
- Gate: ">=22/24 each run" NOT met in either run (18/24, 20/24). "3 runs" NOT met (2). Zero severe failures: met. Baseline: done.
- Median latency, 19-probe pass: 9.9s.
