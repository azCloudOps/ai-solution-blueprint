// AI Solution Blueprint engine.
// Pure functions shared by the web app and the CLI. No I/O, no dependencies.
// Input: an answers object (schema "aiblueprint/v1") and the knowledge base.
// Output: a blueprint object plus Markdown, Mermaid and SVG renderers.

export const ENGINE_VERSION = "1.0.0";
export const SCHEMA = "aiblueprint/v1";

export function defaultAnswers() {
  return {
    schema: SCHEMA,
    meta: { name: "", owner: "", team: "" },
    idea: { problem: "", users: "internal", userCount: 500, successMetric: "", value: "" },
    useCase: "knowledge-qa",
    domain: "general",
    data: { sources: "", sensitivity: "internal", freshness: "daily", docCount: 5000, residency: "any" },
    actions: "none",
    autonomy: "assist",
    decisionImpact: "low",
    needs: { style: false, highVolume: false, multiTeam: false, lowLatency: false },
    platform: "azure",
    build: "pro-code",
    scale: {
      requestsPerDay: 1000, inputTokens: 3000, outputTokens: 500, stepsPerTask: 4,
      inputPer1M: null, outputPer1M: null, embeddingPer1M: null, tokensPerDoc: null,
      retrievalMonthly: null, hostingMonthly: null, observabilityMonthly: null
    },
    readiness: { done: [] },
    patternOverride: null
  };
}

function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }

function deepMerge(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!isObj(extra)) return out;
  for (const [k, v] of Object.entries(extra)) {
    out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function normalize(answers) {
  return deepMerge(defaultAnswers(), answers || {});
}

const ENUMS = {
  "idea.users": ["internal", "external", "both"],
  "data.sensitivity": ["public", "internal", "confidential", "regulated"],
  "data.freshness": ["static", "daily", "realtime"],
  "data.residency": ["any", "eu", "us", "other"],
  actions: ["none", "read", "write"],
  autonomy: ["assist", "approve", "autonomous"],
  decisionImpact: ["low", "medium", "high"],
  platform: ["azure", "aws", "gcp", "portable"],
  build: ["pro-code", "low-code"]
};

function get(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }

export function validateAnswers(answers, kb) {
  const a = normalize(answers);
  const errors = [];
  for (const [path, allowed] of Object.entries(ENUMS)) {
    const v = get(a, path);
    if (!allowed.includes(v)) errors.push(`${path} must be one of ${allowed.join(", ")} (got "${v}")`);
  }
  if (kb) {
    if (!kb.useCases.some((u) => u.id === a.useCase)) errors.push(`useCase "${a.useCase}" is not in the knowledge base`);
    if (!kb.domains.some((d) => d.id === a.domain)) errors.push(`domain "${a.domain}" is not in the knowledge base`);
    if (a.patternOverride && !kb.patterns.some((p) => p.id === a.patternOverride)) errors.push(`patternOverride "${a.patternOverride}" is not a known pattern`);
  }
  for (const k of ["requestsPerDay", "inputTokens", "outputTokens", "stepsPerTask"]) {
    const v = Number(a.scale[k]);
    if (!Number.isFinite(v) || v < 0) errors.push(`scale.${k} must be a non-negative number`);
  }
  return errors;
}

// ---------- Pattern recommendation ----------

const USE_CASE_WEIGHTS = {
  "knowledge-qa": { rag: 5, agent: 1, prompt: 1 },
  summarize: { prompt: 4, rag: 2 },
  generate: { prompt: 4, rag: 2, "fine-tune": 1 },
  extract: { prompt: 4, "fine-tune": 2, "classic-ml": 1 },
  assistant: { rag: 4, agent: 2, prompt: 1 },
  "agent-automation": { agent: 5, "multi-agent": 2 },
  code: { prompt: 3, rag: 2, agent: 2 },
  predict: { "classic-ml": 6 }
};

export function recommendPatterns(answers, kb) {
  const a = normalize(answers);
  const scores = Object.fromEntries(kb.patterns.map((p) => [p.id, { id: p.id, score: 0, reasons: [] }]));
  const add = (id, pts, why) => { if (scores[id]) { scores[id].score += pts; scores[id].reasons.push(why); } };

  const uc = kb.useCases.find((u) => u.id === a.useCase);
  for (const [id, pts] of Object.entries(USE_CASE_WEIGHTS[a.useCase] || {})) {
    add(id, pts, `Fits the use case: ${uc ? uc.label.toLowerCase() : a.useCase}`);
  }
  const genAI = a.useCase !== "predict";
  if (a.actions === "read") { add("agent", 2, "Needs to read from business systems at run time"); add("rag", 1, "Reads live business data"); }
  if (a.actions === "write") { add("agent", 3, "Needs to take actions in business systems"); add("multi-agent", 1, "Actions may span several systems"); }
  if (a.actions === "none") { add("prompt", 1, "No system actions required"); add("rag", 1, "No system actions required"); }
  if (genAI && a.data.freshness !== "static") add("rag", 1, "Content changes, so retrieval beats retraining");
  if (genAI && a.data.freshness === "realtime") add("agent", 1, "Real-time data is best fetched through tools");
  if (genAI && Number(a.data.docCount) > 0) add("rag", 1, "There is a document corpus to ground answers on");
  if (a.needs.style) add("fine-tune", 2, "Consistent style or format is a hard requirement");
  if (a.needs.highVolume) add("fine-tune", 2, "High volume favours a smaller tuned or distilled model");
  if (a.needs.lowLatency) { add("fine-tune", 1, "Low latency favours a smaller model"); add("prompt", 1, "Low latency favours a single model call"); }
  if (a.needs.multiTeam) add("multi-agent", 2, "Several teams own distinct sub-tasks and tools");
  if (!genAI) { add("prompt", -3, "Generative models are weak at numeric prediction"); add("rag", -3, "Retrieval does not help numeric prediction"); }

  const ranked = Object.values(scores).sort((x, y) => y.score - x.score || complexityOf(kb, x.id) - complexityOf(kb, y.id));
  return ranked;
}

function complexityOf(kb, id) { return (kb.patterns.find((p) => p.id === id) || {}).complexity || 9; }

// ---------- Risk ----------

export function assessRisk(answers, kb) {
  const a = normalize(answers);
  let pts = 0;
  const factors = [];
  const bump = (n, why) => { pts += n; factors.push(why); };
  if (a.data.sensitivity === "confidential") bump(1, "Confidential data in scope");
  if (a.data.sensitivity === "regulated") bump(2, "Regulated or personal data in scope");
  if (a.idea.users !== "internal") bump(1, "External users interact with the system");
  if (a.actions === "write") bump(1, "The system changes data or takes actions");
  if (a.actions === "write" && a.autonomy === "autonomous") bump(1, "Actions run without human approval");
  if (a.decisionImpact === "medium") bump(1, "Outputs influence decisions about people or money");
  if (a.decisionImpact === "high") bump(2, "Outputs materially affect people's rights, access or safety");

  let tier = pts === 0 ? 1 : pts <= 2 ? 2 : pts <= 4 ? 3 : 4;
  if ((a.useCase === "assistant" || a.idea.users !== "internal") && tier < 2) {
    tier = 2; factors.push("People converse with the AI directly, so transparency duties apply");
  }
  const domain = kb.domains.find((d) => d.id === a.domain);
  if (domain && domain.highRisk) {
    const floor = a.decisionImpact === "high" ? 4 : 3;
    if (tier < floor) tier = floor;
    factors.push(`Domain "${domain.label}" is commonly classed as high-risk (for example EU AI Act Annex III)`);
  }
  if (factors.length === 0) factors.push("Internal, low-impact use on non-sensitive data");
  const def = kb.riskTiers.find((t) => t.tier === tier);
  return { tier, name: def.name, description: def.description, factors, points: pts };
}

// ---------- Controls ----------

export function selectControls(answers, kb, tier, patternId) {
  const a = normalize(answers);
  return kb.controls.filter((c) => {
    if (c.minTier > tier) return false;
    const w = c.when || {};
    if (w.sensitivity && !w.sensitivity.includes(a.data.sensitivity)) return false;
    if (w.residency && !w.residency.includes(a.data.residency)) return false;
    if (w.patterns && !w.patterns.includes(patternId)) return false;
    if (w.actions && !w.actions.includes(a.actions)) return false;
    return true;
  });
}

// ---------- Architecture ----------

export function architecture(answers, kb, patternId) {
  const a = normalize(answers);
  const provider = kb.providers[a.platform];
  const ids = [...(kb.patternComponents[patternId] || [])];
  if (a.build === "low-code" && !ids.includes("lowcode")) ids.unshift("lowcode");
  const components = ids.map((id) => {
    const c = kb.components.find((x) => x.id === id);
    const s = provider.services[id] || { name: "Choose a service", verify: true };
    return { id, label: c.label, layer: c.layer, service: s.name, verify: !!s.verify };
  });
  return { provider: a.platform, providerName: provider.name, docs: provider.docs, components };
}

// ---------- Cost ----------

function num(v, fallback) { const n = Number(v); return v === null || v === undefined || v === "" || !Number.isFinite(n) ? fallback : n; }

export function estimateCost(answers, kb, patternId) {
  const a = normalize(answers);
  const d = kb.costDefaults;
  const s = a.scale;
  const rates = {
    inputPer1M: num(s.inputPer1M, d.inputPer1M),
    outputPer1M: num(s.outputPer1M, d.outputPer1M),
    embeddingPer1M: num(s.embeddingPer1M, d.embeddingPer1M),
    tokensPerDoc: num(s.tokensPerDoc, d.tokensPerDoc),
    retrievalMonthly: num(s.retrievalMonthly, d.retrievalMonthly),
    hostingMonthly: num(s.hostingMonthly, d.hostingMonthly),
    observabilityMonthly: num(s.observabilityMonthly, d.observabilityMonthly)
  };
  const tasks = num(s.requestsPerDay, 0) * 30;
  const steps = Math.max(1, num(s.stepsPerTask, 4));
  const callsPerTask = patternId === "agent" ? steps : patternId === "multi-agent" ? steps * 2 : patternId === "classic-ml" ? 0 : 1;
  const inTok = num(s.inputTokens, 0), outTok = num(s.outputTokens, 0);
  const modelMonthly = tasks * callsPerTask * (inTok * rates.inputPer1M + outTok * rates.outputPer1M) / 1e6;

  const usesRetrieval = (kb.patternComponents[patternId] || []).includes("retrieval");
  const changeRate = { static: 0.05, daily: 0.3, realtime: 0.6 }[a.data.freshness] ?? 0.3;
  const corpusTokens = num(a.data.docCount, 0) * rates.tokensPerDoc;
  const initialEmbedding = usesRetrieval ? corpusTokens * rates.embeddingPer1M / 1e6 : 0;
  const embeddingMonthly = usesRetrieval ? initialEmbedding * changeRate + tasks * 100 * rates.embeddingPer1M / 1e6 : 0;
  const retrievalMonthly = usesRetrieval ? rates.retrievalMonthly : 0;

  const lines = [
    { item: "Model inference", monthly: modelMonthly, basis: `${fmtInt(tasks)} tasks x ${callsPerTask} call(s) x (${fmtInt(inTok)} in + ${fmtInt(outTok)} out tokens)` },
    { item: "Embeddings (refresh and queries)", monthly: embeddingMonthly, basis: usesRetrieval ? `${Math.round(changeRate * 100)}% of corpus re-embedded monthly plus query embeddings` : "Not used" },
    { item: "Retrieval / vector index", monthly: retrievalMonthly, basis: usesRetrieval ? "Entered or default service tier" : "Not used" },
    { item: patternId === "classic-ml" ? "Training and serving compute" : "Application hosting", monthly: rates.hostingMonthly, basis: "Entered or default" },
    { item: "Observability and logging", monthly: rates.observabilityMonthly, basis: "Entered or default" }
  ];
  const total = lines.reduce((t, l) => t + l.monthly, 0);
  const perTask = tasks > 0 ? total / tasks : 0;
  const cap = Math.ceil((total * 1.3) / 50) * 50;
  return {
    currency: "USD", rates, tasksPerMonth: tasks, callsPerTask, lines, total, perTask,
    initialEmbedding, recommendedCap: cap, alertAt: Math.round(cap * 0.8),
    note: d.note, usesDefaults: Object.keys(rates).some((k) => s[k] === null || s[k] === undefined || s[k] === "")
  };
}

function fmtInt(n) { return Math.round(n).toLocaleString("en-US"); }
export function money(n) {
  const v = Number(n) || 0;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: v < 10 ? 2 : 0, maximumFractionDigits: v < 10 ? 4 : 0 });
}

// ---------- Readiness and roadmap ----------

export function readiness(answers, kb) {
  const a = normalize(answers);
  const done = new Set(a.readiness.done || []);
  const byStage = kb.stages.filter((s) => kb.readiness.some((r) => r.stage === s.id)).map((s) => {
    const items = kb.readiness.filter((r) => r.stage === s.id).map((r) => ({ ...r, done: done.has(r.id) }));
    return { id: s.id, name: s.name, items, complete: items.every((i) => i.done), doneCount: items.filter((i) => i.done).length };
  });
  let reached = "Not started";
  for (const st of byStage) { if (st.complete) reached = st.name; else break; }
  const next = byStage.find((s) => !s.complete);
  const total = kb.readiness.length;
  const score = Math.round((kb.readiness.filter((r) => done.has(r.id)).length / total) * 100);
  return { byStage, reached, next: next ? next.name : "Operating at scale", score };
}

export function roadmap(answers, kb, patternId, tier) {
  const cx = complexityOf(kb, patternId);
  const phases = [];
  let week = 1;
  const push = (name, weeks, focus) => { phases.push({ name, startWeek: week, endWeek: week + weeks - 1, weeks, focus }); week += weeks; };
  for (const st of kb.stages) {
    if (st.id === "scale") continue;
    const [lo, hi] = st.weeks;
    let w = cx <= 1 ? lo : cx === 2 ? Math.round((lo + hi) / 2) : hi;
    if (tier >= 3 && (st.id === "pilot" || st.id === "production")) w += 2;
    if (tier === 4 && st.id === "pilot") push("Legal and risk classification review", 3, "Confirm regulatory classification, DPIA and conformity obligations before real users.");
    const focus = {
      idea: "Agree owner, success metric, value hypothesis, data access and cost ceiling.",
      poc: "Build the thinnest slice of the recommended pattern and measure it against a golden set.",
      pilot: "Real users in one team, required controls live, telemetry and feedback loop running.",
      production: "Infrastructure as code, automated evaluations, SLOs, runbooks and sign-off."
    }[st.id];
    push(st.name, w, focus);
  }
  phases.push({ name: "Scale and optimise", startWeek: week, endWeek: null, weeks: null, focus: "Monthly unit-economics review, model refresh, reuse across teams." });
  return { phases, weeksToProduction: week - 1 };
}

// ---------- Blueprint ----------

export function buildBlueprint(answers, kb) {
  const a = normalize(answers);
  const ranked = recommendPatterns(a, kb);
  const patternId = a.patternOverride || ranked[0].id;
  const pattern = kb.patterns.find((p) => p.id === patternId);
  const risk = assessRisk(a, kb);
  const controls = selectControls(a, kb, risk.tier, patternId);
  const arch = architecture(a, kb, patternId);
  const cost = estimateCost(a, kb, patternId);
  const evals = [...(kb.metrics[patternId] || []), ...(patternId === "multi-agent" ? kb.metrics.agent : []), ...kb.metrics.common];
  const ready = readiness(a, kb);
  const plan = roadmap(a, kb, patternId, risk.tier);

  const decisions = [];
  if (a.patternOverride && a.patternOverride !== ranked[0].id) decisions.push(`You chose ${pattern.name} over the top-scored ${kb.patterns.find((p) => p.id === ranked[0].id).name}. Record why in an architecture decision record.`);
  if (a.build === "low-code" && (patternId === "multi-agent" || patternId === "fine-tune" || patternId === "classic-ml")) decisions.push("Low-code builders rarely cover this pattern end to end. Plan a pro-code component behind the low-code front end.");
  if (a.data.residency !== "any") decisions.push(`Confirm that every model and service listed is available in your required region (${a.data.residency.toUpperCase()}) and that global or cross-region inference is disabled.`);
  if (a.actions === "write" && a.autonomy === "autonomous") decisions.push("Fully autonomous write actions are rarely justified at launch. Start with human approval and raise autonomy only when task success and unsafe-action metrics support it.");
  if (cost.usesDefaults) decisions.push("The cost estimate uses example placeholder rates. Replace them with your contracted prices before sharing the number.");
  if (risk.tier >= 3) decisions.push("EU AI Act high-risk obligations have phased dates that may be adjusted by later EU legislation. Have legal confirm the dates that apply to you.");

  const verify = arch.components.filter((c) => c.verify).map((c) => `${c.label}: ${c.service}`);

  return {
    schema: SCHEMA, engineVersion: ENGINE_VERSION, kbVersion: kb.kbVersion, kbReviewed: kb.lastReviewed,
    generatedAt: new Date().toISOString(),
    answers: a,
    useCase: kb.useCases.find((u) => u.id === a.useCase),
    domain: kb.domains.find((d) => d.id === a.domain),
    pattern, alternatives: ranked.filter((r) => r.id !== patternId && r.score > 0).slice(0, 2).map((r) => ({ ...r, name: kb.patterns.find((p) => p.id === r.id).name })),
    patternReasons: (ranked.find((r) => r.id === patternId) || { reasons: [] }).reasons,
    risk, controls, architecture: arch, cost, evaluation: evals, readiness: ready, roadmap: plan,
    decisions, verify, references: kb.references
  };
}

// ---------- Renderers ----------

function esc(s) { return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " "); }

export function toMarkdown(bp) {
  const a = bp.answers;
  const L = [];
  const title = a.meta.name || "Untitled AI solution";
  L.push(`# ${title}: AI Solution Blueprint`, "");
  L.push(`Generated by AI Solution Blueprint ${bp.engineVersion} from azCloudOps (knowledge base ${bp.kbVersion}, reviewed ${bp.kbReviewed}).`, "");
  L.push("## 1. Summary", "");
  L.push("| Item | Value |", "|---|---|");
  L.push(`| Business owner | ${esc(a.meta.owner) || "Not set"} |`);
  L.push(`| Team | ${esc(a.meta.team) || "Not set"} |`);
  L.push(`| Problem | ${esc(a.idea.problem) || "Not set"} |`);
  L.push(`| Success metric | ${esc(a.idea.successMetric) || "Not set"} |`);
  L.push(`| Use case | ${esc(bp.useCase.label)} |`);
  L.push(`| Recommended pattern | ${bp.pattern.name} |`);
  L.push(`| Platform | ${bp.architecture.providerName} (${a.build}) |`);
  L.push(`| Risk tier | ${bp.risk.tier}: ${bp.risk.name} |`);
  L.push(`| Estimated monthly run cost | ${money(bp.cost.total)} (${money(bp.cost.perTask)} per task) |`);
  L.push(`| Production readiness | ${bp.readiness.score}% (reached: ${bp.readiness.reached}; next: ${bp.readiness.next}) |`);
  L.push(`| Indicative time to production | ${bp.roadmap.weeksToProduction} weeks |`, "");

  L.push("## 2. Solution pattern", "");
  L.push(`**${bp.pattern.name}.** ${bp.pattern.summary}`, "");
  L.push(`When to use: ${bp.pattern.whenToUse}`, "");
  L.push(`Watch out: ${bp.pattern.watchOut}`, "");
  if (bp.patternReasons.length) { L.push("Why this pattern:", ""); bp.patternReasons.forEach((r) => L.push(`- ${r}`)); L.push(""); }
  if (bp.alternatives.length) { L.push("Alternatives considered:", ""); bp.alternatives.forEach((r) => L.push(`- ${r.name} (score ${r.score})`)); L.push(""); }

  L.push("## 3. Reference architecture", "");
  L.push(`Provider: ${bp.architecture.providerName}. Service names marked "verify" change often; confirm against ${bp.architecture.docs} before committing.`, "");
  L.push("| Layer | Component | Service | Verify |", "|---|---|---|---|");
  bp.architecture.components.forEach((c) => L.push(`| ${c.layer} | ${c.label} | ${esc(c.service)} | ${c.verify ? "yes" : ""} |`));
  L.push("", "```mermaid", toMermaid(bp), "```", "");

  L.push("## 4. Data", "");
  L.push(`- Sources: ${a.data.sources || "Not set"}`);
  L.push(`- Sensitivity: ${a.data.sensitivity}`);
  L.push(`- Freshness: ${a.data.freshness}`);
  L.push(`- Approximate documents or records: ${Number(a.data.docCount).toLocaleString("en-US")}`);
  L.push(`- Residency requirement: ${a.data.residency}`, "");

  L.push("## 5. Risk and governance", "");
  L.push(`Risk tier ${bp.risk.tier} (${bp.risk.name}). ${bp.risk.description}`, "");
  L.push("Factors:", ""); bp.risk.factors.forEach((f) => L.push(`- ${f}`)); L.push("");
  L.push("This tiering is a design aid, not legal advice. Your legal and risk teams own the final classification.", "");
  L.push("| Control | Category | Framework references |", "|---|---|---|");
  bp.controls.forEach((c) => L.push(`| ${esc(c.title)} | ${c.category} | ${c.refs.join("; ")} |`));
  L.push("");

  L.push("## 6. Evaluation plan", "");
  L.push("| Metric | Target |", "|---|---|");
  bp.evaluation.forEach((m) => L.push(`| ${m.name} | ${esc(m.target)} |`));
  L.push("", "Run the evaluation suite on every change to prompts, models, tools or the index, and block releases that regress.", "");

  L.push("## 7. Cost estimate (monthly, USD)", "");
  L.push("| Item | Monthly | Basis |", "|---|---|---|");
  bp.cost.lines.forEach((l) => L.push(`| ${l.item} | ${money(l.monthly)} | ${esc(l.basis)} |`));
  L.push(`| **Total** | **${money(bp.cost.total)}** | ${money(bp.cost.perTask)} per task |`, "");
  if (bp.cost.initialEmbedding > 0) L.push(`One-time initial embedding of the corpus: ${money(bp.cost.initialEmbedding)}.`, "");
  L.push(`FinOps guardrails: set a hard monthly cap of ${money(bp.cost.recommendedCap)} and alert at ${money(bp.cost.alertAt)}. Attribute every call to a team through the gateway and export usage in FOCUS format.`, "");
  L.push(`Rates used: input ${money(bp.cost.rates.inputPer1M)}, output ${money(bp.cost.rates.outputPer1M)}, embeddings ${money(bp.cost.rates.embeddingPer1M)} per million tokens. ${bp.cost.usesDefaults ? bp.cost.note : ""}`, "");

  L.push("## 8. Operations", "");
  [
    "Trace every request with OpenTelemetry GenAI semantic conventions: prompts, tool calls, tokens, latency and cost.",
    "Pin model versions; track retirement dates and re-run evaluations before every upgrade.",
    "Define SLOs for latency, availability and quality; page on quality regressions, not only on errors.",
    "Keep AI incident runbooks for harmful output, data leakage, runaway cost and misbehaving agents.",
    "Review unit economics and user feedback monthly with the business owner and FinOps."
  ].forEach((x) => L.push(`- ${x}`));
  L.push("");

  L.push("## 9. Delivery roadmap", "");
  L.push("| Phase | Weeks | Focus |", "|---|---|---|");
  bp.roadmap.phases.forEach((p) => L.push(`| ${p.name} | ${p.endWeek ? `${p.startWeek} to ${p.endWeek}` : `${p.startWeek} onward`} | ${esc(p.focus)} |`));
  L.push("");

  L.push("## 10. Production readiness checklist", "");
  bp.readiness.byStage.forEach((st) => {
    L.push(`### ${st.name} (${st.doneCount}/${st.items.length})`, "");
    st.items.forEach((i) => L.push(`- [${i.done ? "x" : " "}] ${i.text}`));
    L.push("");
  });

  if (bp.decisions.length) { L.push("## 11. Open decisions", ""); bp.decisions.forEach((d) => L.push(`- ${d}`)); L.push(""); }
  if (bp.verify.length) { L.push("## 12. Verify before committing", ""); bp.verify.forEach((v) => L.push(`- ${v}`)); L.push(""); }
  L.push("## References", "");
  bp.references.forEach((r) => L.push(`- [${r.title}](${r.url})`));
  L.push("", "Built with AI Solution Blueprint from azCloudOps: https://azcloudops.org", "");
  return L.join("\n");
}

export function toMermaid(bp) {
  const comps = bp.architecture.components;
  const id = (c) => c.id.replace(/[^a-z0-9]/gi, "_");
  const label = (c) => `${c.label}<br/>${c.service}`.replace(/"/g, "'");
  const byLayer = (l) => comps.filter((c) => c.layer === l);
  const out = ["flowchart TB", '  users(["Users"])'];
  const layers = [["experience", "Experience"], ["edge", "Edge"], ["orchestration", "Orchestration"], ["intelligence", "Intelligence"], ["data", "Data"], ["cross", "Cross-cutting"]];
  for (const [l, name] of layers) {
    const cs = byLayer(l);
    if (!cs.length) continue;
    out.push(`  subgraph ${l}["${name}"]`);
    cs.forEach((c) => out.push(`    ${id(c)}["${label(c)}"]`));
    out.push("  end");
  }
  const flow = layers.slice(0, 5).map(([l]) => l).filter((l) => byLayer(l).length);
  out.push(`  users --> ${flow[0]}`);
  for (let i = 0; i < flow.length - 1; i++) out.push(`  ${flow[i]} --> ${flow[i + 1]}`);
  if (byLayer("cross").length) out.push(`  cross -.-> ${flow.includes("orchestration") ? "orchestration" : flow[Math.min(1, flow.length - 1)]}`);
  return out.join("\n");
}

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function x(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

export function toSVG(bp) {
  const W = 1200, pad = 24, crossW = 260, mainW = W - pad * 3 - crossW;
  const layers = [["experience", "Experience"], ["edge", "Edge and identity"], ["orchestration", "Orchestration"], ["intelligence", "Intelligence"], ["data", "Data"]];
  const comps = bp.architecture.components;
  const rowH = 104, top = 120;
  const rows = layers.filter(([l]) => comps.some((c) => c.layer === l));
  const cross = comps.filter((c) => c.layer === "cross");
  const H = Math.max(top + rows.length * (rowH + 22) + 40, top + cross.length * 92 + 60);
  const P = { blue: "#4A86E8", deep: "#2F6FD6", ink: "#1B2A41", muted: "#4A5B75", tint: "#EEF4FD", mist: "#F7F9FC", border: "#E1E8F3", yellow: "#F4B63F", green: "#4CA45A", red: "#DB4A3B" };
  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'IBM Plex Sans', 'Segoe UI', Arial, sans-serif" role="img" aria-label="Reference architecture for ${x(bp.answers.meta.name || "AI solution")}">`);
  s.push(`<rect width="${W}" height="${H}" fill="#FFFFFF"/>`);
  const stripe = [P.blue, P.red, P.yellow, P.green];
  stripe.forEach((c, i) => s.push(`<rect x="${(W / 4) * i}" y="0" width="${W / 4}" height="4" fill="${c}"/>`));
  s.push(`<text x="${pad}" y="44" font-size="22" font-weight="700" fill="${P.ink}">${x(bp.answers.meta.name || "AI solution")}: ${x(bp.pattern.name)} on ${x(bp.architecture.providerName)}</text>`);
  s.push(`<text x="${pad}" y="70" font-size="14" fill="${P.muted}">Risk tier ${bp.risk.tier} (${x(bp.risk.name)}) · ${x(bp.useCase.label)} · AI Solution Blueprint ${x(bp.engineVersion)} · knowledge base ${x(bp.kbVersion)}</text>`);
  s.push(`<rect x="${pad + mainW / 2 - 60}" y="86" width="120" height="26" rx="13" fill="${P.deep}"/><text x="${pad + mainW / 2}" y="104" text-anchor="middle" font-size="13" font-weight="600" fill="#FFFFFF">Users</text>`);
  rows.forEach(([l, name], ri) => {
    const y = top + ri * (rowH + 22);
    const cs = comps.filter((c) => c.layer === l);
    s.push(`<line x1="${pad + mainW / 2}" y1="${ri === 0 ? 112 : y - 22}" x2="${pad + mainW / 2}" y2="${y}" stroke="${P.blue}" stroke-width="2" marker-end="url(#arrow)"/>`);
    s.push(`<rect x="${pad}" y="${y}" width="${mainW}" height="${rowH}" rx="12" fill="${P.tint}" stroke="${P.border}"/>`);
    s.push(`<text x="${pad + 14}" y="${y + 20}" font-size="11" font-weight="700" letter-spacing="1" fill="#2563C9">${x(name.toUpperCase())}</text>`);
    const gap = 12, inner = mainW - 28, bw = (inner - gap * (cs.length - 1)) / cs.length;
    cs.forEach((c, ci) => {
      const bx = pad + 14 + ci * (bw + gap), by = y + 28;
      s.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${rowH - 38}" rx="8" fill="#FFFFFF" stroke="${P.border}"/>`);
      s.push(`<rect x="${bx}" y="${by}" width="${bw}" height="3" fill="${P.blue}"/>`);
      s.push(`<text x="${bx + 10}" y="${by + 20}" font-size="12" font-weight="700" fill="${P.ink}">${x(c.label)}${c.verify ? " *" : ""}</text>`);
      wrap(c.service, Math.max(16, Math.floor(bw / 6.6))).slice(0, 3).forEach((ln, li) => s.push(`<text x="${bx + 10}" y="${by + 37 + li * 14}" font-size="11" fill="${P.muted}">${x(ln)}</text>`));
    });
  });
  const cx0 = pad * 2 + mainW;
  s.push(`<rect x="${cx0}" y="${top}" width="${crossW}" height="${H - top - 24}" rx="12" fill="${P.mist}" stroke="${P.border}"/>`);
  s.push(`<text x="${cx0 + 14}" y="${top + 20}" font-size="11" font-weight="700" letter-spacing="1" fill="#2563C9">CROSS-CUTTING</text>`);
  cross.forEach((c, i) => {
    const by = top + 30 + i * 92;
    s.push(`<rect x="${cx0 + 12}" y="${by}" width="${crossW - 24}" height="80" rx="8" fill="#FFFFFF" stroke="${P.border}"/>`);
    s.push(`<rect x="${cx0 + 12}" y="${by}" width="3" height="80" fill="${P.yellow}"/>`);
    s.push(`<text x="${cx0 + 24}" y="${by + 20}" font-size="12" font-weight="700" fill="${P.ink}">${x(c.label)}${c.verify ? " *" : ""}</text>`);
    wrap(c.service, 34).slice(0, 3).forEach((ln, li) => s.push(`<text x="${cx0 + 24}" y="${by + 38 + li * 14}" font-size="11" fill="${P.muted}">${x(ln)}</text>`));
  });
  s.push(`<text x="${pad}" y="${H - 8}" font-size="11" fill="${P.muted}">* Verify current service name and regional availability against the provider's documentation. azcloudops.org</text>`);
  s.push(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${P.blue}"/></marker></defs>`);
  s.push("</svg>");
  return s.join("\n");
}
