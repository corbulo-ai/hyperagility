<script>
  import { onMount } from "svelte";
  import GraphCanvas from "./GraphCanvas.svelte";
  import Inspector from "./Inspector.svelte";
  import { loadKG, D, defaultFilters, clsName, famName, ttName, tfName, linName, fmName, dimName, pretty, keyName } from "./kg.js";
  import { VIEWS, LEVELS, FAM_COLORS, KIND_COLORS, methodsView, methodTaskView, modelsView, failureView, costView, papersView } from "./views.js";
  import { inspect } from "./inspect.js";

  let ready = $state(false), err = $state("");
  let view = $state("methods"), level = $state("family"), taskLevel = $state("family"), paperLevel = $state("family");
  let F = $state(defaultFilters());
  let mopt = $state({ by: "lineage", since: "2025", tier: "", open: false });
  let costTh = $state(0.6);
  let dark = $state(matchMedia("(prefers-color-scheme: dark)").matches);
  let history = $state([]), hpos = $state(-1);
  let q = $state(""), qOpen = $state(false);
  let canvas;

  onMount(async () => { try { await loadKG(); readHash(); if (hpos < 0) { history = [{ kind: "about" }]; hpos = 0; } ready = true; } catch (e) { err = e.message; } });
  // ---------- shareable state in the URL hash ----------
  function readHash() {
    try { const h = JSON.parse(decodeURIComponent(location.hash.slice(1)) || "{}");
      if (h.view) view = h.view; if (h.level) level = h.level; if (h.taskLevel) taskLevel = h.taskLevel; if (h.F) F = { ...defaultFilters(), ...h.F }; if (h.mopt) mopt = { ...mopt, ...h.mopt };
      if (h.nav) { history = [h.nav]; hpos = 0; } } catch (e) {}
  }
  $effect(() => { if (!ready) return; const st = { view, level, taskLevel, F: Fsnap, mopt: { ...mopt }, nav: current }; const s = encodeURIComponent(JSON.stringify(st)); if (location.hash.slice(1) !== s) history_replace(s); });
  function history_replace(s) { window.history.replaceState(null, "", "#" + s); }

  const Fsnap = $derived(JSON.parse(JSON.stringify(F)));
  const graphData = $derived.by(() => {
    if (!ready) return { nodes: [], edges: [] };
    const f = Fsnap;
    if (view === "methods") return methodsView(f, level);
    if (view === "tasks") return methodTaskView(f, level === "known" || ["ctx", "ma", "roles", "persona"].includes(level) ? level : level, taskLevel);
    if (view === "models") return modelsView(f, mopt);
    if (view === "failures") return failureView(f);
    if (view === "costs") return costView(f, costTh);
    if (view === "papers") return papersView(f, paperLevel);
    return { nodes: [], edges: [] };
  });
  const current = $derived(hpos >= 0 ? history[hpos] : null);
  const sections = $derived(ready && current ? inspect(current, Fsnap) : []);
  const selectedId = $derived.by(() => {
    const c = current; if (!c) return null;
    if (c.kind === "option") return "opt:" + c.key; if (c.kind === "task") return "task:" + c.key; if (c.kind === "taskfam") return "task:" + c.key;
    if (c.kind === "failure") return "fail:" + c.key; if (c.kind === "cost") return "cost:" + c.key; if (c.kind === "paper") return "paper:" + c.key;
    if (c.kind === "model" || c.kind === "lineage_t") return "model:" + c.key; if (c.kind === "h2h") return `h2h:${[c.x, c.y].sort().join("|")}`; return null;
  });
  const stats = $derived({ n: graphData.nodes.length, e: graphData.edges.length });

  function showInGraph() {
    const c = current; if (!c) return;
    if (c.kind === "option") { view = "methods"; level = c.level; }
    else if (c.kind === "task") { view = "tasks"; taskLevel = "type"; }
    else if (c.kind === "taskfam") { view = "tasks"; taskLevel = "family"; }
    else if (c.kind === "model") { view = "models"; mopt.by = "model"; mopt.since = ""; }
    else if (c.kind === "lineage_t" || c.kind === "lineage") { view = "models"; mopt.by = "lineage"; }
    else if (c.kind === "failure") view = "failures"; else if (c.kind === "cost") view = "costs"; else if (c.kind === "paper") view = "papers";
    else if (c.kind === "h2h") { view = "methods"; level = c.level; }
    setTimeout(() => canvas?.zoomTo(selectedId, true), 120);
  }
  function nav(n) { if (!n) return; history = [...history.slice(0, hpos + 1), n]; hpos = history.length - 1; qOpen = false; setTimeout(() => canvas?.zoomTo(selectedId), 50); }
  function onselect(sel) {
    if (!sel) return;
    const m = sel.meta || {};
    if (sel.type === "node") {
      if (sel.kind === "option") nav({ kind: "option", key: m.key, level: m.level });
      else if (sel.kind === "task") nav({ kind: "task", key: m.t }); else if (sel.kind === "taskfam") nav({ kind: "taskfam", key: m.t });
      else if (sel.kind === "lineage") nav({ kind: "lineage_t", key: m.key }); else if (sel.kind === "model") nav({ kind: "model", key: m.key });
      else if (sel.kind === "failure") nav({ kind: "failure", key: m.f }); else if (sel.kind === "cost") nav({ kind: "cost", key: m.d }); else if (sel.kind === "paper") nav({ kind: "paper", key: m.p });
    } else {
      if (sel.kind === "h2h") nav({ kind: "h2h", x: m.x, y: m.y, level: m.level });
      else if (sel.kind === "tested_on") nav({ kind: "tested_on", k: m.k, t: m.t, level: m.level, taskLevel: m.taskLevel });
      else if (sel.kind === "mh2h") nav({ kind: m.by === "lineage" ? "lineage_t" : "model", key: m.winner });
      else if (sel.kind === "fails_via") nav({ kind: "failure", key: m.f }); else if (sel.kind === "costs") nav({ kind: "cost", key: m.d }); else if (sel.kind === "studies") nav({ kind: "paper", key: m.p });
    }
  }
  // ---------- search ----------
  const searchIndex = $derived.by(() => {
    if (!ready) return [];
    const out = [];
    for (const [k, v] of Object.entries(D.tax.method_family)) out.push({ t: "Approach family", label: v.name, nav: { kind: "option", key: k, level: "family" } });
    for (const [k, v] of Object.entries(D.tax.method_class)) if (k !== "bare_model") out.push({ t: "Method", label: v.name, sub: v.def, nav: { kind: "option", key: k, level: "class" } });
    for (const k of D.dict.known || []) if (k) out.push({ t: "Named method", label: k, nav: { kind: "option", key: k, level: "known" } });
    for (const k of D.dict.fac || []) if (k) out.push({ t: "Design option", label: pretty(k), nav: { kind: "option", key: "fac:" + k, level: guessFacetLevel(k) } });
    for (const [k, v] of Object.entries(D.tax.task_family)) out.push({ t: "Task family", label: v.name, nav: { kind: "taskfam", key: k } });
    for (const [k, v] of Object.entries(D.tax.task_type)) out.push({ t: "Task type", label: v.name, sub: v.def, nav: { kind: "task", key: k } });
    for (const [k, v] of Object.entries(D.tax.lineage)) out.push({ t: "Model family", label: v.name, nav: { kind: "lineage", key: k } });
    for (const k of Object.keys(D.tax.models)) out.push({ t: "Model", label: k, nav: { kind: "model", key: k } });
    for (const [k, v] of Object.entries(D.tax.failure_mode)) out.push({ t: "Failure mode", label: v.name, sub: v.def, nav: { kind: "failure", key: k } });
    for (const [k, v] of Object.entries(D.tax.cost_dim)) out.push({ t: "Cost", label: pretty(v.name), nav: { kind: "cost", key: k } });
    D.papers.forEach((p, i) => out.push({ t: "Paper", label: p[1], sub: p[2], nav: { kind: "paper", key: i } }));
    return out;
  });
  function guessFacetLevel(v) {
    const C = D.cmp, i = D._idx.fac[v];
    for (const lv of ["ctx", "ma", "roles", "persona"]) if (C[lv + "A"].includes(i)) return lv; return "ctx";
  }
  const results = $derived.by(() => {
    const s = q.trim().toLowerCase(); if (s.length < 2) return [];
    const words = s.split(/\s+/);
    return searchIndex.filter((x) => words.every((w) => (x.label + " " + (x.sub || "")).toLowerCase().includes(w))).sort((a, b) => (a.label.toLowerCase().startsWith(s) ? -1 : 0) - (b.label.toLowerCase().startsWith(s) ? -1 : 0)).slice(0, 14);
  });
  const opts = (dict) => (ready ? (D.dict[dict] || []).filter((x) => x && !["unlabelled", "non_task_entry", "meta", "other", "unknown", "n/a"].includes(x)) : []);
  const taskTypes = $derived(ready ? Object.entries(D.tax.task_type).filter(([, v]) => !F.tf || v.family === F.tf) : []);
  const famList = $derived(ready ? Object.keys(D.tax.method_family) : []);
  function toggleFam(f) { F.fams = F.fams.includes(f) ? F.fams.filter((x) => x !== f) : [...F.fams, f]; }
  $effect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; });
  const viewDesc = $derived(VIEWS.find((v) => v.id === view)?.desc || "");
</script>

<div class="app">
  <header>
    <div class="brand">Agent Design Knowledge Graph</div>
    <nav>{#each VIEWS as v}<button class:on={view === v.id} onclick={() => (view = v.id)}>{v.name}</button>{/each}</nav>
    <div class="search">
      <input placeholder="Search methods, tasks, models, failures, papers…" bind:value={q} onfocus={() => (qOpen = true)} onkeydown={(e) => { if (e.key === "Enter" && results[0]) nav(results[0].nav); if (e.key === "Escape") qOpen = false; }} />
      {#if qOpen && results.length}
        <div class="results">{#each results as r}<button onclick={() => { nav(r.nav); q = ""; }}><span class="rt">{r.t}</span><span class="rl">{r.label}</span>{#if r.sub}<small>{String(r.sub).slice(0, 90)}</small>{/if}</button>{/each}</div>
      {/if}
    </div>
    <button class="theme" onclick={() => nav({ kind: "about" })} title="About this graph">?</button>
    <button class="theme" onclick={() => (dark = !dark)} title="Toggle theme">{dark ? "☾" : "☀"}</button>
  </header>

  {#if err}<div class="center">Could not load data: {err}</div>
  {:else if !ready}<div class="center">Loading the knowledge graph…</div>
  {:else}
  <div class="body">
    <aside class="left">
      <p class="vdesc">{viewDesc}</p>
      {#if view === "methods" || view === "tasks"}
        <h4>Show options as</h4>
        <select bind:value={level}>{#each LEVELS as l}<option value={l.id}>{l.name}</option>{/each}</select>
      {/if}
      {#if view === "tasks"}
        <h4>Tasks as</h4>
        <div class="seg"><button class:on={taskLevel === "family"} onclick={() => (taskLevel = "family")}>Task families</button><button class:on={taskLevel === "type"} onclick={() => (taskLevel = "type")}>Task types</button></div>
      {/if}
      {#if view === "papers"}
        <h4>Link papers to</h4>
        <div class="seg"><button class:on={paperLevel === "family"} onclick={() => (paperLevel = "family")}>Families</button><button class:on={paperLevel === "class"} onclick={() => (paperLevel = "class")}>Methods</button></div>
      {/if}
      {#if view === "models"}
        <h4>Compare</h4>
        <div class="seg"><button class:on={mopt.by === "lineage"} onclick={() => (mopt.by = "lineage")}>Families (same size)</button><button class:on={mopt.by === "model"} onclick={() => (mopt.by = "model")}>Exact models</button></div>
        <h4>Released since</h4>
        <select bind:value={mopt.since}><option value="">Any time</option><option value="2023">2023</option><option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option></select>
        <h4>Size</h4>
        <select bind:value={mopt.tier}><option value="">Any</option><option value="frontier">Frontier</option><option value="strong">Strong</option><option value="small">Small</option></select>
        <label class="ck"><input type="checkbox" bind:checked={mopt.open} /> Open weights only</label>
      {/if}
      {#if view === "costs"}
        <h4>Show links rated at least</h4>
        <input type="range" min="0.3" max="0.9" step="0.1" bind:value={costTh} /> <span class="small">{costTh}</span>
      {/if}

      <h4>Task</h4>
      <select bind:value={F.tf} onchange={() => (F.tt = "")}><option value="">All task families</option>{#each Object.entries(D.tax.task_family) as [k, v]}<option value={k}>{v.name}</option>{/each}</select>
      <select bind:value={F.tt}><option value="">All task types</option>{#each taskTypes as [k, v]}<option value={k}>{v.name}</option>{/each}</select>
      {#if view !== "models"}
        <h4>Model</h4>
        <select bind:value={F.tier}><option value="">Any size</option><option value="frontier">Frontier</option><option value="strong">Strong / mid-size</option><option value="small">Small</option></select>
        <select bind:value={F.lin}><option value="">Any model family</option>{#each opts("lin").sort((a, b) => linName(a).localeCompare(linName(b))) as l}<option value={l}>{linName(l)}</option>{/each}</select>
        <h4>Which results count</h4>
        <div class="seg three"><button class:on={F.lens === "all"} onclick={() => (F.lens = "all")}>All</button><button class:on={F.lens === "independent"} onclick={() => (F.lens = "independent")}>Independent</button><button class:on={F.lens === "matched"} onclick={() => (F.lens = "matched")}>Same budget</button></div>
        <p class="small">{F.lens === "all" ? "Every comparison papers reported." : F.lens === "independent" ? "Only comparisons where neither side is the paper's own new method." : "Only comparisons where both sides had the same compute budget."}</p>
        <h4>Approach families</h4>
        <div class="fams">{#each famList as f}<button class="fam" class:off={F.fams.length && !F.fams.includes(f)} onclick={() => toggleFam(f)}><span class="dot" style="background:{FAM_COLORS[f]}"></span>{famName(f)}</button>{/each}</div>
        {#if F.fams.length}<button class="link" onclick={() => (F.fams = [])}>show all families</button>{/if}
      {/if}
      <h4>Minimum papers per node</h4>
      <input type="range" min="1" max="15" step="1" bind:value={F.minP} /> <span class="small">{F.minP}</span>
      <h4>Papers from</h4>
      <select bind:value={F.yearMin}><option value={0}>Any year</option><option value={2024}>2024 or later</option><option value={2025}>2025 or later</option><option value={2026}>2026</option></select>
      <div class="legend">
        <h4>Legend</h4>
        <div><span class="sw" style="background:rgba(46,160,90,.8)"></span>usually wins</div><div><span class="sw" style="background:rgba(210,70,70,.8)"></span>usually loses</div>
        <div class="small">Node size = number of papers. Edge width = papers behind the link. {view === "methods" || view === "models" ? "Arrows point to the usual winner." : ""}</div>
        <div class="kinds"><span><i style="background:{KIND_COLORS.task}"></i>task</span><span><i style="background:{KIND_COLORS.lineage}"></i>model</span><span><i style="background:{KIND_COLORS.failure}"></i>failure</span><span><i style="background:{KIND_COLORS.cost}"></i>cost</span><span><i style="background:{KIND_COLORS.paper}"></i>paper</span><span><i style="background:{KIND_COLORS.facet}"></i>design option</span></div>
      </div>
    </aside>
    <main class="center-pane">
      <GraphCanvas bind:this={canvas} data={graphData} {selectedId} {dark} onselect={onselect} />
      <div class="gstats">{stats.n} nodes · {stats.e} links · {D.stats.papers} papers in the graph <button class="link" onclick={() => canvas?.resetCamera()}>reset view</button></div>
      {#if stats.n === 0}<div class="emptyg">Nothing matches these filters. Lower the minimum papers or widen the task / model filters.</div>{/if}
    </main>
    <aside class="right">
      {#if current && current.kind !== "about" && !(selectedId && graphData.nodes.some((n) => n.id === selectedId))}<button class="showg" onclick={showInGraph}>Show in graph ↗</button>{/if}
      <Inspector {sections} onnav={nav} onback={() => (hpos = Math.max(0, hpos - 1))} onfwd={() => (hpos = Math.min(history.length - 1, hpos + 1))} canBack={hpos > 0} canFwd={hpos < history.length - 1} />
    </aside>
  </div>
  {/if}
</div>

<style>
  .app { height: 100vh; display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 14px; padding: 8px 14px; border-bottom: 1px solid var(--line); background: var(--bg1); flex-wrap: wrap; }
  .brand { font-weight: 700; white-space: nowrap; }
  nav { display: flex; gap: 2px; flex-wrap: wrap; } nav button { font: inherit; font-size: 14px; border: 0; background: none; color: var(--mut); padding: 6px 10px; border-radius: 7px; cursor: pointer; }
  nav button.on { background: var(--accbg); color: var(--acc); font-weight: 600; }
  .search { position: relative; flex: 1; min-width: 240px; max-width: 520px; margin-left: auto; }
  .search input { width: 100%; font: inherit; padding: 7px 11px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); }
  .results { position: absolute; top: 40px; left: 0; right: 0; background: var(--bg1); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.25); z-index: 30; max-height: 70vh; overflow: auto; }
  .results button { all: unset; display: grid; grid-template-columns: 110px 1fr; gap: 0 10px; padding: 7px 12px; cursor: pointer; width: calc(100% - 24px); } .results button:hover { background: var(--bg2); }
  .rt { font-size: 11px; color: var(--mut); text-transform: uppercase; letter-spacing: .04em; padding-top: 2px; } .results small { grid-column: 2; color: var(--mut); font-size: 12px; }
  .theme { font: inherit; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 8px; padding: 4px 10px; cursor: pointer; }
  .center { padding: 80px; text-align: center; color: var(--mut); }
  .body { flex: 1; display: grid; grid-template-columns: 270px 1fr 440px; min-height: 0; }
  @media (max-width: 1100px) { .body { grid-template-columns: 240px 1fr 360px; } }
  .left { border-right: 1px solid var(--line); padding: 12px 14px 30px; overflow: auto; background: var(--bg1); }
  .right { border-left: 1px solid var(--line); overflow: auto; background: var(--bg1); }
  .center-pane { position: relative; overflow: hidden; background: var(--bg); }
  .vdesc { font-size: 13px; color: var(--mut); margin: 0 0 6px; }
  h4 { margin: 14px 0 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--mut); }
  select { width: 100%; font: inherit; font-size: 14px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); color: var(--fg); margin-bottom: 5px; }
  .seg { display: flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; } .seg button { flex: 1; font: inherit; font-size: 12px; border: 0; background: var(--bg); color: var(--mut); padding: 6px 4px; cursor: pointer; }
  .seg button.on { background: var(--acc); color: #fff; }
  .small { font-size: 12px; color: var(--mut); } .ck { display: flex; gap: 6px; font-size: 13px; margin-top: 6px; }
  input[type=range] { width: 75%; vertical-align: middle; }
  .fams { display: flex; flex-wrap: wrap; gap: 4px; } .fam { font: inherit; font-size: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); border-radius: 99px; padding: 2px 8px; cursor: pointer; display: flex; align-items: center; gap: 5px; }
  .fam.off { opacity: .35; } .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .link { all: unset; color: var(--acc); font-size: 12px; cursor: pointer; margin-top: 4px; }
  .legend div { font-size: 12px; display: flex; align-items: center; gap: 6px; margin: 2px 0; } .sw { width: 18px; height: 4px; border-radius: 2px; display: inline-block; }
  .kinds { flex-wrap: wrap; gap: 8px !important; margin-top: 6px !important; } .kinds span { display: flex; align-items: center; gap: 4px; } .kinds i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .gstats { position: absolute; left: 12px; bottom: 10px; font-size: 12px; color: var(--mut); background: var(--bg1); border: 1px solid var(--line); padding: 4px 9px; border-radius: 8px; }
  .showg { margin: 10px 16px 0; font: inherit; font-size: 13px; border: 1px solid var(--acc); color: var(--acc); background: var(--accbg); border-radius: 8px; padding: 4px 10px; cursor: pointer; }
  .emptyg { position: absolute; top: 40%; left: 0; right: 0; text-align: center; color: var(--mut); }
</style>
