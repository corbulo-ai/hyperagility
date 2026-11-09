<script>
  import { D } from "./kg.js";
  import { LEVELS, rankOptions } from "./rank.js";
  import Filters from "./Filters.svelte";
  import BigCard from "./BigCard.svelte";
  import DataTable from "./DataTable.svelte";
  let { F = $bindable(), level = $bindable(), onopen } = $props();

  const rows = $derived(rankOptions(F, level));
  const featured = $derived(rows.filter((r) => r.s.papers >= 5).slice(0, 3));
  const levelInfo = $derived(LEVELS.find((l) => l.id === level));
  const columns = $derived([
    { id: "name", label: levelInfo.one, type: "name", get: (r) => r.name },
    { id: "papers", label: "Papers", type: "tally", get: (r) => r.s },
    { id: "typical", label: "Typical change", type: "signed", get: (r) => r.s.typical },
    { id: "all", label: "All results", type: "wonof", get: (r) => r.all },
    { id: "independent", label: "Independent", type: "wonof", get: (r) => r.independent },
    { id: "matched", label: "Same budget", type: "wonof", get: (r) => r.matched },
    { id: "evidence", label: "Evidence", type: "ev", get: (r) => r.s },
  ]);
  const TERMS = [
    ["Won", "The method scored better than whatever that paper compared it against, on the same model, task and metric. Each paper counts once, however many results it reports. Within half a percent counts as tied."],
    ["Typical change", "How much the score moved in the middle paper. +4% means a score of 50 became about 52."],
    ["Independent", "The paper was not introducing that method. Authors tend to favor their own work, so compare this with all results."],
    ["Evidence", "How many papers back a result: solid is 10 or more, some is 5 to 9, thin is 3 or 4, and anecdotal is fewer than 3."],
  ];
</script>

<header class="intro">
  <h1>Which ways of building AI agents actually work?</h1>
  <p>There are dozens of techniques for improving an AI agent: letting it check its own work, giving it memory, running several agents together, and many more. Most published results come from papers testing their own new technique, which makes it hard to know what really helps.</p>
  <p>HyperAgility lines up the results from {D.stats.papers} research papers, so you can see which techniques beat the alternatives, on which tasks and models, what they cost, and how they fail. Every number links back to the paper it came from.</p>
</header>

<section class="section">
  <h2 class="section-label">How to read the results</h2>
  <div class="panel terms">
    <p class="tiles-note">Each colored block is one paper: green if the method won there, gray if it tied, red if it lost. More blocks means more evidence.</p>
    <dl>{#each TERMS as [term, text]}<div><dt>{term}</dt><dd>{text}</dd></div>{/each}</dl>
  </div>
</section>

<section class="section">
  <h2 class="section-label">What do you want to rank?</h2>
  <p class="section-hint">Choose one. The results below change to match.</p>
  <div class="picks" role="radiogroup" aria-label="What to rank">
    {#each LEVELS as l}
      <button class="pick" role="radio" aria-checked={level === l.id} onclick={() => (level = l.id)}><strong>{l.pick}</strong><span>{l.help}</span></button>
    {/each}
  </div>
</section>

<section class="section">
  <h2 class="section-label">Narrow it down</h2>
  <p class="section-hint">Optional. Nothing is filtered until you change one of these.</p>
  <Filters bind:F />
</section>

{#if !rows.length}
  <section class="section panel"><h2>No {levelInfo.name} match these filters</h2><p>Choose a broader task or model, or change which results count.</p></section>
{:else}
  {#if featured.length}
    <section class="section">
      <h2 class="section-label big">The best-supported {levelInfo.name}</h2>
      <p class="section-hint">Each card is one {levelInfo.one}, not a paper, with results pooled from every paper that tested it. These won most often with enough papers behind them to take seriously.</p>
      <div class="cards">
        {#each featured as r, i (r.key)}<div class:wide={i === 0}><BigCard {r} {level} lens={F.lens} rank={i + 1} total={rows.length} lead={i === 0} {onopen} /></div>{/each}
      </div>
    </section>
  {:else}
    <p class="section">No {levelInfo.one} here has 5 or more papers behind it, so none is highlighted. The table shows what exists.</p>
  {/if}

  <section class="section">
    <h2 class="section-label big">All {rows.length} {levelInfo.name}</h2>
    <p class="section-hint">Best supported first: a high win rate counts for less when few papers back it. The bar has one notch per paper, with wins first. The percentages show how often it won under each kind of test. Select a row to open it.</p>
    <div class="panel flush"><DataTable {columns} {rows} {onopen} /></div>
  </section>
{/if}

<style>
  h1 { font-size: clamp(2.25rem, 4.2vw, 3.5rem); line-height: 1.05; letter-spacing: -0.02em; font-weight: 700; max-width: 20ch; }
  .intro p { max-width: 66ch; margin-top: 16px; font-size: 1.125rem; }
  .terms dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin: 16px 0 0; }
  .tiles-note { font-size: 1rem; color: var(--head); max-width: 72ch; }
  dt { color: var(--head); font-weight: 700; } dd { margin: 4px 0 0; }
  .picks { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
  .pick { font: inherit; text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 16px; background: var(--card); color: var(--body); border: 1px solid var(--border); cursor: pointer; transition: background 150ms linear; }
  .pick:hover { background: var(--high); }
  .pick strong { color: var(--head); font-size: 1rem; }
  .pick[aria-checked="true"] { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 15%, var(--card)); }
  .pick[aria-checked="true"] strong { color: var(--primary); }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .cards > div { min-width: 0; display: grid; } .wide { grid-column: 1 / -1; }
  .flush { padding: 8px; }
  @media (max-width: 900px) { .cards { grid-template-columns: 1fr; } }
</style>
