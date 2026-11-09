// Graph views: each returns {nodes:[{id,label,kind,size,color,meta}], edges:[{id,source,target,kind,size,color,meta}]}
import { D, dvx as dv, di, optionPairs, headToHead, optionStats, summarize, flip, cmpOK, mpOK, famOK, clsName, clsFam, famName, ttName, ttFam, tfName, linName, fmName, dimName, keyName, pretty, modelInfo, median } from "./kg.js";

export const FAM_COLORS = {
  prompting: "#8a8f98", single_agent_harness: "#4c78a8", verification_selection: "#e45756", memory_context: "#54a24b", retrieval: "#9ecae9",
  planning_search: "#f58518", multi_agent: "#b279a2", training_adaptation: "#eeca3b", workflow_optimisation: "#72b7b2", bare: "#bab0ac",
};
export const KIND_COLORS = { task: "#2a9d8f", taskfam: "#1d7268", model: "#7b61ff", lineage: "#5a45c9", failure: "#d1495b", cost: "#edae49", paper: "#9aa0a6", facet: "#6c8ebf", known: "#4c78a8" };
export function alpha(hex, a) { if (!hex.startsWith("#")) return hex; const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(2)})`; }
const winColor = (w) => { const t = Math.max(-1, Math.min(1, (w - 0.5) * 2.4)); return t >= 0 ? `rgba(46,160,90,${0.25 + 0.6 * t})` : `rgba(210,70,70,${0.25 + 0.6 * -t})`; };
export { winColor };
const nodeSize = (papers, max) => 4 + 22 * Math.sqrt(papers / Math.max(1, max));
const edgeSize = (papers, max) => 0.6 + 5 * Math.sqrt(papers / Math.max(1, max));

export const LEVELS = [
  { id: "family", name: "Approach families" }, { id: "class", name: "Methods (42 classes)" }, { id: "known", name: "Named methods (ReAct, Reflexion…)" },
  { id: "ctx", name: "Context-management mechanisms" }, { id: "ma", name: "Multi-agent structures" }, { id: "roles", name: "Role assignment" }, { id: "persona", name: "Personas & identities" },
];
function optColor(k) {
  if (k === "bare_model") return FAM_COLORS.bare;
  if (k.startsWith("fac:")) return KIND_COLORS.facet;
  if (FAM_COLORS[k]) return FAM_COLORS[k];
  const f = clsFam(k); return FAM_COLORS[f] || KIND_COLORS.known;
}

/** Methods network: options are nodes, head-to-head results are edges pointing to the usual winner */
export function methodsView(F, level) {
  const pairs = optionPairs(F, level);
  const st = optionStats(pairs);
  const keep = new Set([...st.entries()].filter(([, v]) => v.s.papers >= F.minP).map(([k]) => k));
  const nodes = [], edges = [];
  const maxP = Math.max(1, ...[...keep].map((k) => st.get(k).s.papers));
  for (const k of keep) {
    const s = st.get(k).s;
    nodes.push({ id: "opt:" + k, label: keyName(k), kind: "option", size: nodeSize(s.papers, maxP), color: optColor(k), meta: { key: k, level, s } });
  }
  const hh = headToHead(pairs).filter((e) => keep.has(e.x) && keep.has(e.y) && e.s.papers >= Math.max(2, Math.min(F.minP, 3)));
  const maxE = Math.max(1, ...hh.map((e) => e.s.papers));
  for (const e of hh) {
    const xw = e.s.win >= e.s.loss; // x usually wins
    const [src, tgt, w] = xw ? [e.x, e.y, e.s.win] : [e.y, e.x, e.s.loss];
    edges.push({ id: `h2h:${e.x}|${e.y}`, source: "opt:" + tgt, target: "opt:" + src, kind: "h2h", size: edgeSize(e.s.papers, maxE), color: alpha(optColor(src), 0.2 + 0.7 * Math.abs(e.s.win - e.s.loss)), meta: { x: e.x, y: e.y, s: e.s, rows: e.rows, level, winner: src } });
  }
  return { nodes, edges, directed: true };
}

/** Methods × tasks bipartite: tested-on edges coloured by how often the method won there */
export function methodTaskView(F, level, taskLevel) {
  const pairs = optionPairs({ ...F }, level);
  const M = new Map(), mPapers = new Map(), tPapers = new Map();
  for (const q of pairs) {
    const t0 = dv("tt", D.cmp.tt[q.i]); if (!t0 || t0 === "non_task_entry") continue;
    const t = taskLevel === "family" ? ttFam(t0) : t0; if (!t) continue;
    for (const [k, d] of [[q.a, q.d], [q.b, flip(q.d)]]) {
      if (k === "bare_model") continue;
      const key = k + "\u0001" + t; if (!M.has(key)) M.set(key, []); M.get(key).push({ p: q.p, d, i: q.i });
      if (!mPapers.has(k)) mPapers.set(k, new Set()); mPapers.get(k).add(q.p); if (!tPapers.has(t)) tPapers.set(t, new Set()); tPapers.get(t).add(q.p);
    }
  }
  const edges = [], used = new Set();
  const all = [...M.entries()].map(([key, rows]) => { const [k, t] = key.split("\u0001"); return { k, t, rows, s: summarize(rows) }; }).filter((e) => e.s.papers >= F.minP);
  const maxE = Math.max(1, ...all.map((e) => e.s.papers));
  for (const e of all) { used.add("opt:" + e.k); used.add("task:" + e.t); edges.push({ id: `on:${e.k}|${e.t}`, source: "opt:" + e.k, target: "task:" + e.t, kind: "tested_on", size: edgeSize(e.s.papers, maxE), color: winColor(e.s.win), meta: { k: e.k, t: e.t, s: e.s, rows: e.rows, level, taskLevel } }); }
  const maxM = Math.max(1, ...[...mPapers.values()].map((s) => s.size)), maxT = Math.max(1, ...[...tPapers.values()].map((s) => s.size));
  const nodes = [];
  for (const [k, ps] of mPapers) if (used.has("opt:" + k)) nodes.push({ id: "opt:" + k, label: keyName(k), kind: "option", size: nodeSize(ps.size, maxM), color: optColor(k), meta: { key: k, level, papers: ps.size } });
  for (const [t, ps] of tPapers) if (used.has("task:" + t)) nodes.push({ id: "task:" + t, label: taskLevel === "family" ? tfName(t) : ttName(t), kind: taskLevel === "family" ? "taskfam" : "task", size: nodeSize(ps.size, maxT), color: taskLevel === "family" ? KIND_COLORS.taskfam : KIND_COLORS.task, meta: { t, taskLevel, papers: ps.size } });
  return { nodes, edges, directed: false };
}

/** Models network from like-for-like model comparisons */
export function modelsView(F, opts) {
  const { by = "lineage", since = "2025", tier = "", open = false } = opts;
  const M = D.mp, pairs = [];
  for (let i = 0; i < D.nMp; i++) {
    if (!mpOK(i, F)) continue;
    const a = dv("mod", M.a[i]), b = dv("mod", M.b[i]); const ia = modelInfo(a), ib = modelInfo(b);
    if (since && (!ia.rel || !ib.rel || ia.rel < since || ib.rel < since)) continue;
    if (tier && (ia.tier !== tier || ib.tier !== tier)) continue;
    if (open && (!ia.open || !ib.open)) continue;
    let ka = a, kb = b;
    if (by === "lineage") { if (ia.tier !== ib.tier || !ia.tier || ia.tier === "n/a") continue; ka = ia.lin + "|" + ia.tier; kb = ib.lin + "|" + ib.tier; if (["other", "unknown"].includes(ia.lin) || ["other", "unknown"].includes(ib.lin)) continue; }
    if (ka === kb) continue;
    pairs.push({ a: ka, b: kb, d: M.d[i], p: M.p[i], i });
  }
  const st = optionStats(pairs); const keep = new Set([...st.entries()].filter(([, v]) => v.s.papers >= F.minP).map(([k]) => k));
  const maxP = Math.max(1, ...[...keep].map((k) => st.get(k).s.papers));
  const label = (k) => (by === "lineage" ? `${linName(k.split("|")[0])} · ${k.split("|")[1]}` : k);
  const nodes = [...keep].map((k) => ({ id: "model:" + k, label: label(k), kind: by === "lineage" ? "lineage" : "model", size: nodeSize(st.get(k).s.papers, maxP), color: by === "lineage" ? KIND_COLORS.lineage : KIND_COLORS.model, meta: { key: k, by, s: st.get(k).s } }));
  const hh = headToHead(pairs).filter((e) => keep.has(e.x) && keep.has(e.y) && e.s.papers >= 2); const maxE = Math.max(1, ...hh.map((e) => e.s.papers));
  const edges = hh.map((e) => { const xw = e.s.win >= e.s.loss; const [src, tgt] = xw ? [e.x, e.y] : [e.y, e.x];
    return { id: `mh2h:${e.x}|${e.y}`, source: "model:" + tgt, target: "model:" + src, kind: "mh2h", size: edgeSize(e.s.papers, maxE), color: alpha(KIND_COLORS.lineage, 0.2 + 0.7 * Math.abs(e.s.win - e.s.loss)), meta: { x: e.x, y: e.y, s: e.s, rows: e.rows, by, winner: src } }; });
  return { nodes, edges, directed: true };
}

/** Methods × failure modes */
export function failureView(F) {
  const Fa = D.fail, M = new Map(), mP = new Map(), fP = new Map();
  for (let i = 0; i < Fa.p.length; i++) {
    const c = dv("cls", Fa.cls[i]), f = dv("fm", Fa.fm[i]); if (!c || !f || !famOK(c, F)) continue;
    const t = dv("tt", Fa.tt[i]); if (F.tt && t !== F.tt) continue; if (F.tf && ttFam(t) !== F.tf) continue;
    const k = c + "\u0001" + f; if (!M.has(k)) M.set(k, new Set()); M.get(k).add(Fa.p[i]);
    if (!mP.has(c)) mP.set(c, new Set()); mP.get(c).add(Fa.p[i]); if (!fP.has(f)) fP.set(f, new Set()); fP.get(f).add(Fa.p[i]);
  }
  const minE = Math.max(2, Math.min(F.minP, 3));
  const E = [...M.entries()].map(([k, s]) => ({ c: k.split("\u0001")[0], f: k.split("\u0001")[1], n: s.size, papers: [...s] })).filter((e) => e.n >= minE);
  const used = new Set(E.flatMap((e) => ["opt:" + e.c, "fail:" + e.f])); const maxE = Math.max(1, ...E.map((e) => e.n));
  const maxM = Math.max(1, ...[...mP.values()].map((s) => s.size)), maxF = Math.max(1, ...[...fP.values()].map((s) => s.size));
  const nodes = [...[...mP].filter(([c]) => used.has("opt:" + c)).map(([c, s]) => ({ id: "opt:" + c, label: clsName(c), kind: "option", size: nodeSize(s.size, maxM), color: optColor(c), meta: { key: c, level: "class", papers: s.size } })),
    ...[...fP].filter(([f]) => used.has("fail:" + f)).map(([f, s]) => ({ id: "fail:" + f, label: fmName(f), kind: "failure", size: nodeSize(s.size, maxF), color: KIND_COLORS.failure, meta: { f, papers: s.size } }))];
  const edges = E.map((e) => ({ id: `fails:${e.c}|${e.f}`, source: "opt:" + e.c, target: "fail:" + e.f, kind: "fails_via", size: edgeSize(e.n, maxE), color: "rgba(209,73,91,.45)", meta: e }));
  return { nodes, edges, directed: false };
}

/** Methods × cost dimensions (edge only when the method is rated medium-high on that dimension) */
export function costView(F, threshold = 0.5) {
  const C = D.cost, M = new Map(), mP = new Map();
  for (let i = 0; i < C.p.length; i++) {
    const c = dv("cls", C.cls[i]), d = dv("dim", C.dim[i]); if (!c || !famOK(c, F)) continue;
    const k = c + "\u0001" + d; if (!M.has(k)) M.set(k, { lv: [], p: new Set() }); M.get(k).lv.push(C.lv[i]); M.get(k).p.add(C.p[i]);
    if (!mP.has(c)) mP.set(c, new Set()); mP.get(c).add(C.p[i]);
  }
  const E = [...M.entries()].map(([k, v]) => ({ c: k.split("\u0001")[0], d: k.split("\u0001")[1], mean: v.lv.reduce((a, b) => a + b, 0) / v.lv.length, n: v.p.size })).filter((e) => e.n >= F.minP && e.mean >= threshold);
  const used = new Set(E.flatMap((e) => ["opt:" + e.c, "cost:" + e.d])); const maxM = Math.max(1, ...[...mP.values()].map((s) => s.size));
  const nodes = [...[...mP].filter(([c]) => used.has("opt:" + c)).map(([c, s]) => ({ id: "opt:" + c, label: clsName(c), kind: "option", size: nodeSize(s.size, maxM), color: optColor(c), meta: { key: c, level: "class", papers: s.size } })),
    ...Object.keys(D.tax.cost_dim).filter((d) => used.has("cost:" + d)).map((d) => ({ id: "cost:" + d, label: pretty(dimName(d)), kind: "cost", size: 14, color: KIND_COLORS.cost, meta: { d } }))];
  const edges = E.map((e) => ({ id: `cost:${e.c}|${e.d}`, source: "opt:" + e.c, target: "cost:" + e.d, kind: "costs", size: 0.6 + 4 * (e.mean - threshold) / (1 - threshold + 1e-9), color: `rgba(237,174,73,${0.25 + 0.6 * e.mean})`, meta: e }));
  return { nodes, edges, directed: false };
}

/** Papers × methods (families or classes) for the current filter */
export function papersView(F, level) {
  const pairs = optionPairs(F, level === "family" ? "family" : "class");
  const PM = new Map(), mP = new Map();
  for (const q of pairs) for (const k of [q.a, q.b]) { if (k === "bare_model") continue; const key = q.p + "\u0001" + k; PM.set(key, (PM.get(key) || 0) + 1); if (!mP.has(k)) mP.set(k, new Set()); mP.get(k).add(q.p); }
  const papers = new Set([...PM.keys()].map((k) => +k.split("\u0001")[0]));
  const maxM = Math.max(1, ...[...mP.values()].map((s) => s.size));
  const nodes = [...[...mP].map(([k, s]) => ({ id: "opt:" + k, label: keyName(k), kind: "option", size: nodeSize(s.size, maxM), color: optColor(k), meta: { key: k, level, papers: s.size } })),
    ...[...papers].map((p) => ({ id: "paper:" + p, label: D.papers[p][1].slice(0, 60), kind: "paper", size: 2.5, color: KIND_COLORS.paper, meta: { p } }))];
  const edges = [...PM.entries()].map(([key, n]) => { const [p, k] = key.split("\u0001"); return { id: `studies:${p}|${k}`, source: "paper:" + p, target: "opt:" + k, kind: "studies", size: 0.5, color: "rgba(150,150,150,.25)", meta: { p: +p, k, n } }; });
  return { nodes, edges, directed: false };
}

export const VIEWS = [
  { id: "methods", name: "Methods compared", desc: "Each node is an option; an arrow points from the option that usually lost to the one that usually won, in head-to-head results within the same paper." },
  { id: "tasks", name: "Methods × tasks", desc: "Which methods were tested on which kinds of task, and how often they won there (green = usually wins, red = usually loses)." },
  { id: "models", name: "Models compared", desc: "Models (or model families of the same size class) compared like-for-like: same paper, method, task and metric." },
  { id: "failures", name: "How methods fail", desc: "Which failure modes papers report for which methods." },
  { id: "costs", name: "What methods cost", desc: "Methods linked to the cost dimensions they are rated medium-to-high on (tokens, latency, training, engineering…)." },
  { id: "papers", name: "Papers", desc: "Every paper linked to the methods it compares. Clusters show research communities." },
];
