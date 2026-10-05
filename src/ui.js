export function page() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Field Guide Evidence Agent</title>
<style>
:root{--bg:#0f1115;--card:#171a21;--line:#2a2f3a;--tx:#e8eaf0;--mut:#9aa3b2;--ok:#4ade80;--warn:#fbbf24;--bad:#f87171;--acc:#7c9cff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.5 system-ui,sans-serif}
main{max-width:820px;margin:0 auto;padding:20px 16px 60px}h1{font-size:1.4rem;margin:.2em 0}p.sub{color:var(--mut);margin-top:0}
form{display:flex;gap:8px;flex-wrap:wrap}input{flex:1 1 260px;padding:12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--tx);font:inherit}
button{padding:12px 18px;border-radius:8px;border:0;background:var(--acc);color:#0b0d12;font-weight:600;cursor:pointer}button:disabled{opacity:.5}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.chips button{background:var(--card);color:var(--tx);border:1px solid var(--line);font-weight:400;padding:8px 12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin-top:14px;overflow-wrap:anywhere}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.8rem;font-weight:700}
.answer{background:#14301f;color:var(--ok)}.conflict{background:#3a2d0c;color:var(--warn)}.unknown,.needs_constraint{background:#2a2f3a;color:var(--mut)}.error{background:#3a1515;color:var(--bad)}
blockquote{margin:6px 0 10px;padding:6px 10px;border-left:3px solid var(--line);color:var(--mut)}.side{display:grid;gap:10px;grid-template-columns:1fr 1fr}
@media(max-width:620px){.side{grid-template-columns:1fr}}small,.mut{color:var(--mut)}code{font-size:.85rem}
</style></head><body><main>
<h1>Field Guide Evidence Agent</h1>
<p class="sub">Answers agent-framework questions only from a Sanity Knowledge Base, read live through Sanity Context (MCP). Every claim carries a verbatim quote. Conflicts are shown, never resolved by guessing.</p>
<form id="f"><input id="q" maxlength="600" placeholder="e.g. Should I start a new project on Semantic Kernel?" aria-label="Question" required><button id="go">Ask</button></form>
<div class="chips" id="chips"></div><div id="out" aria-live="polite"></div>
<script>
const chips=["Should I start a new project on Semantic Kernel?","Which framework for a TypeScript web app with streaming chat?","Does LangGraph support human-in-the-loop?","What does CrewAI AMP cost per month?"];
const $=(id)=>document.getElementById(id);const esc=(s)=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
chips.forEach(t=>{const b=document.createElement("button");b.type="button";b.textContent=t;b.onclick=()=>{$("q").value=t;$("f").requestSubmit()};$("chips").append(b)});
$("f").onsubmit=async(e)=>{e.preventDefault();$("go").disabled=true;$("out").innerHTML='<div class="card mut">Reading the knowledge base...</div>';
try{const r=await fetch("/api/ask",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:$("q").value})});const d=await r.json();$("out").innerHTML=render(d,r.ok)}catch(err){$("out").innerHTML='<div class="card"><span class="badge error">error</span> '+esc(err.message)+'</div>'}$("go").disabled=false};
function quote(c){return '<blockquote>"'+esc(c.quote)+'" <small>- entry <code>'+esc(c.entry)+'</code></small></blockquote>'}
function render(d,ok){if(!ok){var q=/language model is unavailable/.test(d.error||''),n=new Date(),r=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1)),extra=q?'<p>The free model quota (50 requests a day, shared by all visitors) is used up for now. It resets at 00:00 UTC, which is '+esc(r.toLocaleString())+' your time. No answer is shown rather than a made-up one.</p>':'';return '<div class="card"><span class="badge error">no answer</span> '+esc(d.error)+extra+'</div>'}
let h='<div class="card"><span class="badge '+esc(d.verdict)+'">'+esc(d.verdict)+'</span> <p>'+esc(d.summary)+'</p>';
(d.claims||[]).forEach(c=>{h+='<p>'+esc(c.text)+'</p>'+quote(c)});h+='</div>';
(d.openIssues||[]).forEach(i=>{h+='<div class="card"><b>Unresolved conflict: '+esc(i.topic)+'</b><div class="side"><div><span class="mut">Knowledge Base says</span><p>'+esc(i.kbSide.claim)+'</p>'+quote(i.kbSide)+'</div><div><span class="mut">Updated source says</span><p>'+esc(i.sourceSide.claim)+'</p><small>'+esc(i.sourceSide.origin)+'</small></div></div><p class="mut">'+esc(i.note)+'</p></div>'});
(d.conflicts||[]).forEach(k=>{h+='<div class="card"><b>Conflict: '+esc(k.topic)+'</b><div class="side">'+k.sides.map(s=>'<div><p>'+esc(s.claim)+'</p>'+quote(s)+'</div>').join('')+'</div></div>'});
if((d.unknown||[]).length)h+='<div class="card"><b>Not in the knowledge base</b><ul>'+d.unknown.map(u=>'<li>'+esc(u)+'</li>').join('')+'</ul></div>';
if(d.question)h+='<div class="card"><b>To narrow this down:</b> '+esc(d.question)+'</div>';
if((d.dropped||[]).length)h+='<div class="card mut"><small>'+d.dropped.length+' model claim(s) removed because their quote could not be verified in the entry.</small></div>';
h+='<details class="card"><summary>Trace</summary><pre>'+esc((d.trace||[]).map(t=>JSON.stringify(t)).join("\\n"))+'</pre></details>';return h}
</script></main></body></html>`;
}
