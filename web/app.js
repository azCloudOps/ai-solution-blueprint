(function () {
  "use strict";
  const E = AIBlueprint;
  const STORE = "aiblueprint:v1";
  // Preview builds run inside sandboxed viewers that block downloads, print and dialogs.
  const PREVIEW = typeof AIBP_PREVIEW !== "undefined" && AIBP_PREVIEW === true;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const STEPS = [
    { id: "idea", title: "Idea" },
    { id: "usecase", title: "Use case" },
    { id: "data", title: "Data" },
    { id: "risk", title: "Actions and risk" },
    { id: "platform", title: "Platform" },
    { id: "cost", title: "Scale and cost" },
    { id: "ready", title: "Readiness" },
    { id: "blueprint", title: "Blueprint" }
  ];

  let state = load();
  let step = 0;

  function load() {
    const fromHash = readHash();
    if (fromHash) return E.normalize(fromHash);
    try { const raw = localStorage.getItem(STORE); if (raw) return E.normalize(JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
    return E.defaultAnswers();
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  function b64u(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }
  function readHash() {
    const m = location.hash.match(/bp=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    try { return JSON.parse(unb64u(m[1])); } catch (e) { return null; }
  }

  function getPath(path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), state); }
  function setPath(path, value) {
    const keys = path.split(".");
    let o = state;
    keys.slice(0, -1).forEach((k) => { if (typeof o[k] !== "object" || o[k] === null) o[k] = {}; o = o[k]; });
    o[keys[keys.length - 1]] = value;
  }

  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200); }

  // ---------- Field helpers ----------
  function text(path, label, opts = {}) {
    const v = getPath(path) ?? "";
    const tag = opts.area ? `<textarea id="${path}" data-path="${path}" placeholder="${h(opts.ph || "")}">${h(v)}</textarea>` : `<input type="text" id="${path}" data-path="${path}" value="${h(v)}" placeholder="${h(opts.ph || "")}">`;
    return `<div class="field"><label class="l" for="${path}">${h(label)}</label>${tag}${opts.hint ? `<div class="hint">${h(opts.hint)}</div>` : ""}</div>`;
  }
  function number(path, label, opts = {}) {
    const v = getPath(path);
    return `<div class="field"><label class="l" for="${path}">${h(label)}</label><input type="number" min="0" step="${opts.step || "any"}" id="${path}" data-path="${path}" data-type="number" value="${v === null || v === undefined ? "" : h(v)}" placeholder="${h(opts.ph ?? "")}">${opts.hint ? `<div class="hint">${h(opts.hint)}</div>` : ""}</div>`;
  }
  function choice(path, label, items) {
    const v = getPath(path);
    return `<fieldset class="field" style="border:none;padding:0;margin:0 0 18px"><legend class="l">${h(label)}</legend><div class="choices">${items.map((it) =>
      `<label class="choice"><input type="radio" name="${path}" data-path="${path}" value="${h(it.v)}" ${v === it.v ? "checked" : ""}><span><b>${h(it.t)}</b>${it.d ? `<small>${h(it.d)}</small>` : ""}</span></label>`).join("")}</div></fieldset>`;
  }
  function select(path, label, items, hint) {
    const v = getPath(path);
    return `<div class="field"><label class="l" for="${path}">${h(label)}</label><select id="${path}" data-path="${path}">${items.map((it) => `<option value="${h(it.v)}" ${v === it.v ? "selected" : ""}>${h(it.t)}</option>`).join("")}</select>${hint ? `<div class="hint">${h(hint)}</div>` : ""}</div>`;
  }
  function check(path, label, hint) {
    return `<label><input type="checkbox" data-path="${path}" data-type="bool" ${getPath(path) ? "checked" : ""}><span><b>${h(label)}</b>${hint ? `<br><span class="small muted">${h(hint)}</span>` : ""}</span></label>`;
  }

  // ---------- Steps ----------
  function renderStep(bp) {
    const s = STEPS[step].id;
    let body = "";
    if (s === "idea") {
      body = `<h2>Start with the idea</h2><p class="lead">Describe the problem in business terms. A clear owner and success metric is the strongest predictor that an AI project reaches production.</p>
      ${text("meta.name", "Solution name", { ph: "For example: IT Help Desk Answers" })}
      <div class="row">${text("meta.owner", "Accountable business owner", { ph: "Role or name" })}${text("meta.team", "Delivery team", { ph: "Team name" })}</div>
      ${text("idea.problem", "What problem are you solving?", { area: true, ph: "Who struggles with what today, and what does it cost?" })}
      ${text("idea.successMetric", "How will you measure success?", { ph: "For example: cut time to resolution by 30 percent" })}
      ${text("idea.value", "Value hypothesis", { ph: "If this works, what changes for the business?" })}
      ${choice("idea.users", "Who will use it?", [{ v: "internal", t: "Employees only" }, { v: "external", t: "Customers or the public" }, { v: "both", t: "Both" }])}
      ${number("idea.userCount", "Approximate number of users", { step: 1 })}`;
    } else if (s === "usecase") {
      const ranked = E.recommendPatterns(state, KB);
      body = `<h2>What should the AI do?</h2><p class="lead">Pick the closest match. The recommendation updates as you answer.</p>
      ${choice("useCase", "Primary use case", KB.useCases.map((u) => ({ v: u.id, t: u.label, d: u.example })))}
      ${select("domain", "Business domain", KB.domains.map((d) => ({ v: d.id, t: d.label })), "Some domains are treated as high-risk by regulation. This affects the risk tier.")}
      <div class="field"><span class="l">Special requirements</span><div class="checks">
        ${check("needs.style", "Strict, consistent output style or format", "Brand voice, fixed templates, domain jargon")}
        ${check("needs.highVolume", "Very high volume or tight unit cost", "Millions of requests per month")}
        ${check("needs.lowLatency", "Low latency is critical", "Inline experiences, voice, real-time triage")}
        ${check("needs.multiTeam", "Several teams own different parts of the work", "Distinct tools, permissions or owners per sub-task")}
      </div></div>
      <div class="callout blue"><h3>Recommended pattern: ${h(bp.pattern.name)}</h3><p style="margin:0">${h(bp.pattern.summary)}</p>
        <ul>${bp.patternReasons.map((r) => `<li>${h(r)}</li>`).join("")}</ul>
        <p class="small" style="margin:10px 0 0"><b>Watch out:</b> ${h(bp.pattern.watchOut)}</p></div>
      ${select("patternOverride", "Use a different pattern (optional)", [{ v: "", t: "Use the recommendation" }].concat(ranked.map((r) => ({ v: r.id, t: `${KB.patterns.find((p) => p.id === r.id).name} (score ${r.score})` }))), "Overrides are recorded in the blueprint as an open decision.")}`;
    } else if (s === "data") {
      body = `<h2>Know your data</h2><p class="lead">Data sensitivity and freshness shape the pattern, the controls and the cost.</p>
      ${text("data.sources", "Data sources", { area: true, ph: "For example: ServiceNow knowledge, SharePoint policies, CRM records" })}
      ${choice("data.sensitivity", "Most sensitive data in scope", [{ v: "public", t: "Public" }, { v: "internal", t: "Internal", d: "General business data" }, { v: "confidential", t: "Confidential", d: "Commercial or security sensitive" }, { v: "regulated", t: "Regulated or personal", d: "PII, health, financial, legal hold" }])}
      ${choice("data.freshness", "How often does it change?", [{ v: "static", t: "Rarely", d: "Quarterly or less" }, { v: "daily", t: "Daily or weekly" }, { v: "realtime", t: "Real time", d: "Must reflect the current state" }])}
      <div class="row">${number("data.docCount", "Approximate documents or records", { step: 1, hint: "Used for indexing and embedding cost." })}
      ${select("data.residency", "Data residency requirement", [{ v: "any", t: "No restriction" }, { v: "eu", t: "European Union" }, { v: "us", t: "United States" }, { v: "other", t: "Other specific region" }])}</div>`;
    } else if (s === "risk") {
      body = `<h2>Actions, autonomy and impact</h2><p class="lead">What the AI is allowed to do matters more than which model it uses.</p>
      ${choice("actions", "Does it act in other systems?", [{ v: "none", t: "No, it only responds" }, { v: "read", t: "Reads live data", d: "Queries APIs or databases" }, { v: "write", t: "Changes data or takes actions", d: "Creates, updates, provisions, sends" }])}
      ${choice("autonomy", "Human involvement", [{ v: "assist", t: "Assists a person", d: "A person decides and acts" }, { v: "approve", t: "Human approves", d: "AI proposes, a person approves" }, { v: "autonomous", t: "Autonomous", d: "Acts without review" }])}
      ${choice("decisionImpact", "Impact of outputs on people", [{ v: "low", t: "Low", d: "Convenience and productivity" }, { v: "medium", t: "Medium", d: "Influences decisions about people or money" }, { v: "high", t: "High", d: "Affects rights, access, safety or livelihoods" }])}
      <div class="callout ${bp.risk.tier >= 3 ? "red" : "green"}"><h3>Risk tier <span class="tier t${bp.risk.tier}">${bp.risk.tier}: ${h(bp.risk.name)}</span></h3><p style="margin:0">${h(bp.risk.description)}</p>
      <ul>${bp.risk.factors.map((f) => `<li>${h(f)}</li>`).join("")}</ul><p class="small" style="margin:10px 0 0">${bp.controls.length} controls apply. A design aid, not legal advice.</p></div>`;
    } else if (s === "platform") {
      body = `<h2>Choose a platform</h2><p class="lead">The blueprint maps each component to current services on the platform you pick. Service names flagged for verification change often.</p>
      ${choice("platform", "Primary platform", [{ v: "azure", t: "Microsoft Azure", d: "Microsoft Foundry" }, { v: "aws", t: "Amazon Web Services", d: "Amazon Bedrock and AgentCore" }, { v: "gcp", t: "Google Cloud", d: "Gemini Enterprise Agent Platform" }, { v: "portable", t: "Portable / multi-cloud", d: "Kubernetes, OpenTelemetry, MCP" }])}
      ${choice("build", "Build approach", [{ v: "pro-code", t: "Pro-code", d: "SDKs, containers, infrastructure as code" }, { v: "low-code", t: "Low-code front end", d: "Maker tools with pro-code where needed" }])}
      ${archTable(bp)}`;
    } else if (s === "cost") {
      const d = KB.costDefaults;
      const agentish = bp.pattern.id === "agent" || bp.pattern.id === "multi-agent";
      body = `<h2>Scale and run cost</h2><p class="lead">Estimate monthly run cost before you build. Blank price fields use example placeholder rates.</p>
      <div class="row">${number("scale.requestsPerDay", "Tasks or requests per day", { step: 1 })}${number("scale.inputTokens", "Input tokens per call", { step: 1, hint: "Prompt, history and retrieved context" })}${number("scale.outputTokens", "Output tokens per call", { step: 1 })}
      ${agentish ? number("scale.stepsPerTask", "Model calls per task", { step: 1, hint: "Agents plan, call tools and reflect" }) : ""}</div>
      <div class="callout"><h3>Your rates (USD)</h3><p class="small" style="margin:0 0 10px">${h(d.note)}</p>
      <div class="row">${number("scale.inputPer1M", "Input per 1M tokens", { ph: d.inputPer1M })}${number("scale.outputPer1M", "Output per 1M tokens", { ph: d.outputPer1M })}${number("scale.embeddingPer1M", "Embeddings per 1M tokens", { ph: d.embeddingPer1M })}${number("scale.tokensPerDoc", "Tokens per document", { ph: d.tokensPerDoc })}</div>
      <div class="row">${number("scale.retrievalMonthly", "Search / vector index per month", { ph: d.retrievalMonthly })}${number("scale.hostingMonthly", "Hosting per month", { ph: d.hostingMonthly })}${number("scale.observabilityMonthly", "Observability per month", { ph: d.observabilityMonthly })}</div></div>
      <div id="liveCost">${costTable(bp)}</div>`;
    } else if (s === "ready") {
      body = `<h2>Production readiness</h2><p class="lead">Tick what is already true. The blueprint shows the stage you have reached and what blocks the next one.</p>
      ${bp.readiness.byStage.map((st) => `<div class="field"><span class="l">${h(st.name)} <span class="muted small">(${st.doneCount}/${st.items.length})</span></span><div class="checks">${st.items.map((i) =>
        `<label><input type="checkbox" data-ready="${i.id}" ${i.done ? "checked" : ""}><span>${h(i.text)}</span></label>`).join("")}</div></div>`).join("")}`;
    } else {
      body = blueprintView(bp);
    }
    const nav = `<div class="nav-buttons">${step > 0 ? `<button type="button" data-go="${step - 1}">Back</button>` : "<span></span>"}${step < STEPS.length - 1 ? `<button type="button" class="primary" data-go="${step + 1}">${step === STEPS.length - 2 ? "Generate blueprint" : "Next"}</button>` : `<button type="button" data-go="0">Edit answers</button>`}</div>`;
    $("#stage").innerHTML = `<div class="card">${body}${nav}</div>`;
  }

  function archTable(bp) {
    return `<table><thead><tr><th>Component</th><th>${h(bp.architecture.providerName)} service</th></tr></thead><tbody>${bp.architecture.components.map((c) =>
      `<tr><td>${h(c.label)}</td><td>${h(c.service)} ${c.verify ? '<span class="tag">verify</span>' : ""}</td></tr>`).join("")}</tbody></table>`;
  }
  function costTable(bp) {
    const c = bp.cost;
    return `<table><thead><tr><th>Item</th><th>Basis</th><th style="text-align:right">Monthly</th></tr></thead><tbody>${c.lines.map((l) =>
      `<tr><td>${h(l.item)}</td><td class="small muted">${h(l.basis)}</td><td class="num">${E.money(l.monthly)}</td></tr>`).join("")}
      <tr><th>Total</th><th class="small">${E.money(c.perTask)} per task</th><th class="num" style="text-align:right">${E.money(c.total)}</th></tr></tbody></table>
      ${c.initialEmbedding > 0 ? `<p class="small muted">One-time initial embedding: ${E.money(c.initialEmbedding)}.</p>` : ""}
      <div class="callout green"><h3>FinOps guardrails</h3><p style="margin:0">Set a hard monthly cap of <b>${E.money(c.recommendedCap)}</b> and alert at ${E.money(c.alertAt)}. Attribute every call to a team through the gateway and export usage in FOCUS format.</p></div>`;
  }

  function blueprintView(bp) {
    const a = bp.answers;
    const sec = (t, inner) => `<div class="bp-section"><h3>${h(t)}</h3>${inner}</div>`;
    return `<h2>${h(a.meta.name || "Untitled AI solution")}: blueprint</h2>
    <p class="lead">Knowledge base ${h(bp.kbVersion)}, reviewed ${h(bp.kbReviewed)}. Engine ${h(bp.engineVersion)}.</p>
    <div class="export">
      <button type="button" class="primary" data-export="md">Download Markdown</button>
      <button type="button" data-export="json">Download JSON</button>
      <button type="button" data-export="svg">Download diagram (SVG)</button>
      <button type="button" data-export="mermaid">Copy Mermaid</button>
      <button type="button" data-export="print">Print or save as PDF</button>
    </div>
    ${sec("Summary", `<table><tbody>
      <tr><th>Owner</th><td>${h(a.meta.owner || "Not set")}</td></tr>
      <tr><th>Problem</th><td>${h(a.idea.problem || "Not set")}</td></tr>
      <tr><th>Success metric</th><td>${h(a.idea.successMetric || "Not set")}</td></tr>
      <tr><th>Pattern</th><td>${h(bp.pattern.name)}</td></tr>
      <tr><th>Platform</th><td>${h(bp.architecture.providerName)} (${h(a.build)})</td></tr>
      <tr><th>Risk tier</th><td><span class="tier t${bp.risk.tier}">${bp.risk.tier}: ${h(bp.risk.name)}</span></td></tr>
      <tr><th>Monthly run cost</th><td>${E.money(bp.cost.total)} (${E.money(bp.cost.perTask)} per task)</td></tr>
      <tr><th>Time to production</th><td>About ${bp.roadmap.weeksToProduction} weeks</td></tr>
      <tr><th>Readiness</th><td>${bp.readiness.score}% (reached ${h(bp.readiness.reached)}, next ${h(bp.readiness.next)})</td></tr></tbody></table>`)}
    ${sec("Solution pattern", `<p><b>${h(bp.pattern.name)}.</b> ${h(bp.pattern.summary)}</p><p class="small"><b>When to use:</b> ${h(bp.pattern.whenToUse)}</p><p class="small"><b>Watch out:</b> ${h(bp.pattern.watchOut)}</p>
      ${bp.alternatives.length ? `<p class="small muted">Alternatives considered: ${bp.alternatives.map((x) => h(x.name)).join(", ")}.</p>` : ""}`)}
    ${sec("Reference architecture", `<div class="arch-wrap">${E.toSVG(bp)}</div>${archTable(bp)}`)}
    ${sec(`Governance controls (${bp.controls.length})`, `<p class="small muted">${h(bp.risk.description)} A design aid, not legal advice.</p><table><thead><tr><th>Control</th><th>Category</th><th>References</th></tr></thead><tbody>${bp.controls.map((c) =>
      `<tr><td>${h(c.title)}</td><td>${h(c.category)}</td><td class="small">${h(c.refs.join("; "))}</td></tr>`).join("")}</tbody></table>`)}
    ${sec("Evaluation plan", `<table><thead><tr><th>Metric</th><th>Target</th></tr></thead><tbody>${bp.evaluation.map((m) => `<tr><td>${h(m.name)}</td><td>${h(m.target)}</td></tr>`).join("")}</tbody></table>`)}
    ${sec("Cost estimate", costTable(bp))}
    ${sec("Delivery roadmap", `<table><thead><tr><th>Phase</th><th>Weeks</th><th>Focus</th></tr></thead><tbody>${bp.roadmap.phases.map((p) =>
      `<tr><td>${h(p.name)}</td><td class="num">${p.endWeek ? `${p.startWeek} to ${p.endWeek}` : `${p.startWeek} onward`}</td><td>${h(p.focus)}</td></tr>`).join("")}</tbody></table>`)}
    ${bp.decisions.length ? sec("Open decisions", `<ul>${bp.decisions.map((d) => `<li>${h(d)}</li>`).join("")}</ul>`) : ""}
    ${sec("References", `<ul>${bp.references.map((r) => `<li><a href="${h(r.url)}" rel="noopener" target="_blank">${h(r.title)}</a></li>`).join("")}<li><a href="${h(bp.architecture.docs)}" rel="noopener" target="_blank">${h(bp.architecture.providerName)} documentation</a></li></ul>`)}`;
  }

  function renderSummary(bp) {
    $("#summary").innerHTML = `<div class="card"><h3>Live blueprint</h3>
      <div class="kpi"><div class="k">Pattern</div><div class="v">${h(bp.pattern.name)}</div></div>
      <div class="kpi"><div class="k">Risk tier</div><div class="v"><span class="tier t${bp.risk.tier}">${bp.risk.tier}: ${h(bp.risk.name)}</span></div><div class="s">${bp.controls.length} controls apply</div></div>
      <div class="kpi"><div class="k">Monthly run cost</div><div class="v">${E.money(bp.cost.total)}</div><div class="s">${E.money(bp.cost.perTask)} per task${bp.cost.usesDefaults ? ", example rates" : ""}</div></div>
      <div class="kpi"><div class="k">Platform</div><div class="v">${h(bp.architecture.providerName)}</div></div>
      <div class="kpi"><div class="k">Time to production</div><div class="v">About ${bp.roadmap.weeksToProduction} weeks</div></div>
      <div class="kpi"><div class="k">Readiness</div><div class="v">${bp.readiness.score}%</div><div class="bar"><i style="width:${bp.readiness.score}%"></i></div><div class="s">Next stage: ${h(bp.readiness.next)}</div></div>
    </div>`;
  }

  function renderNav() {
    $("#steps").innerHTML = STEPS.map((s, i) => `<button type="button" data-go="${i}" class="${i === step ? "active" : ""}" ${i === step ? 'aria-current="step"' : ""}><span class="n">${i + 1}</span>${h(s.title)}</button>`).join("");
  }

  function render() {
    const bp = E.buildBlueprint(state, KB);
    renderNav(); renderStep(bp); renderSummary(bp);
  }
  function refreshLive() {
    const bp = E.buildBlueprint(state, KB);
    renderSummary(bp);
    const lc = $("#liveCost"); if (lc) lc.innerHTML = costTable(bp);
    return bp;
  }

  // ---------- Events ----------
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.path || el.type === "radio" || el.type === "checkbox" || el.tagName === "SELECT") return;
    let v = el.value;
    if (el.dataset.type === "number") v = v === "" ? null : Number(v);
    setPath(el.dataset.path, v); save(); refreshLive();
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.ready) {
      const set = new Set(state.readiness.done || []);
      el.checked ? set.add(el.dataset.ready) : set.delete(el.dataset.ready);
      state.readiness.done = [...set]; save(); render(); return;
    }
    if (!el.dataset || !el.dataset.path) return;
    if (el.type === "radio" || el.type === "checkbox" || el.tagName === "SELECT") {
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (el.dataset.path === "patternOverride" && v === "") v = null;
      setPath(el.dataset.path, v); save();
      const y = window.scrollY; render(); window.scrollTo(0, y);
    }
  });
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { step = Number(go.dataset.go); render(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const ex = e.target.closest("[data-export]");
    if (ex) doExport(ex.dataset.export);
  });

  function download(name, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function slug() { return (state.meta.name || "ai-solution").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-solution"; }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); }
    catch (e) { if (PREVIEW) toast("Copy was blocked by the viewer"); else window.prompt("Copy this:", text); }
  }
  function doExport(kind) {
    const bp = E.buildBlueprint(state, KB);
    if (PREVIEW) {
      if (kind === "md") return copy(E.toMarkdown(bp), "Markdown copied to the clipboard");
      if (kind === "json") return copy(JSON.stringify(state, null, 2), "JSON copied to the clipboard");
      if (kind === "svg") return copy(E.toSVG(bp), "SVG copied to the clipboard");
    }
    if (kind === "md") download(`${slug()}-blueprint.md`, "text/markdown", E.toMarkdown(bp));
    if (kind === "json") download(`${slug()}-blueprint.json`, "application/json", JSON.stringify(state, null, 2));
    if (kind === "svg") download(`${slug()}-architecture.svg`, "image/svg+xml", E.toSVG(bp));
    if (kind === "mermaid") copy(E.toMermaid(bp), "Mermaid diagram copied");
    if (kind === "print") window.print();
  }

  $("#example").addEventListener("change", (e) => {
    const k = e.target.value; if (!k) return;
    state = E.normalize(EXAMPLES[k]); save(); step = STEPS.length - 1; render(); e.target.value = ""; toast("Example loaded");
  });
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        const errs = E.validateAnswers(data, KB);
        if (errs.length) { toast("Import failed: " + errs[0]); return; }
        state = E.normalize(data); save(); step = STEPS.length - 1; render(); toast("Blueprint imported");
      } catch (err) { toast("That file is not valid JSON"); }
    };
    r.readAsText(f); e.target.value = "";
  });
  $("#shareBtn").addEventListener("click", () => {
    const url = location.href.split("#")[0] + "#bp=" + b64u(JSON.stringify(state));
    copy(url, "Share link copied. The answers travel in the link itself.");
  });
  $("#resetBtn").addEventListener("click", () => {
    if (!PREVIEW && !window.confirm("Clear all answers and start a new blueprint?")) return;
    state = E.defaultAnswers(); save(); step = 0;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    render();
  });

  if (PREVIEW) {
    $("#shareBtn").hidden = true;
    const style = document.createElement("style");
    style.textContent = '[data-export="print"]{display:none!important}';
    document.head.appendChild(style);
    const note = document.createElement("div");
    note.className = "callout blue no-print";
    note.style.cssText = "margin:12px 24px 0";
    note.innerHTML = "<b>Preview build.</b> Export buttons copy to the clipboard here. The full version at azcloudops.org downloads files, prints to PDF and creates share links.";
    $("nav.steps").after(note);
  }
  $("#ver").textContent = `Version ${E.ENGINE_VERSION} · knowledge base ${KB.kbVersion}`;
  if (readHash()) step = STEPS.length - 1;
  render();
})();
