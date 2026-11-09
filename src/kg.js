// Knowledge-graph data access, filtering, statistics and graph builders.
export let D = null;

export async function loadKG() {
  const el = document.getElementById("kgdata");
  const url = el && el.textContent.trim().length > 100 ? "data:application/gzip;base64," + el.textContent.trim() : "./kg.json.gz";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading data`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Some servers label .gz files Content-Encoding: gzip, so the browser may already have unpacked it.
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const stream = new Blob([bytes]).stream();
  D = await new Response(isGzip ? stream.pipeThrough(new DecompressionStream("gzip")) : stream).json();
  index();
  return D;
}

export function setKG(data) { D = data; index(); return D; }
// ---------- dictionaries & names ----------
const dv = (dict, i) => (D.dict[dict] || [])[i] ?? "";
export const di = (dict, v) => (D._idx[dict] || {})[v] ?? -1;
function index() {
  D._idx = {};
  for (const [k, arr] of Object.entries(D.dict)) { const m = {}; arr.forEach((v, i) => (m[v] = i)); D._idx[k] = m; }
  D._ev = (i) => JSON.parse(D.txt[i]);
  D.nCmp = D.cmp.d.length; D.nMp = D.mp.d.length;
  // paper years for filtering
  D._year = D.papers.map((p) => parseInt(p[2]) || 0);
}
export const T = () => D.tax;
export const clsName = (c) => (D.tax.method_class[c] || {}).name || pretty(c);
export const clsFam = (c) => (c === "bare_model" ? "bare" : (D.tax.method_class[c] || {}).family || "");
export const famName = (f) => (f === "bare" ? "Bare model" : (D.tax.method_family[f] || {}).name || pretty(f));
export const ttName = (t) => (D.tax.task_type[t] || {}).name || pretty(t);
export const ttFam = (t) => (D.tax.task_type[t] || {}).family || "";
export const tfName = (f) => (D.tax.task_family[f] || {}).name || pretty(f);
export const linName = (l) => (D.tax.lineage[l] || {}).name || pretty(l);
export const fmName = (f) => (D.tax.failure_mode[f] || {}).name || f;
export const dimName = (d) => (D.tax.cost_dim[d] || {}).name || d;
export const pretty = (s) => String(s || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const paper = (i) => { const p = D.papers[i]; return { i, id: p[0], title: p[1], year: p[2], venue: p[3], url: p[4], abstract: p[5] }; };
export const modelInfo = (m) => D.tax.models[m] || {};

// ---------- statistics ----------
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const flip = (d) => (d > -1 ? -d / (1 + d) : 1);
/** paper-weighted summary of signed differences (positive = subject better). rows: [{p, d}] */
export function summarize(rows) {
  const per = new Map();
  for (const r of rows) { if (!per.has(r.p)) per.set(r.p, []); per.get(r.p).push(r.d); }
  const meds = [...per.values()].map(median);
  const n = meds.length;
  return { papers: n, rows: rows.length, win: n ? meds.filter((x) => x > 0.005).length / n : 0, loss: n ? meds.filter((x) => x < -0.005).length / n : 0, typical: median(meds) };
}
export function confidence(n) { return n >= 10 ? "solid" : n >= 5 ? "some" : n >= 3 ? "thin" : "anecdotal"; }

// ---------- filters ----------
export const defaultFilters = () => ({ tf: "", tt: "", tier: "", lin: "", lens: "all", minP: 3, fams: [], yearMin: 0 });
export function cmpOK(i, F) {
  const C = D.cmp;
  if (F.tt && C.tt[i] !== di("tt", F.tt)) return false;
  if (F.tf && ttFam(dv("tt", C.tt[i])) !== F.tf) return false;
  if (F.tier && C.tier[i] !== di("tier", F.tier)) return false;
  if (F.lin && C.lin[i] !== di("lin", F.lin)) return false;
  if (F.lens === "independent" && C.own[i]) return false;
  if (F.lens === "matched" && C.par[i] !== di("par", "matched")) return false;
  if (F.yearMin && D._year[C.p[i]] < F.yearMin) return false;
  return true;
}
export function mpOK(i, F) {
  const M = D.mp;
  if (F.tt && M.tt[i] !== di("tt", F.tt)) return false;
  if (F.tf && ttFam(dv("tt", M.tt[i])) !== F.tf) return false;
  if (F.yearMin && D._year[M.p[i]] < F.yearMin) return false;
  return true;
}
export const famOK = (c, F) => !F.fams.length || F.fams.includes(clsFam(c)) || c === "bare_model";

// ---------- row accessors ----------
export const cmpRow = (i) => {
  const C = D.cmp;
  return { i, p: C.p[i], a: dv("cls", C.a[i]), b: dv("cls", C.b[i]), d: C.d[i], tt: dv("tt", C.tt[i]), bm: dv("bm", C.bm[i]), tier: dv("tier", C.tier[i]),
    lin: dv("lin", C.lin[i]), mod: dv("mod", C.mod[i]), own: C.own[i], par: dv("par", C.par[i]), kA: dv("known", C.kA[i]), kB: dv("known", C.kB[i]),
    ctxA: dv("fac", C.ctxA[i]), ctxB: dv("fac", C.ctxB[i]), maA: dv("fac", C.maA[i]), maB: dv("fac", C.maB[i]), rolesA: dv("fac", C.rolesA[i]), rolesB: dv("fac", C.rolesB[i]),
    personaA: dv("fac", C.personaA[i]), personaB: dv("fac", C.personaB[i]), ev: D._ev(C.ev[i]) };
};
export const mpRow = (i) => { const M = D.mp; return { i, p: M.p[i], a: dv("mod", M.a[i]), b: dv("mod", M.b[i]), d: M.d[i], tt: dv("tt", M.tt[i]), cls: dv("cls", M.cls[i]), bm: dv("bm", M.bm[i]), ev: D._ev(M.ev[i]) }; };

// ---------- option keys: what a node "is" for a comparison side ----------
// level: "class" | "family" | facet name ("ctx" | "ma" | "roles" | "persona") | "known"
export function sideKey(r, side, level) {
  const c = side === "A" ? r.a : r.b;
  if (level === "class") return c;
  if (level === "family") return c === "bare_model" ? "bare_model" : clsFam(c);
  if (level === "known") return (side === "A" ? r.kA : r.kB) || null;
  const v = r[level + side];
  if (v) return "fac:" + v;
  if (c === "bare_model") return "bare_model";
  return { ctx: "fac:no context management", ma: "fac:single agent", roles: "fac:single agent", persona: "fac:no persona" }[level];
}
export const keyName = (k) => (k === "bare_model" ? "Bare model" : k.startsWith("fac:") ? pretty(k.slice(4)) : D.tax.method_class[k] ? clsName(k) : D.tax.method_family[k] ? famName(k) : pretty(k));

/** iterate filtered comparisons as {key A, key B, d, p, i} at a given option level */
export function optionPairs(F, level) {
  const out = [];
  for (let i = 0; i < D.nCmp; i++) {
    if (!cmpOK(i, F)) continue;
    const a0 = dv("cls", D.cmp.a[i]), b0 = dv("cls", D.cmp.b[i]);
    if (!famOK(a0, F) || !famOK(b0, F)) continue;
    let a, b;
    if (level === "class" || level === "family") { a = level === "class" ? a0 : clsFam(a0); b = b0 === "bare_model" ? "bare_model" : level === "class" ? b0 : clsFam(b0); }
    else if (level === "known") { a = dv("known", D.cmp.kA[i]) || null; b = b0 === "bare_model" ? "bare_model" : dv("known", D.cmp.kB[i]) || null; }
    else { const r = { a: a0, b: b0, [level + "A"]: dv("fac", D.cmp[level + "A"][i]), [level + "B"]: dv("fac", D.cmp[level + "B"][i]) }; a = sideKey(r, "A", level); b = sideKey(r, "B", level); }
    if (!a || !b || a === b) continue;
    out.push({ a, b, d: D.cmp.d[i], p: D.cmp.p[i], i });
  }
  return out;
}
/** aggregate pairs into undirected head-to-head edges with stats oriented from x to y (x<y alphabetically) */
export function headToHead(pairs) {
  const E = new Map();
  for (const q of pairs) {
    const [x, y, d] = q.a < q.b ? [q.a, q.b, q.d] : [q.b, q.a, flip(q.d)];
    const k = x + "\u0001" + y;
    if (!E.has(k)) E.set(k, { x, y, rows: [] });
    E.get(k).rows.push({ p: q.p, d, i: q.i });
  }
  return [...E.values()].map((e) => ({ ...e, s: summarize(e.rows) }));
}
/** per-option summary vs everything it was compared with */
export function optionStats(pairs) {
  const S = new Map();
  const add = (k, p, d, i) => { if (!S.has(k)) S.set(k, []); S.get(k).push({ p, d, i }); };
  for (const q of pairs) { add(q.a, q.p, q.d, q.i); add(q.b, q.p, flip(q.d), q.i); }
  return new Map([...S.entries()].map(([k, rows]) => [k, { rows, s: summarize(rows) }]));
}
/** Bradley-Terry strengths (paper-weighted, regularised), 1.0 = average */
export function bradleyTerry(pairs, items) {
  const it = [...items, "_"], W = new Map(), G = new Map(), k = (a, b) => a + "\u0001" + b, byp = new Map();
  const add = (m, key, v) => m.set(key, (m.get(key) || 0) + v);
  for (const q of pairs) { if (!items.includes(q.a) || !items.includes(q.b)) continue; if (!byp.has(q.p)) byp.set(q.p, []); byp.get(q.p).push(q); }
  for (const ps of byp.values()) { const w = 1 / ps.length; for (const q of ps) { add(G, k(q.a, q.b), w); add(G, k(q.b, q.a), w); if (q.d > 0.01) add(W, k(q.a, q.b), w); else if (q.d < -0.01) add(W, k(q.b, q.a), w); else { add(W, k(q.a, q.b), w / 2); add(W, k(q.b, q.a), w / 2); } } }
  for (const m of items) { add(W, k(m, "_"), 1); add(W, k("_", m), 1); add(G, k(m, "_"), 2); add(G, k("_", m), 2); }
  let s = Object.fromEntries(it.map((m) => [m, 1]));
  for (let t = 0; t < 80; t++) {
    const n = {};
    for (const i of it) { let w = 0, den = 0; for (const j of it) { const g = G.get(k(i, j)); if (g) { w += W.get(k(i, j)) || 0; den += g / (s[i] + s[j]); } } n[i] = den ? w / den : s[i]; }
    const gm = Math.exp(it.reduce((a, m) => a + Math.log(Math.max(n[m], 1e-9)), 0) / it.length); for (const m of it) s[m] = Math.max(n[m], 1e-9) / gm;
  }
  delete s._; return s;
}

// ---------- cross-type lookups for inspectors ----------
export function classTasks(cls, F) {
  const M = new Map();
  for (let i = 0; i < D.nCmp; i++) {
    if (!cmpOK(i, { ...F, tt: "", tf: "" })) continue;
    const a = dv("cls", D.cmp.a[i]), b = dv("cls", D.cmp.b[i]); if (a !== cls && b !== cls) continue;
    const t = dv("tt", D.cmp.tt[i]); if (!t || t === "non_task_entry") continue;
    if (!M.has(t)) M.set(t, []); M.get(t).push({ p: D.cmp.p[i], d: a === cls ? D.cmp.d[i] : flip(D.cmp.d[i]), i });
  }
  return [...M.entries()].map(([t, rows]) => ({ t, rows, s: summarize(rows) })).sort((x, y) => y.s.papers - x.s.papers);
}
export function classLineages(cls, F) {
  const M = new Map();
  for (let i = 0; i < D.nCmp; i++) {
    if (!cmpOK(i, { ...F, lin: "", tier: "" })) continue;
    const a = dv("cls", D.cmp.a[i]), b = dv("cls", D.cmp.b[i]); if (a !== cls && b !== cls) continue;
    const l = dv("lin", D.cmp.lin[i]); if (!l || l === "other" || l === "unknown") continue;
    if (!M.has(l)) M.set(l, []); M.get(l).push({ p: D.cmp.p[i], d: a === cls ? D.cmp.d[i] : flip(D.cmp.d[i]), i });
  }
  return [...M.entries()].map(([l, rows]) => ({ l, rows, s: summarize(rows) })).sort((x, y) => y.s.papers - x.s.papers);
}
export function classCosts(cls) {
  const M = new Map(), C = D.cost;
  for (let i = 0; i < C.p.length; i++) { if (dv("cls", C.cls[i]) !== cls) continue; const d = dv("dim", C.dim[i]); if (!M.has(d)) M.set(d, { lv: [], papers: new Set(), basis: {} }); const m = M.get(d); m.lv.push(C.lv[i]); m.papers.add(C.p[i]); const b = dv("basis", C.basis[i]); m.basis[b] = (m.basis[b] || 0) + 1; }
  return Object.keys(D.tax.cost_dim).map((d) => { const m = M.get(d); return { d, n: m ? m.papers.size : 0, mean: m ? m.lv.reduce((a, b) => a + b, 0) / m.lv.length : null, basis: m ? m.basis : {} }; });
}
export function classFailures(cls) {
  const M = new Map(), Fa = D.fail;
  for (let i = 0; i < Fa.p.length; i++) { if (dv("cls", Fa.cls[i]) !== cls) continue; const f = dv("fm", Fa.fm[i]); if (!M.has(f)) M.set(f, { papers: new Set(), rows: [] }); M.get(f).papers.add(Fa.p[i]); M.get(f).rows.push(i); }
  return [...M.entries()].map(([f, m]) => ({ f, n: m.papers.size, rows: m.rows })).sort((a, b) => b.n - a.n);
}
export function classTokens(cls) {
  const tk = D.tok, rows = [];
  for (let i = 0; i < tk.p.length; i++) if (dv("cls", tk.cls[i]) === cls) rows.push(i);
  const med = (f) => { const v = rows.map((i) => tk[f][i]).filter((x) => x != null); return v.length ? { m: median(v), n: v.length } : null; };
  return { rows, input: med("input_tokens"), output: med("output_tokens"), cached: med("cached_tokens"), reasoning: med("reasoning_tokens"), total: med("total_tokens"), usd: med("usd"), latency: med("latency_s"), calls: med("llm_calls") };
}
export function papersWhere(pred) { const s = new Set(); for (let i = 0; i < D.nCmp; i++) if (pred(i)) s.add(D.cmp.p[i]); return [...s]; }
export const dvx = dv;
