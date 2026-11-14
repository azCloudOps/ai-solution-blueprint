// Validates the knowledge base before a release. Fails CI on structural errors
// and prints every service still flagged for verification.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kb = JSON.parse(readFileSync(join(root, "kb/knowledge-base.json"), "utf8"));
const errors = [];
const req = ["kbVersion", "lastReviewed", "useCases", "domains", "patterns", "components", "patternComponents", "providers", "riskTiers", "controls", "metrics", "stages", "readiness", "references", "costDefaults"];
for (const k of req) if (!(k in kb)) errors.push(`missing top-level key: ${k}`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(kb.lastReviewed)) errors.push("lastReviewed must be YYYY-MM-DD");
const days = (Date.now() - Date.parse(kb.lastReviewed)) / 864e5;
if (days > 45) errors.push(`knowledge base last reviewed ${Math.round(days)} days ago; monthly review is overdue`);
const comps = new Set(kb.components.map((c) => c.id));
for (const [pid, p] of Object.entries(kb.providers)) {
  for (const c of comps) if (!p.services[c]) errors.push(`${pid} has no service for ${c}`);
  if (!/^https:\/\//.test(p.docs)) errors.push(`${pid} docs must be an https URL`);
}
for (const c of kb.controls) if (!c.refs || !c.refs.length) errors.push(`control ${c.id} needs at least one framework reference`);
for (const r of kb.references) if (!/^https:\/\//.test(r.url)) errors.push(`reference "${r.title}" must be https`);

const verify = Object.entries(kb.providers).flatMap(([pid, p]) => Object.entries(p.services).filter(([, s]) => s.verify).map(([cid, s]) => `${pid}.${cid}: ${s.name}`));
console.log(`Knowledge base ${kb.kbVersion} (reviewed ${kb.lastReviewed})`);
console.log(`${verify.length} service names flagged for verification this release.`);
if (process.argv.includes("--list")) verify.forEach((v) => console.log("  - " + v));
if (errors.length) { console.error("\nErrors:\n" + errors.map((e) => "  - " + e).join("\n")); process.exit(1); }
console.log("Knowledge base OK.");
