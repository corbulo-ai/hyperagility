// Aggregates the comparison data into the rows behind the cards and tables.
import { productLine } from "./products.js";
import { D, dvx as dv, di, optionPairs, optionStats, summarize, mpOK, keyName, linName, fmName, dimName, pretty, modelInfo, classCosts, classFailures } from "./kg.js";

export const LEVELS = [
  { id: "class", pick: "Specific techniques", name: "methods", one: "method", help: "Individual ways of improving an agent, such as self-reflection, tree search or adding memory." },
  { id: "family", pick: "Broad approaches", name: "approach families", one: "approach family", help: "Related techniques grouped together, such as retrieval, planning or multi-agent." },
  { id: "known", pick: "Named systems", name: "named methods", one: "named method", help: "Published systems known by name, such as ReAct or Reflexion." },
  { id: "ma", pick: "Multi-agent setups", name: "multi-agent structures", one: "structure", help: "Ways of organizing several agents, including using just one." },
  { id: "ctx", pick: "Context handling", name: "context-management mechanisms", one: "mechanism", help: "Ways of deciding what the model keeps in view as a task goes on." },
  { id: "roles", pick: "Agent roles", name: "role assignments", one: "role assignment", help: "How work is divided between agents." },
  { id: "persona", pick: "Personas", name: "personas", one: "persona", help: "Giving the model a persona or identity, or none at all." },
];

export const LENSES = [
  { id: "all", label: "All results", name: "every reported result", short: "", help: "Everything papers reported, including papers testing their own new method." },
  { id: "independent", label: "Independent", name: "independent tests only", short: "independent", help: "Only tests where neither side is the paper's own new method." },
  { id: "matched", label: "Same budget", name: "same-budget tests only", short: "same-budget", help: "Only tests where both sides had the same compute." },
];

/** Lower bound of the 95% Wilson interval: a win rate discounted for small samples. */
export function wilsonLower(p, n, z = 1.96) {
  if (!n) return 0;
  const z2 = z * z, centre = p + z2 / (2 * n), margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return (centre - margin) / (1 + z2 / n);
}

const isIndependent = (r) => !D.cmp.own[r.i];
const isMatched = (r) => D.cmp.par[r.i] === di("par", "matched");
const isVsBare = (r) => dv("cls", D.cmp.a[r.i]) === "bare_model" || dv("cls", D.cmp.b[r.i]) === "bare_model";
const LENS_TEST = { all: () => true, independent: isIndependent, matched: isMatched };

export function rankOptions(F, level) {
  const stats = optionStats(optionPairs({ ...F, lens: "all" }, level));
  const out = [];
  for (const [key, { rows }] of stats) {
    if (key === "bare_model") continue;
    const chosen = rows.filter(LENS_TEST[F.lens]), s = summarize(chosen);
    if (!s.papers) continue;
    out.push({ key, name: keyName(key), s, vsBare: summarize(chosen.filter(isVsBare)), vsOther: summarize(chosen.filter((r) => !isVsBare(r))), all: summarize(rows), independent: summarize(rows.filter(isIndependent)), matched: summarize(rows.filter(isMatched)), score: wilsonLower(s.win, s.papers), nav: { kind: "option", key, level } });
  }
  return out.sort((a, b) => b.score - a.score || b.s.papers - a.s.papers);
}

/** Definition, notable costs and common failures for a card. Only methods and families have these. */
export function optionExtras(key, level) {
  const tax = D.tax;
  const classes = level === "class" ? [key] : level === "family" ? Object.entries(tax.method_class).filter(([, c]) => c.family === key).map(([k]) => k) : [];
  const def = level === "class" ? tax.method_class[key]?.def : level === "family" ? tax.method_family[key]?.def : "";
  const cost = new Map(), fail = new Map();
  for (const c of classes) {
    for (const x of classCosts(c)) { if (x.mean == null) continue; const v = cost.get(x.d) || { sum: 0, n: 0 }; v.sum += x.mean * x.n; v.n += x.n; cost.set(x.d, v); }
    for (const x of classFailures(c)) fail.set(x.f, (fail.get(x.f) || 0) + x.n);
  }
  const costs = [...cost.entries()].filter(([, v]) => v.n >= 3).map(([d, v]) => ({ name: pretty(dimName(d)), mean: v.sum / v.n, papers: v.n, nav: { kind: "cost", key: d } })).filter((c) => c.mean >= 0.5).sort((a, b) => b.mean - a.mean).slice(0, 2);
  const fails = [...fail.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f, n]) => ({ name: fmName(f), papers: n, nav: { kind: "failure", key: f } }));
  return { def, costs, fails };
}

export function modelRows(F, { by, since, tier, open }) {
  const M = D.mp, pairs = [];
  for (let i = 0; i < D.nMp; i++) {
    if (!mpOK(i, F)) continue;
    const a = dv("mod", M.a[i]), b = dv("mod", M.b[i]), ia = modelInfo(a), ib = modelInfo(b);
    if (since && (!ia.rel || !ib.rel || ia.rel < since || ib.rel < since)) continue;
    if (tier && (ia.tier !== tier || ib.tier !== tier)) continue;
    if (open && (!ia.open || !ib.open)) continue;
    let ka = a, kb = b;
    if (by === "lineage") {
      if (ia.tier !== ib.tier || !ia.tier || ia.tier === "n/a" || ["other", "unknown"].includes(ia.lin) || ["other", "unknown"].includes(ib.lin)) continue;
      ka = ia.lin + "|" + ia.tier; kb = ib.lin + "|" + ib.tier;
    }
    if (ka !== kb) pairs.push({ a: ka, b: kb, d: M.d[i], p: M.p[i], i });
  }
  return [...optionStats(pairs).entries()].filter(([, v]) => v.s.papers >= F.minP).map(([k, v]) => ({
    name: by === "lineage" ? linName(k.split("|")[0]) : k,
    size: pretty(by === "lineage" ? k.split("|")[1] : modelInfo(k).tier || ""),
    s: v.s, nav: { kind: by === "lineage" ? "lineage_t" : "model", key: k },
  })).sort((a, b) => wilsonLower(b.s.win, b.s.papers) - wilsonLower(a.s.win, a.s.papers));
}

/** Product lines compared within each maker, and across all makers. */
export function productGroups(F, since) {
  const M = D.mp, within = new Map(), across = [], members = new Map(), makers = new Map();
  const note = (p, name) => { makers.set(p.line, p.maker); if (!members.has(p.line)) members.set(p.line, new Set()); members.get(p.line).add(name); };
  for (let i = 0; i < D.nMp; i++) {
    if (!mpOK(i, F)) continue;
    const a = dv("mod", M.a[i]), b = dv("mod", M.b[i]), ia = modelInfo(a), ib = modelInfo(b);
    if (since && (!ia.rel || !ib.rel || ia.rel < since || ib.rel < since)) continue;
    const pa = productLine(a), pb = productLine(b);
    if (!pa || !pb || pa.line === pb.line) continue;
    note(pa, a); note(pb, b);
    const pair = { a: pa.line, b: pb.line, d: M.d[i], p: M.p[i], i };
    across.push(pair);
    if (pa.maker === pb.maker) { if (!within.has(pa.maker)) within.set(pa.maker, []); within.get(pa.maker).push(pair); }
  }
  const modelsOf = (line) => { const l = [...members.get(line)].sort(); return l.slice(0, 5).join(", ") + (l.length > 5 ? ` and ${l.length - 5} more` : ""); };
  const rowsOf = (pairs, scope) => [...optionStats(pairs).entries()].map(([line, v]) => ({ name: line, maker: makers.get(line), models: modelsOf(line), s: v.s, nav: { kind: "product", key: line, scope, since } }))
    .sort((a, b) => wilsonLower(b.s.win, b.s.papers) - wilsonLower(a.s.win, a.s.papers));
  const groups = [...within.entries()].map(([maker, pairs]) => ({ maker, papers: new Set(pairs.map((q) => q.p)).size, rows: rowsOf(pairs, "maker") })).sort((a, b) => b.papers - a.papers);
  const withDirect = new Set(groups.map((g) => g.maker));
  return { groups, across: rowsOf(across, "all"), noDirect: [...new Set(makers.values())].filter((m) => !withDirect.has(m)) };
}

export function failureRows() {
  const Fa = D.fail, M = new Map();
  for (let i = 0; i < Fa.p.length; i++) {
    const f = dv("fm", Fa.fm[i]); if (!f) continue;
    if (!M.has(f)) M.set(f, { papers: new Set(), cases: 0, major: 0 });
    const m = M.get(f); m.papers.add(Fa.p[i]); m.cases++; if (dv("sev", Fa.sev[i]) === "major") m.major++;
  }
  return [...M.entries()].map(([f, m]) => ({ name: fmName(f), sub: D.tax.failure_mode[f]?.def || "", group: pretty(D.tax.failure_mode[f]?.group || ""), papers: m.papers.size, cases: m.cases, major: m.major, nav: { kind: "failure", key: f } })).sort((a, b) => b.papers - a.papers);
}

export function costRows() {
  const C = D.cost, M = new Map();
  for (let i = 0; i < C.p.length; i++) {
    const d = dv("dim", C.dim[i]), c = dv("cls", C.cls[i]); if (!d) continue;
    if (!M.has(d)) M.set(d, { papers: new Set(), by: new Map() });
    const m = M.get(d); m.papers.add(C.p[i]);
    if (c) { if (!m.by.has(c)) m.by.set(c, { sum: 0, n: 0, p: new Set() }); const b = m.by.get(c); b.sum += C.lv[i]; b.n++; b.p.add(C.p[i]); }
  }
  return [...M.entries()].map(([d, m]) => {
    const top = [...m.by.entries()].filter(([, b]) => b.p.size >= 3).map(([c, b]) => ({ c, mean: b.sum / b.n })).sort((a, b) => b.mean - a.mean)[0];
    return { name: pretty(dimName(d)), sub: D.tax.cost_dim[d]?.def || "", papers: m.papers.size, costliest: top ? keyName(top.c) : "Not enough ratings", nav: { kind: "cost", key: d } };
  }).sort((a, b) => b.papers - a.papers);
}

export function paperRows() {
  const counts = new Map();
  for (let i = 0; i < D.nCmp; i++) counts.set(D.cmp.p[i], (counts.get(D.cmp.p[i]) || 0) + 1);
  return D.papers.map((p, i) => ({ name: p[1].trim(), year: parseInt(p[2]) || 0, venue: p[3] || "", results: counts.get(i) || 0, nav: { kind: "paper", key: i } }));
}
