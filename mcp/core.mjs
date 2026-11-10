// Agent-facing queries over the HyperAgility data. Reuses the site's own data layer (src/kg.js, src/inspect.js, src/rank.js),
// so every number an agent gets is the number the site shows under the same filter. Everything returns markdown.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as K from "../src/kg.js";
import { inspect } from "../src/inspect.js";
import { rankOptions } from "../src/rank.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SITE = "https://hyperagility.org";
const BUNDLED = path.join(HERE, "../public/kg.json.gz");
let D = null;
export let source = "";
const parse = (buf) => JSON.parse((buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString("utf8"));
/** Loads the data the site is serving right now, so answers match hyperagility.org; falls back to the snapshot shipped with this package.
 *  KG_DATA=<file> forces a local file, HYPERAGILITY_OFFLINE=1 skips the download. */
export async function load() {
  if (D) return D;
  if (!process.env.KG_DATA && !process.env.HYPERAGILITY_OFFLINE) {
    try {
      const res = await fetch(SITE + "/kg.json.gz", { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      D = K.setKG(parse(Buffer.from(await res.arrayBuffer())));
      overview(); // fails here if the live data no longer fits this version of the code
      source = "live";
      return D;
    } catch (e) { D = null; console.error(`hyperagility: could not use live data (${e.message}); using the bundled snapshot`); }
  }
  const file = process.env.KG_DATA || BUNDLED;
  D = K.setKG(parse(fs.readFileSync(file)));
  source = process.env.KG_DATA ? file : "bundled";
  return D;
}

// ---------- vocabulary ----------
export const LEVELS = ["class", "family", "known", "ctx", "ma", "roles", "persona"];
const FACET_LEVELS = { ctx: "context-management mechanism", ma: "multi-agent structure", roles: "role assignment", persona: "persona type" };
const FACET_DEFAULT = { ctx: "no context management", ma: "single agent", roles: "single agent", persona: "no persona" };
const pct = (v) => (v >= 0 ? "+" : "") + Math.round(v * 100) + "%";
const share = (v) => Math.round(v * 100) + "%";
const uniq = (a) => [...new Set(a)];

function facetValues(level) {
  const C = D.cmp, s = new Set();
  for (const side of ["A", "B"]) for (const i of C[level + side]) s.add(D.dict.fac[i]);
  s.delete("");
  return [...s].sort();
}
/** every valid key at a level (facet keys are returned without the "fac:" prefix) */
function keysAt(level) {
  if (level === "class") return Object.keys(D.tax.method_class);
  if (level === "family") return [...Object.keys(D.tax.method_family), "bare_model"];
  if (level === "known") return D.dict.known.filter(Boolean);
  return [...facetValues(level), FACET_DEFAULT[level]];
}
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
function suggest(value, candidates, n = 6) {
  const v = norm(value);
  const hit = candidates.filter((c) => norm(c).includes(v) || v.includes(norm(c)));
  const toks = String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const loose = candidates.filter((c) => !hit.includes(c) && toks.some((t) => norm(c).includes(t)));
  return [...hit, ...loose].slice(0, n);
}
class Unknown extends Error {}
function resolve(value, candidates, what) {
  if (candidates.includes(value)) return value;
  const exact = candidates.find((c) => norm(c) === norm(value));
  if (exact) return exact;
  const s = suggest(value, candidates);
  throw new Unknown(`Unknown ${what} "${value}".${s.length ? " Did you mean: " + s.join(", ") + "?" : ""} Call kg_vocabulary to list valid ids.`);
}
/** user-facing key -> internal option key at a level */
function optKey(value, level) {
  const v = String(value || "").replace(/^fac:/, "");
  const k = resolve(v, keysAt(level), level === "class" ? "method class" : level === "family" ? "method family" : level === "known" ? "named method" : FACET_LEVELS[level]);
  return FACET_LEVELS[level] ? "fac:" + k : k;
}
function filters(a = {}) {
  const F = K.defaultFilters();
  if (a.task_type) F.tt = resolve(a.task_type, Object.keys(D.tax.task_type), "task type");
  if (a.task_family) F.tf = resolve(a.task_family, Object.keys(D.tax.task_family), "task family");
  if (a.model_tier) F.tier = resolve(a.model_tier, ["frontier", "strong", "small"], "model tier");
  if (a.model_lineage) F.lin = resolve(a.model_lineage, Object.keys(D.tax.lineage), "model lineage");
  if (a.lens) F.lens = resolve(a.lens, ["all", "independent", "matched"], "lens");
  if (a.year_min) F.yearMin = a.year_min;
  if (a.min_papers != null) F.minP = a.min_papers;
  return F;
}
function filterText(F) {
  const p = [];
  if (F.tt) p.push(`task type = ${K.ttName(F.tt)}`);
  if (F.tf) p.push(`task family = ${K.tfName(F.tf)}`);
  if (F.tier) p.push(`model tier = ${F.tier}`);
  if (F.lin) p.push(`model lineage = ${K.linName(F.lin)}`);
  if (F.lens !== "all") p.push(F.lens === "independent" ? "independent tests only" : "same-budget comparisons only");
  if (F.yearMin) p.push(`papers from ${F.yearMin}`);
  return p.length ? p.join(", ") : "no filter (all evidence)";
}

// ---------- section renderer (the inspector panels of the site, as markdown) ----------
function evLine(e) {
  const p = e.paper || {};
  const bits = [`**${e.head}**`, e.sub, e.values && `values ${e.values}`, e.d != null && `difference ${pct(e.d)}`, ...(e.flags || [])].filter(Boolean).join(" · ");
  const src = `${p.title || ""} (${p.year || "n.d."})${e.page ? ", p." + e.page : ""}${p.url ? " " + p.url : ""} [paper ${p.id}]`;
  return `- ${bits}\n  - source: ${src}${e.quote ? `\n  - quote: "${String(e.quote).replace(/\s+/g, " ").trim()}"` : ""}`;
}
export function render(sections, { evidence = 8, rows = 15 } = {}) {
  const out = [];
  for (const s of sections || []) {
    const items = s.items || [];
    if (s.type === "header") { out.push(`# ${s.title}`, s.subtitle ? `_${s.subtitle}_` : "", s.text || "", s.summary || "", s.link ? `Link: ${s.link}` : ""); continue; }
    if (s.type === "text") { out.push(`**${s.title}.** ${s.text}`); continue; }
    if (!items.length) continue;
    if (s.title) out.push(`## ${s.title}`);
    if (s.hint && s.type !== "evidence") out.push(`_${s.hint}_`);
    if (s.type === "kpis") out.push(items.map((i) => `- ${i.label}: ${i.value}${i.note ? ` (${i.note})` : ""}`).join("\n"));
    else if (s.type === "bars") out.push(items.slice(0, rows).map((i) => `- ${i.label}: ${i.display}`).join("\n"));
    else if (s.type === "list") out.push(items.slice(0, rows).map((i) => `- ${i.label}${i.sub ? ` — ${i.sub}` : ""}`).join("\n") + (items.length > rows ? `\n- … ${items.length - rows} more` : ""));
    else if (s.type === "chips") out.push(items.map((i) => i.label).join(", "));
    else if (s.type === "evidence") out.push(evidence > 0 ? items.slice(0, evidence).map(evLine).join("\n") + (items.length > evidence ? `\n- … more results available (raise evidence_limit, max 40)` : "") : "(evidence rows omitted; set evidence_limit > 0)");
  }
  return out.filter(Boolean).join("\n\n");
}

// ---------- tools ----------
export const CAVEATS = [
  "Results are within-paper comparisons (same paper, model, task, metric) pooled across papers; each paper counts once.",
  "Papers choose their own baselines, and authors' own methods tend to win: check the `independent` and `matched` lenses before trusting a ranking.",
  "Evidence strength by paper count: 10+ solid, 5–9 some, 3–4 thin, under 3 anecdotal. Do not present thin or anecdotal cells as settled.",
  "Cost levels are partly inferred from method descriptions; failure-mode labels are the least reliable (about 76% agreement at group level).",
  "This is evidence about method classes in published benchmarks, not a measurement of the user's own system.",
].map((c) => "- " + c).join("\n");

export function vocabulary({ kind, search }) {
  const T = D.tax, q = norm(search), keep = (...t) => !q || t.some((x) => norm(x).includes(q));
  const line = (id, name, def) => `- \`${id}\` — ${name}${def ? `: ${def}` : ""}`;
  switch (kind) {
    case "method_families": return "# Method families\n" + Object.entries(T.method_family).map(([k, v]) => line(k, v.name, v.def)).join("\n");
    case "methods": {
      const fams = [...Object.keys(T.method_family), "bare"];
      return "# Method classes (use these ids in `method`)\n" + fams.map((f) => {
        const rows = Object.entries(T.method_class).filter(([k, c]) => c.family === f && keep(k, c.name, c.def, c.include)).map(([k, c]) => line(k, c.name, c.def + (c.include ? ` Includes: ${c.include}` : "") + (c.exclude ? ` Excludes: ${c.exclude}` : "")));
        return rows.length ? `\n## ${K.famName(f)} (\`${f}\`)\n${rows.join("\n")}` : "";
      }).join("");
    }
    case "named_methods": {
      const n = new Map(), C = D.cmp;
      for (let i = 0; i < D.nCmp; i++) for (const [kk, cc] of [[C.kA[i], C.a[i]], [C.kB[i], C.b[i]]]) { const name = D.dict.known[kk]; if (!name) continue; if (!n.has(name)) n.set(name, { p: new Set(), c: D.dict.cls[cc] }); n.get(name).p.add(C.p[i]); }
      const rows = [...n.entries()].filter(([k]) => keep(k)).sort((a, b) => b[1].p.size - a[1].p.size).slice(0, 60);
      return `# Named methods${search ? ` matching "${search}"` : " (60 most studied; pass `search` to find others)"}\n` + rows.map(([k, v]) => `- \`${k}\` — ${v.p.size} papers · class \`${v.c}\``).join("\n");
    }
    case "task_types": return "# Task types (use in `task_type`; family ids in `task_family`)\n" + Object.entries(T.task_family).map(([f, fv]) => {
      const rows = Object.entries(T.task_type).filter(([k, t]) => t.family === f && keep(k, t.name, t.def)).map(([k, t]) => line(k, t.name, t.def));
      return rows.length ? `\n## ${fv.name} (\`${f}\`)\n${rows.join("\n")}` : "";
    }).join("");
    case "facets": return "# Design facets (use in `facet`, or as `level` in kg_methods and kg_compare)\n" + Object.entries(FACET_LEVELS).map(([lv, nm]) => `\n## \`${lv}\` — ${nm}\n${facetValues(lv).map((v) => `- \`${v}\``).join("\n")}\n- \`${FACET_DEFAULT[lv]}\` (the default when a method has none)`).join("\n");
    case "failure_modes": return "# Failure modes\n" + Object.entries(T.failure_mode).filter(([k, v]) => keep(k, v.name, v.def)).map(([k, v]) => line(k, `${v.name} [${v.group}]`, v.def)).join("\n");
    case "cost_dimensions": return "# Cost dimensions\n" + Object.entries(T.cost_dim).map(([k, v]) => line(k, v.name, `${v.def} Levels: ${v.levels.join(" → ")}`)).join("\n");
    case "model_lineages": return "# Model lineages (use in `model_lineage`)\nTiers (use in `model_tier`): `frontier`, `strong`, `small`.\n" + Object.entries(T.lineage).filter(([k, v]) => keep(k, v.name)).map(([k, v]) => line(k, v.name, v.def)).join("\n");
    case "models": {
      const rows = Object.entries(T.models).filter(([k]) => keep(k)).slice(0, 80);
      return `# Models${search ? ` matching "${search}"` : " (first 80; pass `search`)"}\n` + rows.map(([k, m]) => `- \`${k}\` — ${K.linName(m.lin)} · ${m.tier || "?"}${m.rel ? " · " + m.rel : ""}`).join("\n");
    }
  }
  throw new Unknown(`Unknown kind "${kind}".`);
}

export function compare(a) {
  const level = a.level || "class", F = filters(a);
  const x = optKey(a.a, level), y = optKey(a.b, level);
  if (x === y) throw new Unknown("`a` and `b` are the same option.");
  return `Scope: ${filterText(F)}.\n\n` + render(inspect({ kind: "h2h", x, y, level }, F).filter((s) => s.title !== "Open either side"), { evidence: a.evidence_limit ?? 8 });
}

function findPaper(key) {
  const k = String(key).trim(), byId = D.papers.findIndex((p) => p[0] === k.padStart(4, "0"));
  if (byId >= 0) return byId;
  const q = norm(k), hits = D.papers.map((p, i) => [p, i]).filter(([p]) => norm(p[1]).includes(q) || (p[4] && p[4].includes(k)));
  if (hits.length === 1) return hits[0][1];
  throw new Unknown(hits.length ? `Several papers match "${key}":\n${hits.slice(0, 15).map(([p]) => `- ${p[0]} — ${p[1]} (${p[2]})`).join("\n")}\nCall again with the 4-digit id.` : `No paper matches "${key}". Use a 4-digit paper id (shown in evidence rows) or part of the title.`);
}
export function inspectEntity(a) {
  const F = filters(a), opt = { evidence: a.evidence_limit ?? 8, rows: 20 };
  let nav;
  switch (a.kind) {
    case "method": nav = { kind: "option", key: optKey(a.key, "class"), level: "class" }; break;
    case "method_family": nav = { kind: "option", key: optKey(a.key, "family"), level: "family" }; break;
    case "named_method": nav = { kind: "option", key: optKey(a.key, "known"), level: "known" }; break;
    case "facet": { const lv = LEVELS.slice(3).find((l) => keysAt(l).some((v) => norm(v) === norm(String(a.key).replace(/^fac:/, "")))); if (!lv) throw new Unknown(`Unknown facet value "${a.key}". Call kg_vocabulary with kind "facets".`); nav = { kind: "option", key: optKey(a.key, lv), level: lv }; break; }
    case "task_type": nav = { kind: "task", key: resolve(a.key, Object.keys(D.tax.task_type), "task type") }; break;
    case "task_family": nav = { kind: "taskfam", key: resolve(a.key, Object.keys(D.tax.task_family), "task family") }; break;
    case "failure_mode": nav = { kind: "failure", key: resolve(a.key, Object.keys(D.tax.failure_mode), "failure mode") }; break;
    case "cost_dimension": nav = { kind: "cost", key: resolve(a.key, Object.keys(D.tax.cost_dim), "cost dimension") }; break;
    case "model": nav = { kind: "model", key: resolve(a.key, Object.keys(D.tax.models), "model") }; break;
    case "paper": nav = { kind: "paper", key: findPaper(a.key) }; break;
    default: throw new Unknown(`Unknown kind "${a.kind}".`);
  }
  return `Scope: ${filterText(F)}.\n\n` + render(inspect(nav, F), opt);
}
export { Unknown };

// ---------- overview ----------
export function overview() {
  const s = D.stats;
  return [
    `# HyperAgility (${SITE}), data as of ${D.built}`,
    `${s.papers} papers on building LLM agents, with every reported result extracted and linked to its page and quote: ${s.cmp.toLocaleString()} method-vs-method results, ${s.mp.toLocaleString()} model-vs-model results, ${s.fail.toLocaleString()} failure cases, ${s.cost.toLocaleString()} cost ratings, ${s.tok.toLocaleString()} token/$ measurements, ${s.claims.toLocaleString()} author conclusions.`,
    `This holds categories, numbers and quotes, not the papers' full reasoning. Treat it as an index: use it to find what has been tested for a task or model, then read the papers it points to.`,
    `## Two ways in`,
    [
      "**From the methods.** Look at your own setup, then call `kg_vocabulary` (`methods`, `task_types`, `facets`, `named_methods`) and label each part of it with the closest category, so there is something to compare against. `kg_methods` lists what has been tested for a task type or model with the numbers; `kg_compare` gives one pair head-to-head; `kg_inspect` opens any single method, task, model or paper; `kg_papers` returns the papers behind any of it, with links, to read and evaluate.",
      "**From the failures.** `kg_failures` lists the failure modes papers report for a method class or task type, with definitions. Check which of them the setup also shows, then `kg_papers` with that failure mode for the papers that describe it.",
    ].join("\n\n"),
    `These tools take category ids only. Nothing about the setup being examined needs to be sent.`,
    `## Reading the numbers`,
    `"Won" means the option scored better than whatever that paper compared it against, on the same model, task and metric; each paper counts once and results within half a percent count as tied. "Typical change" is the median relative change in score across papers. These are the same numbers the site shows under the same filters. Lenses: \`all\` = every reported result; \`independent\` = neither side is the paper's own proposed method; \`matched\` = both sides had the same compute budget.`,
    `## Limits`, CAVEATS,
  ].join("\n\n");
}

// ---------- methods table (the site's "What works" ranking) ----------
export function listMethods(a) {
  const level = a.level || "class", F = filters(a);
  if (!LEVELS.includes(level)) throw new Unknown(`Unknown level "${level}". One of: ${LEVELS.join(", ")}.`);
  if (a.method_family) F.fams = [resolve(a.method_family, Object.keys(D.tax.method_family), "method family")];
  const all = rankOptions(F, level).filter((r) => r.s.papers >= F.minP);
  if (!all.length) return `Scope: ${filterText(F)}.\n\nNo option has ${F.minP}+ papers under this scope. Widen it (task family instead of task type, drop the model filter, or lower min_papers).`;
  const sort = a.sort || "site";
  if (sort === "papers") all.sort((x, y) => y.s.papers - x.s.papers); else if (sort === "win") all.sort((x, y) => y.s.win - x.s.win);
  const limit = a.limit ?? 40, wonOf = (s) => (s.papers ? `${Math.round(s.win * s.papers)} of ${s.papers}` : "none");
  const rows = all.slice(0, limit).map((r) => `| ${r.name} | \`${r.key.replace(/^fac:/, "")}\` | ${r.s.papers} | ${share(r.s.win)} | ${share(r.s.loss)} | ${pct(r.s.typical)} | ${wonOf(r.all)} | ${wonOf(r.independent)} | ${wonOf(r.matched)} | ${wonOf(r.vsBare)} | ${K.confidence(r.s.papers)} |`);
  return [`# ${FACET_LEVELS[level] ? FACET_LEVELS[level] + "s" : level === "family" ? "Method families" : level === "known" ? "Named methods" : "Method classes"} compared`,
    `Scope: ${filterText(F)}${F.fams.length ? `, family = ${K.famName(F.fams[0])}` : ""}. ${all.length} options with ${F.minP}+ papers${all.length > limit ? `, showing ${limit}` : ""}, ${sort === "site" ? "in the site's order (win rate discounted for small samples)" : "sorted by " + sort}.`,
    `Papers, Won, Lost and Typical change use the lens in scope. The next three columns give papers won under each lens (all results / independent tests / same budget) so they can be compared; "vs bare model" counts only comparisons against the model with no method.`,
    `| Option | id | Papers | Won | Lost | Typical change | All results | Independent | Same budget | vs bare model | Evidence |\n|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join("\n")}`,
    `Next: \`kg_compare\` for a pair, \`kg_inspect\` for one option (tasks, models, costs, failures, quoted results), \`kg_papers\` for the papers to read.`].join("\n\n");
}

// ---------- papers ----------
export function findPapers(a) {
  const F = filters(a), C = D.cmp, P = new Map();
  const get = (p) => { if (!P.has(p)) P.set(p, { n: 0, cls: new Set(), known: new Set(), bm: new Set(), fm: new Set(), fcases: 0 }); return P.get(p); };
  const cls = a.method ? optKey(a.method, "class") : null, fam = a.method_family ? resolve(a.method_family, Object.keys(D.tax.method_family), "method family") : null;
  const known = a.named_method ? optKey(a.named_method, "known") : null;
  let facet = null;
  if (a.facet) { const v = String(a.facet).replace(/^fac:/, ""), lv = LEVELS.slice(3).find((l) => facetValues(l).some((x) => norm(x) === norm(v))); if (!lv) throw new Unknown(`Unknown facet value "${a.facet}". Call kg_vocabulary with kind "facets".`); facet = [lv, resolve(v, facetValues(lv), "facet")]; }
  const fm = a.failure_mode ? resolve(a.failure_mode, Object.keys(D.tax.failure_mode), "failure mode") : null;
  const q = norm(a.query), textOK = (p) => !q || norm(D.papers[p][1] + " " + D.papers[p][5]).includes(q);
  const dict = (d, i) => D.dict[d][i];
  for (let i = 0; i < D.nCmp; i++) {
    if (!K.cmpOK(i, F)) continue;
    const ca = dict("cls", C.a[i]), cb = dict("cls", C.b[i]);
    if (cls && ca !== cls && cb !== cls) continue;
    if (fam && K.clsFam(ca) !== fam && K.clsFam(cb) !== fam) continue;
    const ka = dict("known", C.kA[i]), kb = dict("known", C.kB[i]);
    if (known && ka !== known && kb !== known) continue;
    if (facet && dict("fac", C[facet[0] + "A"][i]) !== facet[1] && dict("fac", C[facet[0] + "B"][i]) !== facet[1]) continue;
    if (!textOK(C.p[i])) continue;
    const e = get(C.p[i]); e.n++; e.cls.add(ca); e.cls.add(cb); if (ka) e.known.add(ka); if (kb) e.known.add(kb); const b = dict("bm", C.bm[i]); if (b) e.bm.add(b);
  }
  if (fm) { // keep only papers that report this failure mode (for the same method / task when given)
    const Fa = D.fail, hit = new Map();
    for (let i = 0; i < Fa.p.length; i++) {
      if (dict("fm", Fa.fm[i]) !== fm) continue;
      const c = dict("cls", Fa.cls[i]), t = dict("tt", Fa.tt[i]);
      if (cls && c !== cls) continue; if (fam && K.clsFam(c) !== fam) continue;
      if (F.tt && t !== F.tt) continue; if (F.tf && K.ttFam(t) !== F.tf) continue;
      if (!textOK(Fa.p[i])) continue;
      hit.set(Fa.p[i], (hit.get(Fa.p[i]) || 0) + 1);
    }
    const modelOrFacet = F.tier || F.lin || known || facet || F.lens !== "all";
    for (const p of [...P.keys()]) if (!hit.has(p)) P.delete(p);
    for (const [p, n] of hit) { if (!P.has(p)) { if (modelOrFacet) continue; get(p); } P.get(p).fcases = n; }
  }
  const all = [...P.entries()].sort((x, y) => y[1].fcases - x[1].fcases || y[1].n - x[1].n), limit = a.limit ?? 15;
  const scope = [filterText(F), cls && `method = ${K.clsName(cls)}`, fam && `family = ${K.famName(fam)}`, known && `named method = ${known}`, facet && `${FACET_LEVELS[facet[0]]} = ${facet[1]}`, fm && `failure mode = ${K.fmName(fm)}`, a.query && `text ~ "${a.query}"`].filter(Boolean).join(", ");
  if (!all.length) return `Scope: ${scope}.\n\nNo papers match. Widen the scope.`;
  const body = all.slice(0, limit).map(([p, e]) => {
    const pp = K.paper(p), cl = [...e.cls].filter((c) => c && c !== "bare_model").map(K.clsName);
    return [`### [${pp.id}] ${pp.title} (${pp.year || "n.d."}${pp.venue ? ", " + pp.venue : ""})`, pp.url ? `Link: ${pp.url}` : "",
      `${e.n} matching result${e.n === 1 ? "" : "s"}${e.fcases ? ` · ${e.fcases} case${e.fcases === 1 ? "" : "s"} of this failure mode` : ""}${cl.length ? ` · compares: ${cl.slice(0, 8).join(", ")}${e.cls.has("bare_model") ? ", bare model" : ""}` : ""}`,
      e.known.size ? `Named methods: ${[...e.known].slice(0, 10).join(", ")}` : "", e.bm.size ? `Benchmarks: ${[...e.bm].slice(0, 6).join(", ")}` : "",
      a.abstracts && pp.abstract ? `Abstract: ${pp.abstract}` : ""].filter(Boolean).join("\n");
  });
  return [`# Papers (${all.length}${all.length > limit ? `, showing ${limit}` : ""})`, `Scope: ${scope}. Sorted by number of matching results.`, ...body,
    `Next: \`kg_inspect\` with kind \`paper\` and the 4-digit id for a paper's extracted results, quotes, failures and the authors' conclusions; open the link to read the paper itself.`].join("\n\n");
}

// ---------- failures ----------
export function failures(a) {
  const F = filters(a), Fa = D.fail, dict = (d, i) => D.dict[d][i];
  const cls = a.method ? optKey(a.method, "class") : null, fam = a.method_family ? resolve(a.method_family, Object.keys(D.tax.method_family), "method family") : null;
  const M = new Map(); let total = new Set();
  for (let i = 0; i < Fa.p.length; i++) {
    const c = dict("cls", Fa.cls[i]), t = dict("tt", Fa.tt[i]);
    if (cls && c !== cls) continue; if (fam && K.clsFam(c) !== fam) continue;
    if (F.tt && t !== F.tt) continue; if (F.tf && K.ttFam(t) !== F.tf) continue;
    if (F.yearMin && D._year[Fa.p[i]] < F.yearMin) continue;
    const f = dict("fm", Fa.fm[i]);
    if (!M.has(f)) M.set(f, { p: new Map(), cases: 0, major: 0, dir: {}, cls: new Map() });
    const m = M.get(f); m.cases++; m.p.set(Fa.p[i], (m.p.get(Fa.p[i]) || 0) + 1); if (dict("sev", Fa.sev[i]) === "major") m.major++;
    const d = dict("dir", Fa.dir[i]); if (d) m.dir[d] = (m.dir[d] || 0) + 1; if (c) m.cls.set(c, (m.cls.get(c) || 0) + 1);
    total.add(Fa.p[i]);
  }
  const scope = [cls && `method = ${K.clsName(cls)}`, fam && `family = ${K.famName(fam)}`, F.tt && `task type = ${K.ttName(F.tt)}`, F.tf && `task family = ${K.tfName(F.tf)}`, F.yearMin && `papers from ${F.yearMin}`].filter(Boolean).join(", ") || "all methods and tasks";
  if (!M.size) return `Scope: ${scope}.\n\nNo failure cases recorded under this scope. Widen it (method family, task family).`;
  const rows = [...M.entries()].sort((x, y) => y[1].p.size - x[1].p.size).map(([f, m]) => {
    const def = D.tax.failure_mode[f] || {}, top = [...m.p.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([p]) => { const pp = K.paper(p); return `[${pp.id}] ${pp.title} (${pp.year})`; });
    const meth = cls ? "" : `\n- Methods most affected: ${[...m.cls.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([c, n]) => `${K.clsName(c)} (${n})`).join(", ")}`;
    return `### ${def.name || f} (\`${f}\`, ${def.group || ""})\n${def.def || ""}\n- ${m.p.size} paper${m.p.size === 1 ? "" : "s"}, ${m.cases} case${m.cases === 1 ? "" : "s"}, ${m.major} rated major${Object.keys(m.dir).length ? `; ${Object.entries(m.dir).map(([d, n]) => `${K.pretty(d).toLowerCase()} ${n}`).join(", ")}` : ""}${meth}\n- Papers: ${top.join("; ")}${m.p.size > 4 ? `; … ${m.p.size - 4} more` : ""}`;
  });
  return [`# Failure modes reported`, `Scope: ${scope}. ${total.size} papers report failures here. Model filters do not apply: failure cases are recorded per paper, method and task.`, ...rows,
    `Failure-mode labels are the least reliable labels in the graph (about 76% agreement at group level): read them as pointers to papers, not as rates.`,
    `Next: \`kg_papers\` with \`failure_mode\` for the full paper list; \`kg_inspect\` with kind \`failure_mode\` for every case.`].join("\n\n");
}
