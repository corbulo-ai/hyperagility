<script>
  import { defaultFilters } from "./kg.js";
  import { modelRows, productGroups, failureRows, costRows, paperRows } from "./rank.js";
  import DataTable from "./DataTable.svelte";
  let { view, onopen } = $props();

  let by = $state("product"), since = $state(""), tier = $state(""), open = $state(false), q = $state("");

  const COPY = {
    models: ["Which model line comes out ahead?", "Results from experiments that ran two models on the same method, task and metric, so differences come from the model."],
    failures: ["How methods fail", "Failure modes reported across the papers, most widely reported first."],
    costs: ["What methods cost", "The costs papers report or imply, and the method rated highest on each."],
    papers: ["Papers", "Every paper in the data set. Open one to see its extracted results and quotes."],
  };
  const modelCols = [
    { id: "name", label: "Model", type: "name", get: (r) => r.name },
    { id: "size", label: "Size", type: "text", get: (r) => r.size },
    { id: "papers", label: "Papers", type: "tally", get: (r) => r.s },
    { id: "win", label: "Won", type: "pct", get: (r) => r.s.win },
    { id: "typical", label: "Typical change", type: "signed", get: (r) => r.s.typical },
    { id: "evidence", label: "Evidence", type: "ev", get: (r) => r.s },
  ];
  const failCols = [
    { id: "name", label: "Failure", type: "name", get: (r) => r.name, sub: (r) => r.sub },
    { id: "group", label: "Group", type: "text", get: (r) => r.group },
    { id: "papers", label: "Papers", type: "num", get: (r) => r.papers },
    { id: "cases", label: "Cases", type: "num", get: (r) => r.cases },
    { id: "major", label: "Major", type: "num", get: (r) => r.major },
  ];
  const costCols = [
    { id: "name", label: "Cost", type: "name", get: (r) => r.name, sub: (r) => r.sub },
    { id: "papers", label: "Papers", type: "num", get: (r) => r.papers },
    { id: "costliest", label: "Rated highest", type: "text", get: (r) => r.costliest },
  ];
  const paperCols = [
    { id: "name", label: "Title", type: "name", get: (r) => r.name },
    { id: "year", label: "Year", type: "num", get: (r) => r.year },
    { id: "venue", label: "Venue", type: "text", get: (r) => r.venue },
    { id: "results", label: "Results", type: "num", get: (r) => r.results },
  ];
  const lineCols = [
    { id: "name", label: "Product line", type: "name", get: (r) => r.name, sub: (r) => r.models },
    { id: "papers", label: "Papers", type: "tally", get: (r) => r.s },
    { id: "win", label: "Scored higher", type: "pct", get: (r) => r.s.win },
    { id: "typical", label: "Typical change", type: "signed", get: (r) => r.s.typical },
    { id: "evidence", label: "Evidence", type: "ev", get: (r) => r.s },
  ];
  const acrossCols = [lineCols[0], { id: "maker", label: "Maker", type: "text", get: (r) => r.maker }, ...lineCols.slice(1)];
  const allPapers = paperRows();
  const papers = $derived.by(() => { const s = q.trim().toLowerCase(); return s ? allPapers.filter((p) => p.name.toLowerCase().includes(s)) : allPapers; });
  const models = $derived(view === "models" && by !== "product" ? modelRows(defaultFilters(), { by, since, tier, open }) : []);
  const products = $derived(view === "models" && by === "product" ? productGroups(defaultFilters(), since) : null);
  const failures = failureRows();
  const costs = costRows();
</script>

<header>
  <h1>{COPY[view][0]}</h1>
  <p>{COPY[view][1]}</p>
</header>

{#if view === "models"}
  <section class="section controls">
    <label class="field"><span class="label">Compare</span><select bind:value={by}><option value="product">Product lines, such as Opus or Sonnet</option><option value="lineage">Model families of the same size</option><option value="model">Exact models</option></select></label>
    <label class="field"><span class="label">Released since</span><select bind:value={since}><option value="">Any time</option><option value="2023">2023</option><option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option></select></label>
    {#if by !== "product"}
      <label class="field"><span class="label">Model size</span><select bind:value={tier}><option value="">Any size</option><option value="frontier">Frontier</option><option value="strong">Strong or mid-size</option><option value="small">Small</option></select></label>
      <label class="check"><input type="checkbox" bind:checked={open} /> Open weights only</label>
    {/if}
  </section>
  {#if products}
    <p class="section section-hint">The bars have one notch per paper. Newer models tend to beat older ones, so set "Released since" to compare only recent lines. Lines with 1 or 2 papers are shown, but treat them as anecdotes.</p>
    {#each products.groups as g (g.maker)}
      <section class="section">
        <h2 class="section-label">{g.maker}</h2>
        <p class="section-hint">Each line against {g.maker}'s other lines, in {g.papers} {g.papers === 1 ? "paper" : "papers"} that ran both.</p>
        <div class="panel flush"><DataTable columns={lineCols} rows={g.rows} {onopen} /></div>
      </section>
    {/each}
    {#if products.noDirect.length}<p class="section">No paper here tests two product lines from {products.noDirect.join(" or ")} against each other. Those lines appear in the table below instead.</p>{/if}
    <section class="section">
      <h2 class="section-label">All product lines, across every maker</h2>
      <p class="section-hint">Each line against every other line it was tested with. Large models usually beat small ones, so use this to get oriented and open a line to see exactly what it faced.</p>
      <div class="panel flush"><DataTable columns={acrossCols} rows={products.across} {onopen} /></div>
    </section>
  {:else}
  <section class="section">
    {#if models.length}<div class="panel flush"><DataTable columns={modelCols} rows={models} {onopen} /></div>
    {:else}<p>No models have 3 or more papers with these settings. Choose an earlier release date or any size.</p>{/if}
  </section>
  {/if}
{:else if view === "failures"}
  <section class="section panel flush"><DataTable columns={failCols} rows={failures} {onopen} /></section>
{:else if view === "costs"}
  <section class="section panel flush"><DataTable columns={costCols} rows={costs} {onopen} /></section>
{:else}
  <section class="section controls"><label class="field grow"><span class="label">Find a paper</span><input bind:value={q} placeholder="Search titles" /></label></section>
  <section class="section">
    {#if papers.length}<div class="panel flush"><DataTable columns={paperCols} rows={papers} {onopen} /></div>
    {:else}<p>No paper titles match "{q}".</p>{/if}
    <p class="download"><a href="./papers.csv" download>Download the paper list as CSV</a></p>
  </section>
{/if}

<style>
  h1 { font-size: clamp(2rem, 3.6vw, 3rem); line-height: 1.05; font-weight: 700; letter-spacing: -0.02em; max-width: 22ch; }
  header p { max-width: 66ch; margin-top: 12px; font-size: 1.125rem; }
  .controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; align-items: end; }
  .check { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; color: var(--body); }
  .flush { padding: 8px; } .download { margin-top: 16px; }
</style>
