// Builds inspector panels (generic sections) for any entity or relation in the graph.
import { D, dvx as dv, di, optionPairs, headToHead, summarize, flip, cmpOK, mpOK, clsName, clsFam, famName, ttName, ttFam, tfName, linName, fmName, dimName, keyName, pretty, paper,
  modelInfo, median, classCosts, classFailures, classTokens, confidence, bradleyTerry } from "./kg.js";

const pct = (v) => (v >= 0 ? "+" : "") + Math.round(v * 100) + "%";
const share = (v) => Math.round(v * 100) + "%";
const fmtN = (v) => (v == null ? "—" : v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "k" : (+v).toFixed(v < 10 ? 2 : 0));
const LEVEL_NAME = { family: "approach family", class: "method", known: "named method", ctx: "context mechanism", ma: "multi-agent structure", roles: "role assignment", persona: "persona type" };

function pairsOf(key, F, level) { return optionPairs(F, level).filter((q) => q.a === key || q.b === key).map((q) => ({ ...q, me: key, other: q.a === key ? q.b : q.a, dm: q.a === key ? q.d : flip(q.d) })); }
function groupBy(ps, fn) { const M = new Map(); for (const q of ps) { const g = fn(q); if (!g) continue; if (!M.has(g)) M.set(g, []); M.get(g).push({ p: q.p, d: q.dm, i: q.i }); } return [...M.entries()].map(([g, rows]) => ({ g, rows, s: summarize(rows) })); }
function verdict(s) { return s.papers ? `won in ${share(s.win)} of ${s.papers} paper${s.papers > 1 ? "s" : ""} · typical ${pct(s.typical)}` : "no comparisons"; }
function cmpEvidence(rows, subject) {
  return rows.slice(0, 120).map((r) => {
    const i = r.i, C = D.cmp, ev = D._ev(C.ev[i]), pp = paper(C.p[i]);
    const a = dv("cls", C.a[i]), b = dv("cls", C.b[i]);
    return { head: `${ev[0]}  vs  ${ev[1] || "(baseline)"}`, sub: [ev[2], ev[3], ev[4]].filter(Boolean).join(" · "), values: `${ev[5]} vs ${ev[6]}`, d: r.d, won: r.d > 0.005, lost: r.d < -0.005,
      quote: ev[8], page: ev[7], paper: pp, cls: `${clsName(a)} vs ${b === "bare_model" ? "Bare model" : clsName(b)}`, flags: [C.own[i] ? "authors' own method involved" : "independent", dv("par", C.par[i]) === "matched" ? "same budget" : ""].filter(Boolean) };
  });
}
function paperList(rowsOrSet, limit = 60) { const s = [...new Set(rowsOrSet.map ? rowsOrSet.map((r) => (r.p ?? r)) : rowsOrSet)]; return s.slice(0, limit).map((p) => { const pp = paper(p); return { label: pp.title, sub: `${pp.year} · ${pp.venue || ""}`, nav: { kind: "paper", key: p } }; }); }

// ---------------- entities ----------------
export function inspectOption(key, level, F) {
  const ps = pairsOf(key, F, level), s = summarize(ps.map((q) => ({ p: q.p, d: q.dm })));
  const isClass = level === "class" && key !== "bare_model", isFam = level === "family" && key !== "bare_model";
  const def = key === "bare_model" ? "The model on its own, with no added method." : isClass ? D.tax.method_class[key]?.def : isFam ? D.tax.method_family[key]?.def : "";
  const sec = [];
  sec.push({ type: "header", title: keyName(key), subtitle: isClass ? `Method · ${famName(clsFam(key))}` : `${pretty(LEVEL_NAME[level] || level)}`, text: def, color: null,
    nav: isClass ? { kind: "option", key: clsFam(key), level: "family" } : null });
  if (isClass && D.tax.method_class[key]) { const c = D.tax.method_class[key]; if (c.include) sec.push({ type: "text", title: "Includes", text: c.include }); }
  sec.push({ type: "kpis", items: [{ label: "Papers", value: s.papers, note: confidence(s.papers) + " evidence" }, { label: "Won", value: share(s.win), note: "of papers, vs whatever it was compared with" },
    { label: "Lost", value: share(s.loss), note: "of papers" }, { label: "Typical difference", value: pct(s.typical), note: "median across papers" }] });
  const opp = groupBy(ps, (q) => q.other).sort((a, b) => b.s.papers - a.s.papers);
  sec.push({ type: "bars", title: "Head-to-head", hint: "How it did against each alternative it was directly compared with (same paper, model, task). Click to open the comparison.",
    items: opp.slice(0, 25).map((o) => ({ label: keyName(o.g), value: o.s.win - o.s.loss, display: `${o.s.papers}p · won ${share(o.s.win)} · ${pct(o.s.typical)}`, nav: { kind: "h2h", x: key, y: o.g, level } })) });
  const tasks = groupBy(ps, (q) => { const t = dv("tt", D.cmp.tt[q.i]); return t && t !== "non_task_entry" ? t : null; }).sort((a, b) => b.s.papers - a.s.papers);
  sec.push({ type: "bars", title: "Tasks it was tested on", hint: "Bar = how often it won on that kind of task.", items: tasks.slice(0, 20).map((t) => ({ label: ttName(t.g), value: t.s.win - t.s.loss, display: `${t.s.papers}p · won ${share(t.s.win)}`, nav: { kind: "task", key: t.g } })) });
  const lins = groupBy(ps, (q) => { const l = dv("lin", D.cmp.lin[q.i]); return l && !["other", "unknown"].includes(l) ? l : null; }).sort((a, b) => b.s.papers - a.s.papers);
  sec.push({ type: "bars", title: "Models it was used with", items: lins.slice(0, 15).map((t) => ({ label: linName(t.g), value: t.s.win - t.s.loss, display: `${t.s.papers}p · won ${share(t.s.win)}`, nav: { kind: "lineage", key: t.g } })) });
  const tiers = groupBy(ps, (q) => dv("tier", D.cmp.tier[q.i]) || null);
  sec.push({ type: "kpis", title: "By model size", items: ["frontier", "strong", "small"].map((t) => { const x = tiers.find((y) => y.g === t); return { label: pretty(t), value: x ? share(x.s.win) : "—", note: x ? `${x.s.papers} papers won` : "no data" }; }) });
  const classes = isFam ? Object.entries(D.tax.method_class).filter(([, c]) => c.family === key).map(([k]) => k) : isClass ? [key] : [];
  if (classes.length) {
    const costs = classes.map(classCosts).reduce((acc, cs) => { cs.forEach((c) => { const a = acc[c.d] || (acc[c.d] = { s: 0, n: 0 }); if (c.mean != null) { a.s += c.mean * c.n; a.n += c.n; } }); return acc; }, {});
    sec.push({ type: "bars", title: "Costs (0 = none, 1 = highest level)", hint: "Rated per paper from what it reports or describes; many ratings are inferred from the method's design.", unsigned: true,
      items: Object.entries(costs).filter(([, v]) => v.n).map(([d, v]) => ({ label: pretty(dimName(d)), value: v.s / v.n, display: `${(v.s / v.n).toFixed(2)} · ${v.n} papers`, nav: { kind: "cost", key: d } })) });
    const fails = new Map(); classes.forEach((c) => classFailures(c).forEach((f) => fails.set(f.f, (fails.get(f.f) || 0) + f.n)));
    sec.push({ type: "list", title: "How it fails", items: [...fails.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => ({ label: fmName(f), sub: `${n} papers`, nav: { kind: "failure", key: f } })) });
    const tk = classTokens(classes[0]); if (isClass && tk.rows.length) sec.push({ type: "kpis", title: "Reported compute (median of what papers printed)", items: [["Input tokens", tk.input], ["Output tokens", tk.output], ["Cached tokens", tk.cached], ["Reasoning tokens", tk.reasoning], ["Total tokens", tk.total], ["$ per unit", tk.usd], ["Latency (s)", tk.latency], ["LLM calls", tk.calls]].filter(([, v]) => v).map(([l, v]) => ({ label: l, value: fmtN(v.m), note: `${v.n} values` })) });
    if (isClass) { const kn = new Map(); ps.forEach((q) => { const k = q.a === key ? dv("known", D.cmp.kA[q.i]) : dv("known", D.cmp.kB[q.i]); if (k) kn.set(k, (kn.get(k) || 0) + 1); });
      if (kn.size) sec.push({ type: "chips", title: "Named methods in this class", items: [...kn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, n]) => ({ label: `${k} (${n})`, nav: { kind: "option", key: k, level: "known" } })) }); }
    if (isFam) sec.push({ type: "list", title: "Methods in this family", items: classes.map((c) => ({ label: clsName(c), sub: D.tax.method_class[c].def.slice(0, 120), nav: { kind: "option", key: c, level: "class" } })) });
  }
  sec.push({ type: "list", title: `Papers (${s.papers})`, items: paperList(ps.map((q) => q.p)) });
  sec.push({ type: "evidence", title: "Evidence", items: cmpEvidence(ps.map((q) => ({ i: q.i, d: q.dm })), key) });
  return sec;
}

export function inspectH2H(x, y, level, F) {
  const ps = optionPairs(F, level).filter((q) => (q.a === x && q.b === y) || (q.a === y && q.b === x)).map((q) => ({ ...q, dm: q.a === x ? q.d : flip(q.d) }));
  const s = summarize(ps.map((q) => ({ p: q.p, d: q.dm })));
  const sec = [{ type: "header", title: `${keyName(x)}  vs  ${keyName(y)}`, subtitle: `Head-to-head · ${pretty(LEVEL_NAME[level] || level)}`, text: `Compared directly in ${s.papers} paper${s.papers === 1 ? "" : "s"} (${ps.length} results). ${keyName(x)} ${verdict(s)}.` }];
  sec.push({ type: "kpis", items: [{ label: `${keyName(x)} won`, value: share(s.win), note: "of papers" }, { label: `${keyName(y)} won`, value: share(s.loss), note: "of papers" }, { label: "Typical difference", value: pct(s.typical), note: `for ${keyName(x)}` }, { label: "Evidence", value: confidence(s.papers), note: `${s.papers} papers` }] });
  const byT = groupBy(ps.map((q) => ({ ...q, me: x })), (q) => { const t = dv("tt", D.cmp.tt[q.i]); return t && t !== "non_task_entry" ? t : null; }).sort((a, b) => b.s.papers - a.s.papers);
  sec.push({ type: "bars", title: `By task (positive = ${keyName(x)} better)`, items: byT.slice(0, 15).map((t) => ({ label: ttName(t.g), value: t.s.win - t.s.loss, display: `${t.s.papers}p · ${pct(t.s.typical)}`, nav: { kind: "task", key: t.g } })) });
  const byTier = groupBy(ps.map((q) => ({ ...q, me: x })), (q) => dv("tier", D.cmp.tier[q.i]) || null);
  sec.push({ type: "kpis", title: "By model size", items: ["frontier", "strong", "small"].map((t) => { const z = byTier.find((y2) => y2.g === t); return { label: pretty(t), value: z ? share(z.s.win) : "—", note: z ? `${keyName(x)} won · ${z.s.papers}p` : "no data" }; }) });
  const own = ps.filter((q) => !D.cmp.own[q.i]), mat = ps.filter((q) => dv("par", D.cmp.par[q.i]) === "matched");
  const so = summarize(own.map((q) => ({ p: q.p, d: q.dm }))), sm = summarize(mat.map((q) => ({ p: q.p, d: q.dm })));
  sec.push({ type: "kpis", title: "Robustness", items: [{ label: "Independent tests only", value: so.papers ? share(so.win) : "—", note: so.papers ? `${keyName(x)} won · ${so.papers}p` : "none" }, { label: "Same budget only", value: sm.papers ? share(sm.win) : "—", note: sm.papers ? `${keyName(x)} won · ${sm.papers}p` : "none" }] });
  sec.push({ type: "list", title: "Explore", items: [{ label: keyName(x), sub: "open", nav: { kind: "option", key: x, level } }, { label: keyName(y), sub: "open", nav: { kind: "option", key: y, level } }] });
  sec.push({ type: "evidence", title: "Every result", items: cmpEvidence(ps.map((q) => ({ i: q.i, d: q.dm })), x) });
  return sec;
}

export function inspectTask(t, F, isFamily = false) {
  const FF = isFamily ? { ...F, tf: t, tt: "" } : { ...F, tt: t, tf: "" };
  const name = isFamily ? tfName(t) : ttName(t), def = isFamily ? D.tax.task_family[t]?.def : D.tax.task_type[t]?.def;
  const sec = [{ type: "header", title: name, subtitle: isFamily ? "Task family" : `Task type · ${tfName(ttFam(t))}`, text: def, nav: isFamily ? null : { kind: "taskfam", key: ttFam(t) } }];
  for (const [level, title] of [["family", "Approach families ranked on this task"], ["class", "Methods ranked on this task"]]) {
    const pairs = optionPairs(FF, level); const per = new Map(); pairs.forEach((q) => { for (const k of [q.a, q.b]) { if (!per.has(k)) per.set(k, new Set()); per.get(k).add(q.p); } });
    const items = [...per.entries()].filter(([, s]) => s.size >= F.minP).map(([k]) => k);
    if (items.length < 2) continue;
    const bt = bradleyTerry(pairs, items); const st = new Map(); pairs.forEach((q) => { for (const [k, d] of [[q.a, q.d], [q.b, flip(q.d)]]) { if (!st.has(k)) st.set(k, []); st.get(k).push({ p: q.p, d }); } });
    sec.push({ type: "bars", title, hint: "Strength combines every head-to-head on this task (1.0 = average option). Text: papers · how often it won.", unsigned: true, scale: Math.max(...items.map((k) => bt[k])),
      items: items.sort((a, b) => bt[b] - bt[a]).slice(0, 20).map((k) => { const s = summarize(st.get(k)); return { label: keyName(k), value: bt[k], display: `${bt[k].toFixed(2)} · ${s.papers}p · won ${share(s.win)}`, nav: { kind: "option", key: k, level } }; }) });
  }
  const bms = new Map(); for (let i = 0; i < D.nCmp; i++) { if (!cmpOK(i, FF)) continue; const b = dv("bm", D.cmp.bm[i]); if (!b) continue; if (!bms.has(b)) bms.set(b, new Set()); bms.get(b).add(D.cmp.p[i]); }
  sec.push({ type: "chips", title: "Benchmarks", items: [...bms.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 30).map(([b, s]) => ({ label: `${b} (${s.size})` })) });
  if (!isFamily) { const fl = new Map(), Fa = D.fail; for (let i = 0; i < Fa.p.length; i++) if (dv("tt", Fa.tt[i]) === t) { const f = dv("fm", Fa.fm[i]); if (!fl.has(f)) fl.set(f, new Set()); fl.get(f).add(Fa.p[i]); }
    sec.push({ type: "list", title: "Failures reported on this task", items: [...fl.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 8).map(([f, s]) => ({ label: fmName(f), sub: `${s.size} papers`, nav: { kind: "failure", key: f } })) }); }
  else sec.push({ type: "list", title: "Task types", items: Object.entries(D.tax.task_type).filter(([, v]) => v.family === t).map(([k, v]) => ({ label: v.name, sub: v.def.slice(0, 110), nav: { kind: "task", key: k } })) });
  const ps = new Set(); for (let i = 0; i < D.nCmp; i++) if (cmpOK(i, FF)) ps.add(D.cmp.p[i]);
  sec.push({ type: "list", title: `Papers (${ps.size})`, items: paperList([...ps]) });
  return sec;
}

export function inspectModel(key, by, F, opts = {}) {
  const M = D.mp, isLin = by === "lineage", [lin, tier] = isLin ? key.split("|") : [modelInfo(key).lin, modelInfo(key).tier];
  const rows = [];
  for (let i = 0; i < D.nMp; i++) {
    if (!mpOK(i, F)) continue; const a = dv("mod", M.a[i]), b = dv("mod", M.b[i]); const ia = modelInfo(a), ib = modelInfo(b);
    const ka = isLin ? ia.lin + "|" + ia.tier : a, kb = isLin ? ib.lin + "|" + ib.tier : b;
    if (isLin && ia.tier !== ib.tier) continue; if (ka === kb) continue;
    if (ka === key) rows.push({ i, p: M.p[i], d: M.d[i], other: kb, me: a, them: b }); else if (kb === key) rows.push({ i, p: M.p[i], d: flip(M.d[i]), other: ka, me: b, them: a });
  }
  const s = summarize(rows), info = isLin ? {} : modelInfo(key);
  const sec = [{ type: "header", title: isLin ? `${linName(lin)} · ${tier}` : key, subtitle: isLin ? "Model family (same size class)" : `Model · ${linName(info.lin)} · ${info.tier || ""}`, text: isLin ? D.tax.lineage[lin]?.def : [info.prov, info.rel && `released ${info.rel}`, info.open === true ? "open weights" : info.open === false ? "closed" : "", info.reas ? "reasoning-trained" : "", info.agent ? "agent-trained" : ""].filter(Boolean).join(" · ") }];
  sec.push({ type: "kpis", items: [{ label: "Papers", value: s.papers, note: "with like-for-like model comparisons" }, { label: "Scored higher", value: share(s.win), note: "of papers" }, { label: "Typical difference", value: pct(s.typical), note: "vs the other model" }] });
  const opp = new Map(); rows.forEach((r) => { if (!opp.has(r.other)) opp.set(r.other, []); opp.get(r.other).push(r); });
  const lab = (k) => (isLin ? `${linName(k.split("|")[0])} · ${k.split("|")[1]}` : k);
  sec.push({ type: "bars", title: "Against other models", items: [...opp.entries()].map(([k, r]) => ({ k, s: summarize(r) })).sort((a, b) => b.s.papers - a.s.papers).slice(0, 25).map((o) => ({ label: lab(o.k), value: o.s.win - o.s.loss, display: `${o.s.papers}p · won ${share(o.s.win)} · ${pct(o.s.typical)}`, nav: { kind: isLin ? "lineage_t" : "model", key: o.k } })) });
  if (isLin) { const ms = new Map(); rows.forEach((r) => ms.set(r.me, (ms.get(r.me) || 0) + 1)); sec.push({ type: "chips", title: "Models in this family", items: [...ms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([m, n]) => ({ label: `${m} (${n})`, nav: { kind: "model", key: m } })) }); }
  const tt = new Map(); rows.forEach((r) => { const t = dv("tt", M.tt[r.i]); if (!t) return; if (!tt.has(t)) tt.set(t, []); tt.get(t).push(r); });
  sec.push({ type: "bars", title: "By task", items: [...tt.entries()].map(([k, r]) => ({ k, s: summarize(r) })).sort((a, b) => b.s.papers - a.s.papers).slice(0, 15).map((o) => ({ label: ttName(o.k), value: o.s.win - o.s.loss, display: `${o.s.papers}p · won ${share(o.s.win)}`, nav: { kind: "task", key: o.k } })) });
  sec.push({ type: "list", title: `Papers (${s.papers})`, items: paperList(rows.map((r) => r.p)) });
  sec.push({ type: "evidence", title: "Evidence", items: rows.slice(0, 120).map((r) => { const ev = D._ev(M.ev[r.i]); const pp = paper(r.p); return { head: `${r.me}  vs  ${r.them}`, sub: [ev[0], ev[1], ev[2]].filter(Boolean).join(" · "), values: r.me === ev[3] ? `${ev[5]} vs ${ev[6]}` : `${ev[6]} vs ${ev[5]}`, d: r.d, won: r.d > 0.005, lost: r.d < -0.005, paper: pp, quote: "", page: "", flags: [] }; }) });
  return sec;
}

export function inspectFailure(f, F) {
  const def = D.tax.failure_mode[f] || {}, Fa = D.fail; const rows = []; for (let i = 0; i < Fa.p.length; i++) if (dv("fm", Fa.fm[i]) === f) rows.push(i);
  const byC = new Map(), byT = new Map(); rows.forEach((i) => { const c = dv("cls", Fa.cls[i]), t = dv("tt", Fa.tt[i]); if (c) { if (!byC.has(c)) byC.set(c, new Set()); byC.get(c).add(Fa.p[i]); } if (t) { if (!byT.has(t)) byT.set(t, new Set()); byT.get(t).add(Fa.p[i]); } });
  return [{ type: "header", title: def.name || f, subtitle: `Failure mode · ${pretty(def.group || "")}`, text: def.def },
    { type: "kpis", items: [{ label: "Papers reporting it", value: new Set(rows.map((i) => Fa.p[i])).size }, { label: "Cases", value: rows.length }, { label: "Major", value: rows.filter((i) => dv("sev", Fa.sev[i]) === "major").length, note: "cases rated major" }] },
    { type: "list", title: "Methods it affects", items: [...byC.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 15).map(([c, s]) => ({ label: clsName(c), sub: `${s.size} papers`, nav: { kind: "option", key: c, level: "class" } })) },
    { type: "list", title: "Tasks where it shows up", items: [...byT.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 12).map(([t, s]) => ({ label: ttName(t), sub: `${s.size} papers`, nav: { kind: "task", key: t } })) },
    { type: "list", title: "Cases", items: rows.slice(0, 80).map((i) => { const ev = D._ev(Fa.ev[i]); const pp = paper(Fa.p[i]); return { label: `${ev[0] || "(unattributed)"}${ev[1] ? " · " + ev[1] : ""}`, sub: `${dv("sev", Fa.sev[i])} · ${pretty(dv("dir", Fa.dir[i]))} — ${pp.title} (${pp.year})`, nav: { kind: "paper", key: Fa.p[i] } }; }) }];
}

export function inspectCost(d) {
  const def = D.tax.cost_dim[d] || {}, C = D.cost, by = new Map();
  for (let i = 0; i < C.p.length; i++) if (dv("dim", C.dim[i]) === d) { const c = dv("cls", C.cls[i]); if (!c) continue; if (!by.has(c)) by.set(c, { lv: [], p: new Set() }); by.get(c).lv.push(C.lv[i]); by.get(c).p.add(C.p[i]); }
  const items = [...by.entries()].filter(([, v]) => v.p.size >= 3).map(([c, v]) => ({ c, m: v.lv.reduce((a, b) => a + b, 0) / v.lv.length, n: v.p.size })).sort((a, b) => b.m - a.m);
  return [{ type: "header", title: pretty(def.name || d), subtitle: "Cost dimension", text: `${def.def || ""} Levels: ${(def.levels || []).join(" → ")}.` },
    { type: "bars", title: "Methods from most to least costly on this dimension", unsigned: true, items: items.map((x) => ({ label: clsName(x.c), value: x.m, display: `${x.m.toFixed(2)} · ${x.n} papers`, nav: { kind: "option", key: x.c, level: "class" } })) }];
}

export function inspectPaper(p, F) {
  const pp = paper(p); const C = D.cmp; const rows = []; for (let i = 0; i < D.nCmp; i++) if (C.p[i] === p) rows.push(i);
  const cls = new Map(), tts = new Set(), mods = new Set(); rows.forEach((i) => { for (const c of [dv("cls", C.a[i]), dv("cls", C.b[i])]) cls.set(c, (cls.get(c) || 0) + 1); const t = dv("tt", C.tt[i]); if (t && t !== "non_task_entry") tts.add(t); const m = dv("mod", C.mod[i]); if (m) mods.add(m); });
  const claims = []; for (let i = 0; i < D.claim.p.length; i++) if (D.claim.p[i] === p) { const ev = D._ev(D.claim.ev[i]); claims.push({ label: ev[0], sub: `${pretty(dv("ckind", D.claim.kind[i]))} · p.${ev[1]}` }); }
  const fails = []; for (let i = 0; i < D.fail.p.length; i++) if (D.fail.p[i] === p) { const ev = D._ev(D.fail.ev[i]); fails.push({ label: fmName(dv("fm", D.fail.fm[i])), sub: `${ev[0] || ""} · ${dv("sev", D.fail.sev[i])}`, nav: { kind: "failure", key: dv("fm", D.fail.fm[i]) } }); }
  const lims = []; for (let i = 0; i < D.lim.p.length; i++) if (D.lim.p[i] === p) lims.push(dv("ltype", D.lim.type[i]));
  return [{ type: "header", title: pp.title, subtitle: `${pp.year} · ${pp.venue || ""}`, text: pp.abstract, link: pp.url },
    { type: "chips", title: "Methods compared", items: [...cls.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ label: `${c === "bare_model" ? "Bare model" : clsName(c)} (${n})`, nav: { kind: "option", key: c, level: "class" } })) },
    { type: "chips", title: "Tasks", items: [...tts].map((t) => ({ label: ttName(t), nav: { kind: "task", key: t } })) },
    { type: "chips", title: "Models", items: [...mods].slice(0, 30).map((m) => ({ label: m, nav: { kind: "model", key: m } })) },
    { type: "list", title: "Authors' conclusions", items: claims },
    { type: "list", title: "Failures reported", items: fails },
    { type: "chips", title: "Evidence limitations", items: lims.map((l) => ({ label: pretty((D.tax.limitation[l] || {}).name || l) })) },
    { type: "evidence", title: `Results (${rows.length})`, items: cmpEvidence(rows.map((i) => ({ i, d: C.d[i] }))) }];
}

export function inspectTestedOn(k, t, level, taskLevel, F) { return inspectOption(k, level, taskLevel === "family" ? { ...F, tf: t, tt: "" } : { ...F, tt: t, tf: "" }); }

export function about() {
  const s = D.stats;
  return [{ type: "header", title: "About this knowledge graph", subtitle: "How it was built and how to read it", text: `${s.papers} research papers on building LLM agents (mostly 2024–2026) were read and every reported result extracted: the model, the task, the method, what it was compared against, the numbers, and the exact quote and page. Methods, tasks, models, failures and costs were then mapped to shared categories (by Claude Opus, checked against an independent re-labelling: about 90% agreement for methods and tasks) so results from different papers can be put side by side.` },
    { type: "kpis", items: [{ label: "Method-vs-method results", value: s.cmp.toLocaleString() }, { label: "Model-vs-model results", value: s.mp.toLocaleString() }, { label: "Failure cases", value: s.fail.toLocaleString() }, { label: "Cost ratings", value: s.cost.toLocaleString() }, { label: "Token / $ measurements", value: s.tok.toLocaleString() }, { label: "Author conclusions", value: s.claims.toLocaleString() }] },
    { type: "text", title: "Fair comparisons only", text: "Two numbers are only compared when they come from the same experiment: same paper, same model, same task, same metric. Those fair comparisons are pooled across papers, and every paper counts once however many results it reports. 'Won in X% of papers' means: of the papers comparing these, the share where it came out ahead." },
    { type: "text", title: "Which results count", text: "All: everything papers reported. Independent: only comparisons where neither side is the paper's own new method (authors tend to favour their own). Same budget: only comparisons where both sides had the same compute. Rankings that hold under all three are the most trustworthy." },
    { type: "text", title: "Known limits", text: "Papers choose their own baselines; many links rest on a handful of papers (shown everywhere); cost levels are partly inferred from method descriptions; failure-mode labels are less reliable than method and task labels (≈76% agreement at group level); about 300 more papers are still being added." }];
}
// unified entry point
export function inspect(nav, F) {
  if (!nav) return null;
  switch (nav.kind) {
    case "option": return inspectOption(nav.key, nav.level, F);
    case "h2h": return inspectH2H(nav.x, nav.y, nav.level, F);
    case "task": return inspectTask(nav.key, F, false);
    case "taskfam": return inspectTask(nav.key, F, true);
    case "lineage_t": return inspectModel(nav.key, "lineage", F);
    case "lineage": return inspectLineageAny(nav.key, F);
    case "model": return inspectModel(nav.key, "model", F);
    case "mh2h": return inspectModel(nav.x, nav.by, F);
    case "failure": return inspectFailure(nav.key, F);
    case "cost": return inspectCost(nav.key);
    case "paper": return inspectPaper(nav.key, F);
    case "tested_on": return inspectTestedOn(nav.k, nav.t, nav.level, nav.taskLevel, F);
    case "about": return about();
  }
  return null;
}
function inspectLineageAny(lin, F) {
  // lineage without tier: pick its most common tier
  const counts = {}; for (const m of Object.values(D.tax.models)) if (m.lin === lin && m.tier) counts[m.tier] = (counts[m.tier] || 0) + 1;
  const tier = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "frontier";
  return inspectModel(lin + "|" + tier, "lineage", F);
}
