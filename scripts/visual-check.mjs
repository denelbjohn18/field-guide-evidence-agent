// Renders the UI against a mocked /api/ask response and saves desktop+mobile screenshots to docs/visual/.
import { chromium } from "/home/sandbox/field-guide-rebuild/node_modules/playwright/index.mjs";
import http from "node:http";
import { page } from "../src/ui.js";
const mock = { verdict: "conflict", summary: "This topic has an unresolved conflict in the knowledge base. The agent will not pick a side.", claims: [{ text: "The framework table lists Semantic Kernel as Migration.", entry: "frameworks", quote: "| Semantic Kernel | Microsoft | Python, .NET, Java | Migration |" }], conflicts: [], openIssues: [{ topic: "Semantic Kernel maintenance status", kbSide: { claim: "KB entry lists status Migration.", entry: "frameworks", quote: "| Semantic Kernel | Microsoft | Python, .NET, Java | Migration |" }, sourceSide: { claim: "Updated source labels it active and warns not to infer deprecation.", origin: "Pending KB Issue" }, note: "Unresolved." }], unknown: [], question: "", dropped: [], trace: [{ step: "initial_context" }, { step: "knowledge_base_read", paths: ["frameworks"] }] };
const srv = http.createServer((req, res) => { if (req.url === "/api/ask") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(mock)); } else { res.setHeader("content-type", "text/html"); res.end(page()); } }).listen(8799);
const b = await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp }); await p.goto("http://localhost:8799/");
  await p.fill("#q", "Should I start a new project on Semantic Kernel?"); await p.click("#go"); await p.waitForSelector(".side");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(name, "horizontal overflow:", overflow);
  await p.screenshot({ path: new URL(`../docs/visual/${name}.png`, import.meta.url).pathname, fullPage: true });
}
await b.close(); srv.close();
