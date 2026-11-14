#!/usr/bin/env node
// AI Solution Blueprint CLI by azCloudOps. Zero dependencies.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { stdin, stdout, exit, argv } from "node:process";
import * as E from "../src/engine.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kb = JSON.parse(readFileSync(join(root, "kb/knowledge-base.json"), "utf8"));
const EXAMPLES = { helpdesk: "it-helpdesk-rag.json", access: "access-request-agent.json", claims: "claims-triage-high-risk.json" };

const args = argv.slice(2);
const cmd = args[0];
const flag = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : dflt; };
const has = (name) => args.includes(`--${name}`);

const HELP = `AI Solution Blueprint ${E.ENGINE_VERSION} (knowledge base ${kb.kbVersion}) by azCloudOps

Design an enterprise AI solution from idea to production.

Usage:
  aiblueprint new [--out <dir>]                 Answer guided questions and generate a blueprint
  aiblueprint render <answers.json> [--out <dir>] Generate blueprint files from saved answers
  aiblueprint validate <answers.json>          Check an answers file
  aiblueprint example <helpdesk|access|claims> [--out <file>]  Write an example answers file
  aiblueprint web [--out <file>]               Write the self-contained web app (single HTML file)
  aiblueprint kb [--list]                      Show knowledge base version and items to verify
  aiblueprint --version | --help

Outputs: blueprint.md, answers.json, architecture.svg, architecture.mmd
Everything runs locally. Nothing is sent anywhere.
More: https://azcloudops.org/products/ai-solution-blueprint/`;

function writeOutputs(answers, outDir) {
  const errs = E.validateAnswers(answers, kb);
  if (errs.length) { console.error("Invalid answers:\n  - " + errs.join("\n  - ")); exit(1); }
  const bp = E.buildBlueprint(answers, kb);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "blueprint.md"), E.toMarkdown(bp));
  writeFileSync(join(outDir, "answers.json"), JSON.stringify(E.normalize(answers), null, 2) + "\n");
  writeFileSync(join(outDir, "architecture.svg"), E.toSVG(bp));
  writeFileSync(join(outDir, "architecture.mmd"), E.toMermaid(bp) + "\n");
  console.log(`\nBlueprint: ${answers.meta?.name || "Untitled AI solution"}`);
  console.log(`  Pattern          ${bp.pattern.name}`);
  console.log(`  Platform         ${bp.architecture.providerName}`);
  console.log(`  Risk tier        ${bp.risk.tier} (${bp.risk.name}), ${bp.controls.length} controls`);
  console.log(`  Monthly cost     ${E.money(bp.cost.total)} (${E.money(bp.cost.perTask)} per task)${bp.cost.usesDefaults ? " using example rates" : ""}`);
  console.log(`  To production    about ${bp.roadmap.weeksToProduction} weeks`);
  console.log(`  Readiness        ${bp.readiness.score}% (next: ${bp.readiness.next})`);
  console.log(`\nWrote blueprint.md, answers.json, architecture.svg, architecture.mmd to ${resolve(outDir)}`);
}

async function interview() {
  // Line queue: works for interactive terminals and for piped or scripted input.
  const rl = createInterface({ input: stdin, terminal: false });
  const queue = [], waiters = [];
  let closed = false;
  rl.on("line", (l) => { const w = waiters.shift(); w ? w(l) : queue.push(l); });
  rl.on("close", () => { closed = true; while (waiters.length) waiters.shift()(null); });
  const nextLine = () => queue.length ? Promise.resolve(queue.shift()) : closed ? Promise.resolve(null) : new Promise((r) => waiters.push(r));
  const a = E.defaultAnswers();
  const ask = async (q, dflt = "") => {
    stdout.write(`${q}${dflt !== "" ? ` [${dflt}]` : ""}: `);
    const line = await nextLine();
    if (line === null) { stdout.write("\n"); return String(dflt); }
    if (!stdin.isTTY) stdout.write("\n");
    const v = line.trim(); return v === "" ? String(dflt) : v;
  };
  const pick = async (q, items, dflt) => {
    console.log(`\n${q}`);
    items.forEach((it, i) => console.log(`  ${i + 1}. ${it.t}`));
    const di = Math.max(0, items.findIndex((it) => it.v === dflt)) + 1;
    for (;;) {
      const v = await ask("Choose a number", di);
      const n = Number(v);
      if (n >= 1 && n <= items.length) return items[n - 1].v;
      if (closed && !queue.length) return items[di - 1].v;
      console.log("Please enter one of the numbers shown.");
    }
  };
  const yes = async (q) => /^y/i.test(await ask(`${q} (y/n)`, "n"));
  const int = async (q, d) => { const n = Number(await ask(q, d)); return Number.isFinite(n) && n >= 0 ? n : d; };

  console.log(`\nAI Solution Blueprint ${E.ENGINE_VERSION} by azCloudOps. Press Enter to accept a default.\n`);
  console.log("1. Idea");
  a.meta.name = await ask("Solution name", "My AI solution");
  a.meta.owner = await ask("Accountable business owner");
  a.meta.team = await ask("Delivery team");
  a.idea.problem = await ask("Problem you are solving");
  a.idea.successMetric = await ask("How will you measure success");
  a.idea.users = await pick("Who will use it?", [{ v: "internal", t: "Employees only" }, { v: "external", t: "Customers or the public" }, { v: "both", t: "Both" }], "internal");

  console.log("\n2. Use case");
  a.useCase = await pick("Primary use case", kb.useCases.map((u) => ({ v: u.id, t: u.label })), "knowledge-qa");
  a.domain = await pick("Business domain", kb.domains.map((d) => ({ v: d.id, t: d.label })), "general");
  a.needs.style = await yes("Strict output style or format required?");
  a.needs.highVolume = await yes("Very high volume or tight unit cost?");
  a.needs.lowLatency = await yes("Low latency critical?");
  a.needs.multiTeam = await yes("Several teams own different parts of the work?");

  console.log("\n3. Data");
  a.data.sources = await ask("Data sources");
  a.data.sensitivity = await pick("Most sensitive data in scope", [{ v: "public", t: "Public" }, { v: "internal", t: "Internal" }, { v: "confidential", t: "Confidential" }, { v: "regulated", t: "Regulated or personal" }], "internal");
  a.data.freshness = await pick("How often does it change?", [{ v: "static", t: "Rarely" }, { v: "daily", t: "Daily or weekly" }, { v: "realtime", t: "Real time" }], "daily");
  a.data.docCount = await int("Approximate documents or records", 5000);
  a.data.residency = await pick("Data residency", [{ v: "any", t: "No restriction" }, { v: "eu", t: "European Union" }, { v: "us", t: "United States" }, { v: "other", t: "Other specific region" }], "any");

  console.log("\n4. Actions and risk");
  a.actions = await pick("Does it act in other systems?", [{ v: "none", t: "No, it only responds" }, { v: "read", t: "Reads live data" }, { v: "write", t: "Changes data or takes actions" }], "none");
  a.autonomy = await pick("Human involvement", [{ v: "assist", t: "Assists a person" }, { v: "approve", t: "Human approves" }, { v: "autonomous", t: "Autonomous" }], "assist");
  a.decisionImpact = await pick("Impact of outputs on people", [{ v: "low", t: "Low" }, { v: "medium", t: "Medium" }, { v: "high", t: "High" }], "low");

  console.log("\n5. Platform");
  a.platform = await pick("Primary platform", [{ v: "azure", t: "Microsoft Azure" }, { v: "aws", t: "Amazon Web Services" }, { v: "gcp", t: "Google Cloud" }, { v: "portable", t: "Portable / multi-cloud" }], "azure");
  a.build = await pick("Build approach", [{ v: "pro-code", t: "Pro-code" }, { v: "low-code", t: "Low-code front end" }], "pro-code");

  console.log("\n6. Scale (press Enter for example values; edit rates later in answers.json)");
  a.scale.requestsPerDay = await int("Tasks or requests per day", 1000);
  a.scale.inputTokens = await int("Input tokens per call", 3000);
  a.scale.outputTokens = await int("Output tokens per call", 500);
  const preview = E.recommendPatterns(a, kb)[0].id;
  if (preview === "agent" || preview === "multi-agent") a.scale.stepsPerTask = await int("Model calls per task", 4);
  rl.close();
  return a;
}

async function main() {
  if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") { console.log(HELP); return; }
  if (cmd === "--version" || cmd === "-v") { console.log(`${E.ENGINE_VERSION} (knowledge base ${kb.kbVersion})`); return; }
  if (cmd === "new") { const a = await interview(); writeOutputs(a, flag("out", "blueprint")); return; }
  if (cmd === "render" || cmd === "validate") {
    const file = args[1];
    if (!file || !existsSync(file)) { console.error(`Answers file not found: ${file ?? "(none)"}`); exit(1); }
    let a;
    try { a = JSON.parse(readFileSync(file, "utf8")); } catch { console.error("Answers file is not valid JSON."); exit(1); }
    if (cmd === "validate") {
      const errs = E.validateAnswers(a, kb);
      if (errs.length) { console.error("Invalid:\n  - " + errs.join("\n  - ")); exit(1); }
      console.log("Valid."); return;
    }
    writeOutputs(a, flag("out", "blueprint")); return;
  }
  if (cmd === "example") {
    const name = args[1] && !args[1].startsWith("--") ? args[1] : "helpdesk";
    if (!EXAMPLES[name]) { console.error(`Unknown example. Choose: ${Object.keys(EXAMPLES).join(", ")}`); exit(1); }
    const out = flag("out", `${name}.json`);
    writeFileSync(out, readFileSync(join(root, "examples", EXAMPLES[name])));
    console.log(`Wrote ${out}. Next: aiblueprint render ${out}`); return;
  }
  if (cmd === "web") {
    const { buildHtml } = await import("../scripts/build.mjs");
    const out = flag("out", "ai-solution-blueprint.html");
    writeFileSync(out, buildHtml());
    console.log(`Wrote ${resolve(out)}. Open it in any browser; it works offline.`); return;
  }
  if (cmd === "kb") {
    console.log(`Knowledge base ${kb.kbVersion}, last reviewed ${kb.lastReviewed}`);
    console.log(kb.reviewNote);
    if (has("list")) for (const [pid, p] of Object.entries(kb.providers)) for (const [cid, s] of Object.entries(p.services)) if (s.verify) console.log(`  verify  ${pid}.${cid}: ${s.name}`);
    return;
  }
  console.error(`Unknown command: ${cmd}\n`); console.log(HELP); exit(1);
}

main().catch((e) => { console.error(e.message); exit(1); });
