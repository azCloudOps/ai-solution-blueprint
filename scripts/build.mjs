// Builds a single, self-contained HTML file (dist/index.html) from the web
// template, styles, app, engine, knowledge base and examples. No dependencies.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

export function engineAsScript(src) {
  const names = [...src.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const body = src.replace(/^export\s+/gm, "");
  return `const AIBlueprint = (function () {\n${body}\nreturn { ${names.join(", ")} };\n})();`;
}

export function buildHtml({ preview = false } = {}) {
  const kb = JSON.parse(read("kb/knowledge-base.json"));
  const examples = {
    helpdesk: JSON.parse(read("examples/it-helpdesk-rag.json")),
    access: JSON.parse(read("examples/access-request-agent.json")),
    claims: JSON.parse(read("examples/claims-triage-high-risk.json"))
  };
  const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
  return read("web/index.html")
    .replace("/*__STYLES__*/", () => read("web/styles.css"))
    .replace("/*__KB__*/", () => safeJson(kb))
    .replace("/*__EXAMPLES__*/", () => safeJson(examples))
    .replace("/*__ENGINE__*/", () => engineAsScript(read("src/engine.js")))
    .replace("/*__APP__*/", () => (preview ? "const AIBP_PREVIEW = true;\n" : "") + read("web/app.js"));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const out = join(root, "dist");
  mkdirSync(out, { recursive: true });
  const html = buildHtml();
  writeFileSync(join(out, "index.html"), html);
  writeFileSync(join(out, "404.html"), html);
  if (process.argv.includes("--preview")) writeFileSync(join(out, "preview.html"), buildHtml({ preview: true }));
  console.log(`Built dist/index.html (${(html.length / 1024).toFixed(1)} KB)`);
}
