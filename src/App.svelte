<script>
  import { onMount } from "svelte";
  import { loadKG, D, defaultFilters, pretty } from "./kg.js";
  import { inspect } from "./inspect.js";
  import { LENSES } from "./rank.js";
  import Home from "./Home.svelte";
  import Lists from "./Lists.svelte";
  import Detail from "./Detail.svelte";
  import Filters from "./Filters.svelte";
  import License from "./License.svelte";
  import Agents from "./Agents.svelte";

  const NAV = [["works", "What works"], ["models", "Models"], ["failures", "Failures"], ["costs", "Costs"], ["papers", "Papers"]];
  const FILTERED_DETAILS = ["option", "h2h", "task", "taskfam", "tested_on"];

  let ready = $state(false), err = $state("");
  let view = $state("works"), detail = $state(null), level = $state("class"), F = $state(defaultFilters());
  let dark = $state(true), q = $state(""), searchOpen = $state(false);
  let lastHash = "", agentsOpen = $state(false);

  // ---------- URL state: only non-default values, so links stay short and shareable ----------
  function snapshot() {
    const o = {}, defaults = defaultFilters(), changed = {};
    if (view !== "works") o.v = view;
    if (detail) o.n = detail;
    if (level !== "class") o.l = level;
    for (const k of Object.keys(defaults)) if (JSON.stringify(F[k]) !== JSON.stringify(defaults[k])) changed[k] = F[k];
    if (Object.keys(changed).length) o.f = changed;
    return Object.keys(o).length ? encodeURIComponent(JSON.stringify(o)) : "";
  }
  function applyHash() {
    let h = {};
    try { h = JSON.parse(decodeURIComponent(location.hash.slice(1)) || "{}"); } catch (e) { h = {}; }
    view = h.v || "works"; detail = h.n || null; level = h.l || "class"; F = { ...defaultFilters(), ...(h.f || {}) };
  }
  function go(nextView, nextDetail) {
    view = nextView; detail = nextDetail; searchOpen = false; q = "";
    lastHash = snapshot();
    location.hash = lastHash;
    window.scrollTo(0, 0);
  }
  const open = (n) => go(view, n);

  onMount(() => {
    const onHash = () => { if (location.hash.slice(1) !== lastHash) { lastHash = location.hash.slice(1); applyHash(); window.scrollTo(0, 0); } };
    window.addEventListener("hashchange", onHash);
    loadKG().then(() => { lastHash = location.hash.slice(1); applyHash(); ready = true; }).catch((e) => { err = e.message; });
    return () => window.removeEventListener("hashchange", onHash);
  });
  $effect(() => {
    if (!ready) return;
    const s = snapshot();
    if (location.hash.slice(1) !== s) { lastHash = s; history.replaceState(null, "", s ? "#" + s : location.pathname + location.search); }
  });
  $effect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; });

  const sections = $derived(ready && detail ? inspect(detail, $state.snapshot(F)) : []);
  const filterSummary = $derived(LENSES.find((l) => l.id === F.lens).name + (F.tf || F.tt || F.tier || F.lin || F.yearMin ? ", with task, model or year filters on" : ""));

  // ---------- search ----------
  function facetLevel(v) {
    const C = D.cmp, i = D._idx.fac[v];
    for (const lv of ["ctx", "ma", "roles", "persona"]) if (C[lv + "A"].includes(i)) return lv;
    return "ctx";
  }
  const searchIndex = $derived.by(() => {
    if (!ready) return [];
    const out = [], tax = D.tax;
    for (const [k, v] of Object.entries(tax.method_family)) out.push({ t: "Approach family", label: v.name, nav: { kind: "option", key: k, level: "family" } });
    for (const [k, v] of Object.entries(tax.method_class)) if (k !== "bare_model") out.push({ t: "Method", label: v.name, sub: v.def, nav: { kind: "option", key: k, level: "class" } });
    for (const k of D.dict.known || []) if (k) out.push({ t: "Named method", label: k, nav: { kind: "option", key: k, level: "known" } });
    for (const k of D.dict.fac || []) if (k) out.push({ t: "Design option", label: pretty(k), nav: { kind: "option", key: "fac:" + k, level: facetLevel(k) } });
    for (const [k, v] of Object.entries(tax.task_family)) out.push({ t: "Task family", label: v.name, nav: { kind: "taskfam", key: k } });
    for (const [k, v] of Object.entries(tax.task_type)) out.push({ t: "Task type", label: v.name, sub: v.def, nav: { kind: "task", key: k } });
    for (const [k, v] of Object.entries(tax.lineage)) out.push({ t: "Model family", label: v.name, nav: { kind: "lineage", key: k } });
    for (const k of Object.keys(tax.models)) out.push({ t: "Model", label: k, nav: { kind: "model", key: k } });
    for (const [k, v] of Object.entries(tax.failure_mode)) out.push({ t: "Failure", label: v.name, sub: v.def, nav: { kind: "failure", key: k } });
    for (const [k, v] of Object.entries(tax.cost_dim)) out.push({ t: "Cost", label: pretty(v.name), nav: { kind: "cost", key: k } });
    D.papers.forEach((p, i) => out.push({ t: "Paper", label: p[1].trim(), sub: p[2], nav: { kind: "paper", key: i } }));
    return out;
  });
  const results = $derived.by(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const words = s.split(/\s+/);
    return searchIndex.filter((x) => words.every((w) => (x.label + " " + (x.sub || "")).toLowerCase().includes(w)))
      .sort((a, b) => (a.label.toLowerCase().startsWith(s) ? -1 : 0) - (b.label.toLowerCase().startsWith(s) ? -1 : 0)).slice(0, 14);
  });
</script>

<div class="shell">
  <aside class="side">
    <button class="brand" onclick={() => go("works", null)}>HyperAgility</button>
    <nav aria-label="Main">
      {#each NAV as [id, name]}<button class:on={view === id && view !== "about"} aria-current={view === id ? "page" : undefined} onclick={() => go(id, null)}>{name}</button>{/each}
      <button onclick={() => (agentsOpen = true)}>Use with agents</button>
      <button class:on={view === "about"} onclick={() => go("about", { kind: "about" })}>About</button>
      <button class:on={view === "license"} aria-current={view === "license" ? "page" : undefined} onclick={() => go("license", null)}>License</button>
    </nav>
  </aside>

  <div class="column">
    <header class="top">
      {#if detail && view !== "about"}<button class="btn" onclick={() => history.back()}>Back</button>{/if}
      <div class="search">
        <input class="search-input" aria-label="Search" placeholder="Search methods, tasks, models, papers" bind:value={q} onfocus={() => (searchOpen = true)} onkeydown={(e) => { if (e.key === "Enter" && results[0]) go(view, results[0].nav); if (e.key === "Escape") searchOpen = false; }} />
        {#if searchOpen && results.length}
          <div class="results">{#each results as r}<button onclick={() => go(view, r.nav)}><span class="label">{r.t}</span><span class="name">{r.label}</span>{#if r.sub}<small>{String(r.sub).slice(0, 90)}</small>{/if}</button>{/each}</div>
        {/if}
      </div>
      <button class="btn" onclick={() => (dark = !dark)}>{dark ? "Light" : "Dark"}</button>
    </header>
    <Agents bind:open={agentsOpen} />

    <main>
      {#if err}<div class="panel"><h1>The data did not load</h1><p>{err}. Reload the page to try again.</p></div>
      {:else if !ready}<p>Loading results from the papers.</p>
      {:else if detail && sections?.length}
        {#if FILTERED_DETAILS.includes(detail.kind)}
          <details class="filters"><summary>Showing {filterSummary}. <span>Change filters</span></summary><div class="inner"><Filters bind:F /></div></details>
        {/if}
        {#key JSON.stringify(detail)}<Detail {sections} onopen={open} kind={detail.kind} />{/key}
      {:else if view === "works"}<Home bind:F bind:level onopen={open} />
      {:else if view === "license"}<License />
      {:else}{#key view}<Lists {view} onopen={open} />{/key}{/if}

      <footer>Built by <a href="https://corbulo.dev" target="_blank" rel="noopener">Corbulo</a> with <span aria-label="love">♥</span>. <button onclick={() => go("license", null)}>License and credit</button></footer>
    </main>
  </div>
</div>

<style>
  .shell { display: grid; grid-template-columns: 256px minmax(0, 1fr); min-height: 100vh; }
  .side { background: var(--lowest); border-right: 1px solid var(--border); position: sticky; top: 0; height: 100vh; }
  .brand { all: unset; cursor: pointer; display: block; height: 56px; line-height: 56px; padding: 0 24px; font-size: 1.125rem; font-weight: 700; letter-spacing: -0.02em; color: var(--head); }
  .brand:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
  nav { display: flex; flex-direction: column; padding-top: 8px; }
  nav button { all: unset; cursor: pointer; padding: 12px 24px 12px 22px; border-left: 2px solid transparent; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  nav button:hover { color: var(--head); } nav button:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
  nav button.on { border-left-color: var(--primary); background: var(--card); color: var(--head); }
  .column { min-width: 0; display: flex; flex-direction: column; }
  .top { height: 56px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 16px; padding: 0 32px; position: sticky; top: 0; z-index: 20; }
  .search { position: relative; flex: 1; max-width: 560px; margin-left: auto; }
  .results { position: absolute; top: 44px; left: 0; right: 0; background: var(--highest); border: 1px solid var(--border); max-height: 70vh; overflow: auto; }
  .results button { all: unset; display: grid; grid-template-columns: 112px 1fr; gap: 0 16px; padding: 8px 16px; cursor: pointer; width: 100%; box-sizing: border-box; }
  .results button:hover, .results button:focus-visible { background: var(--high); }
  .name { color: var(--head); } .results small { grid-column: 2; color: var(--body); font-size: 12px; }
  main { flex: 1; padding: 32px; max-width: 1360px; width: 100%; }
  .filters { margin-bottom: 16px; } summary { cursor: pointer; color: var(--body); } summary span { color: var(--primary); text-decoration: underline; } .inner { padding: 16px 0 8px; }
  footer { margin-top: 64px; padding-top: 16px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }
  footer a { color: inherit; } footer button { all: unset; cursor: pointer; text-decoration: underline; } footer button:focus-visible { outline: 2px solid var(--primary); }
  @media (max-width: 800px) {
    .shell { grid-template-columns: minmax(0, 1fr); }
    .side { position: fixed; top: auto; bottom: 0; left: 0; right: 0; height: auto; z-index: 30; border-right: 0; border-top: 1px solid var(--border); }
    .brand { display: none; }
    nav { flex-direction: row; padding: 0; overflow-x: auto; scrollbar-width: none; }
    nav button { padding: 16px 12px; border-left: 0; border-bottom: 2px solid transparent; white-space: nowrap; font-size: 11px; }
    nav button.on { border-bottom-color: var(--primary); }
    .top { padding: 0 16px; gap: 8px; } main { padding: 16px 16px 88px; }
  }
</style>
