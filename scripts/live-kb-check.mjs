// Live check of the KB read path (no model). Verifies the real entry text contains the quote the register relies on.
import fs from "node:fs"; import os from "node:os";
import { makeMcp, parseOutline } from "../src/lib/mcp.js";
import { OPEN_ISSUES, quoteInEntry } from "../src/lib/audit.js";
const mcp = makeMcp({ url: "https://api.sanity.io/v1/context/organizations/ow7ag3fuf/mcp/agent-framework-field-guide", token: fs.readFileSync(os.homedir() + "/.secrets/sanity_org_token", "utf8").trim() });
const o = parseOutline(await mcp.initialContext());
console.log("kb", o.kb, "entries", o.paths.length, o.paths.join(","));
const s = await mcp.search(o.kb, "Semantic Kernel status", 3); console.log("search:", s.slice(0, 300).replace(/\n/g, " | "));
for (const i of OPEN_ISSUES) { const t = await mcp.read(o.kb, [i.entry]); console.log(i.id, "register quote present in live entry:", quoteInEntry(i.kbSide.quote, t)); }
