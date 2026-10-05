// Deterministic claim audit. The model proposes claims; this code decides what survives.
// Rule: a claim is shown as grounded only if its quote appears verbatim in an entry the agent actually read.

const norm = (s) =>
  s.replace(/[*_`]/g, "").replace(/\s+/g, " ").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').trim().toLowerCase();

export function quoteInEntry(quote, entryText) {
  if (!quote || quote.length < 12) return false;
  return norm(entryText).includes(norm(quote));
}

export function auditAnswer(draft, entriesRead) {
  const verifiedClaims = [];
  const droppedClaims = [];
  for (const c of draft.claims ?? []) {
    const text = entriesRead[c.entry];
    if (text && quoteInEntry(c.quote, text)) verifiedClaims.push(c);
    else droppedClaims.push({ text: c.text, entry: c.entry, reason: text ? "quote not found in entry" : "entry was not read" });
  }
  const verifiedConflicts = [];
  for (const k of draft.conflicts ?? []) {
    const sides = (k.sides ?? []).filter((s) => entriesRead[s.entry] && quoteInEntry(s.quote, entriesRead[s.entry]));
    if (sides.length >= 2) verifiedConflicts.push({ ...k, sides });
    else droppedClaims.push({ text: `conflict: ${k.topic}`, reason: "fewer than two verifiable sides" });
  }
  return { verifiedClaims, verifiedConflicts, droppedClaims };
}

// Open Issues recorded in the Knowledge Base's own Issues panel (Sanity Context app).
// The MCP endpoint does not expose Issues, so this register is maintained by hand and dated.
// An entry that is in this register can never be answered with a confident single claim on that topic.
export const OPEN_ISSUES = [
  {
    id: "issue-semantic-kernel-status",
    observedOn: "2026-10-03",
    entry: "frameworks",
    topic: "Semantic Kernel maintenance status",
    match: /semantic kernel|\bSK\b/i,
    kbSide: {
      claim: "The KB entry lists Semantic Kernel's status as \"Migration\" (maintained, not recommended for new agent workflows).",
      entry: "frameworks",
      quote: "| Semantic Kernel | Microsoft | Python, .NET, Java | Migration |",
    },
    sourceSide: {
      claim: "The updated Semantic Kernel source now labels it \"active\" and warns not to infer deprecation (per the pending KB Issue).",
      origin: "Pending conflict in the Knowledge Base Issues panel, first seen 7 days before 2026-10-03",
    },
    note: "Unresolved: the KB has not accepted either claim, so the agent will not pick one.",
  },
];

// An issue applies when its entry was read AND the question or the model's own claims touch its topic.
// Matching on the whole entry text would fire for every question that reads that entry.
export function openIssuesFor(question, entriesRead, draft = {}) {
  const touched = Object.keys(entriesRead);
  const said = [question, draft.summary, ...(draft.claims ?? []).flatMap((c) => [c.text, c.quote]),
    ...(draft.conflicts ?? []).map((k) => k.topic)].filter(Boolean).join(" ");
  return OPEN_ISSUES.filter((i) => touched.includes(i.entry) && i.match.test(said));
}
