import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as E from "../src/engine.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kb = JSON.parse(readFileSync(join(root, "kb/knowledge-base.json"), "utf8"));
const ex = (n) => JSON.parse(readFileSync(join(root, "examples", n), "utf8"));

test("knowledge base is internally consistent", () => {
  const compIds = new Set(kb.components.map((c) => c.id));
  for (const [p, comps] of Object.entries(kb.patternComponents)) {
    assert.ok(kb.patterns.some((x) => x.id === p), `pattern ${p} defined`);
    for (const c of comps) assert.ok(compIds.has(c), `component ${c} defined`);
  }
  for (const [pid, prov] of Object.entries(kb.providers)) {
    for (const c of compIds) assert.ok(prov.services[c], `${pid} maps ${c}`);
  }
  const ids = kb.controls.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "control ids unique");
  for (const r of kb.readiness) assert.ok(kb.stages.some((s) => s.id === r.stage), `stage ${r.stage}`);
  assert.match(kb.kbVersion, /^\d{4}\.\d{1,2}\.\d+$/);
});

test("defaults validate", () => {
  assert.deepEqual(E.validateAnswers(E.defaultAnswers(), kb), []);
});

test("validation catches bad enums", () => {
  const errs = E.validateAnswers({ platform: "mainframe" }, kb);
  assert.ok(errs.some((e) => e.startsWith("platform")));
});

test("help desk example recommends RAG at low risk", () => {
  const bp = E.buildBlueprint(ex("it-helpdesk-rag.json"), kb);
  assert.equal(bp.pattern.id, "rag");
  assert.ok(bp.risk.tier <= 2);
  assert.equal(bp.architecture.provider, "azure");
  assert.ok(bp.controls.some((c) => c.id === "ctl-permission-trim"));
});

test("access request example recommends an agent with approval controls", () => {
  const bp = E.buildBlueprint(ex("access-request-agent.json"), kb);
  assert.ok(["agent", "multi-agent"].includes(bp.pattern.id));
  assert.ok(bp.controls.some((c) => c.id === "ctl-approval"));
  assert.ok(bp.controls.some((c) => c.id === "ctl-agent-identity"));
  assert.ok(bp.cost.callsPerTask > 1);
});

test("high-risk domain with high impact reaches tier 4", () => {
  const bp = E.buildBlueprint(ex("claims-triage-high-risk.json"), kb);
  assert.equal(bp.risk.tier, 4);
  assert.ok(bp.controls.some((c) => c.id === "ctl-legal-classification"));
  assert.ok(bp.controls.some((c) => c.id === "ctl-dpia"));
  assert.ok(bp.roadmap.phases.some((p) => p.name.startsWith("Legal")));
});

test("prediction use case recommends classic ML with no token cost", () => {
  const bp = E.buildBlueprint({ useCase: "predict" }, kb);
  assert.equal(bp.pattern.id, "classic-ml");
  assert.equal(bp.cost.lines[0].monthly, 0);
});

test("pattern override is respected and recorded", () => {
  const bp = E.buildBlueprint({ ...ex("it-helpdesk-rag.json"), patternOverride: "prompt" }, kb);
  assert.equal(bp.pattern.id, "prompt");
  assert.ok(bp.decisions.some((d) => d.includes("architecture decision record")));
});

test("cost arithmetic matches a hand calculation", () => {
  const a = { useCase: "summarize", data: { docCount: 0 }, scale: { requestsPerDay: 100, inputTokens: 1000, outputTokens: 100, inputPer1M: 1, outputPer1M: 10, hostingMonthly: 0, observabilityMonthly: 0, retrievalMonthly: 0, embeddingPer1M: 0, tokensPerDoc: 0 } };
  const c = E.estimateCost(a, kb, "prompt");
  // 3000 tasks x (1000 x $1 + 100 x $10) / 1e6 = $6.00
  assert.equal(Number(c.total.toFixed(4)), 6);
  assert.equal(c.usesDefaults, false);
});

test("readiness score and stage progression", () => {
  const r = E.readiness({ readiness: { done: ["rd-owner", "rd-value", "rd-data-access"] } }, kb);
  assert.equal(r.reached, "Idea");
  assert.equal(r.next, "Proof of concept");
  assert.equal(r.score, Math.round((3 / kb.readiness.length) * 100));
});

test("renderers produce Markdown, Mermaid and valid-looking SVG", () => {
  const bp = E.buildBlueprint(ex("access-request-agent.json"), kb);
  const md = E.toMarkdown(bp);
  assert.ok(md.includes("## 3. Reference architecture"));
  assert.ok(md.includes("```mermaid"));
  const svg = E.toSVG(bp);
  assert.ok(svg.startsWith("<svg") && svg.trim().endsWith("</svg>"));
  assert.ok(!svg.includes("undefined"));
  assert.ok(E.toMermaid(bp).startsWith("flowchart TB"));
});
