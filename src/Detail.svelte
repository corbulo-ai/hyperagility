<script>
  import Tally from "./Tally.svelte";
  import DataTable from "./DataTable.svelte";
  import Evidence from "./Evidence.svelte";
  let { sections, onopen, kind } = $props();
  const INTRO = {
    option: "This page collects everything the papers found about one option: what it beat, where it works, what it costs, how it goes wrong, and each result behind those numbers.",
    tested_on: "This page collects what the papers found about one option on one kind of task.",
    h2h: "This page shows two options tested against each other in the same experiments.",
    task: "This page shows one kind of task agents are tested on, and which options did best on it.",
    taskfam: "This page shows one group of tasks agents are tested on, and which options did best on them.",
    model: "This page shows how one model scored against other models in the same experiments.",
    lineage: "This page shows how one family of models scored against others of the same size.",
    lineage_t: "This page shows how one family of models scored against others of the same size.",
    product: "This page shows one product line against others in the same experiments, and the exact models it covers.",
    failure: "This page shows one way agents go wrong, which methods it affects, and where papers reported it.",
    cost: "This page shows one kind of cost, and which methods are rated highest on it.",
    paper: "This page shows one paper and everything extracted from it.",
  };
  const jump = (i) => document.getElementById("sec-" + i)?.scrollIntoView();
  const header = $derived(sections[0]);
  // The first untitled stat block belongs in the hero, even when a definition precedes it.
  const headline = $derived(sections.slice(1, 4).find((x) => x.type === "kpis" && !x.title) || null);
  const rest = $derived(sections.slice(1).filter((x) => x !== headline));

  const contents = $derived(rest.filter((x) => x.title && (x.items?.length || x.type === "text")));

  const statColumns = [
    { id: "name", label: "Option", type: "name", get: (r) => r.label },
    { id: "papers", label: "Papers", type: "tally", get: (r) => r.s },
    { id: "win", label: "Won", type: "pct", get: (r) => r.s.win },
    { id: "typical", label: "Typical change", type: "signed", get: (r) => r.s.typical },
    { id: "evidence", label: "Evidence", type: "ev", get: (r) => r.s },
  ];
  const levelColumns = [
    { id: "name", label: "Name", type: "name", get: (r) => r.label },
    { id: "value", label: "Level", type: "level", get: (r) => r.value },
    { id: "display", label: "Detail", type: "text", get: (r) => r.display },
  ];
  const listColumns = [{ id: "name", label: "Name", type: "name", get: (r) => r.label, sub: (r) => r.sub }];
</script>

{#if INTRO[kind]}<p class="intro">{INTRO[kind]}</p>{/if}
<article class="panel hero">
  <p class="label">{header.subtitle}</p>
  <h1 class:long={header.title.length > 64}>{header.title}</h1>
  {#if header.text}<p class="text">{header.text}</p>{/if}
  {#if header.summary}<p class="summary">{header.summary}</p>{/if}
  {#if header.link}<a class="read" href={header.link} target="_blank" rel="noopener">Read the paper</a>{/if}
  {#if header.nav}<button class="parent" onclick={() => onopen(header.nav)}>Open parent group</button>{/if}
  {#if header.tally?.papers}<Tally s={header.tally} large />{/if}
  {#if headline}
    <dl>{#each headline.items as k}<div><dt class="label">{k.label}</dt><dd class="mono">{k.value}</dd>{#if k.note}<dd class="note">{k.note}</dd>{/if}</div>{/each}</dl>
  {/if}
</article>

{#if contents.length > 2}
  <nav class="contents" aria-label="On this page">
    <span class="label">On this page</span>
    {#each contents as sec}<button onclick={() => jump(rest.indexOf(sec))}>{sec.title}</button>{/each}
  </nav>
{/if}

{#each rest as sec, i}
  {#if sec.items?.length || sec.type === "text"}
    <section class="section" id="sec-{i}">
      {#if sec.title}<h2 class="section-label">{sec.title}</h2>{/if}
      {#if sec.hint}<p class="section-hint">{sec.hint}</p>{/if}
      {#if sec.type === "text"}
        <p class="prose">{sec.text}</p>
      {:else if sec.type === "kpis"}
        <div class="panel"><dl class="inner">{#each sec.items as k}<div><dt class="label">{k.label}</dt><dd class="mono">{k.value}</dd>{#if k.note}<dd class="note">{k.note}</dd>{/if}</div>{/each}</dl></div>
      {:else if sec.type === "bars"}
        <div class="panel flush"><DataTable columns={(sec.items[0].s ? statColumns : levelColumns).map((c) => (c.id === "name" && sec.nameLabel ? { ...c, label: sec.nameLabel } : c))} rows={sec.items} {onopen} /></div>
      {:else if sec.type === "list"}
        <div class="panel flush"><DataTable columns={listColumns} rows={sec.items} {onopen} headless /></div>
      {:else if sec.type === "chips"}
        <div class="chips">{#each sec.items as c}{#if c.nav}<button class="chip" onclick={() => onopen(c.nav)}>{c.label}</button>{:else}<span class="chip">{c.label}</span>{/if}{/each}</div>
      {:else if sec.type === "evidence"}
        <div class="panel flush"><Evidence items={sec.items} {onopen} /></div>
      {/if}
    </section>
  {/if}
{/each}

<style>
  .hero { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 32px; }
  h1 { font-size: clamp(2.25rem, 4.2vw, 3.5rem); line-height: 1.05; letter-spacing: -0.02em; font-weight: 700; }
  h1.long { font-size: clamp(1.5rem, 2.6vw, 2.25rem); line-height: 1.15; }
  .text { max-width: 66ch; font-size: 1rem; }
  .intro { max-width: 72ch; margin-bottom: 16px; font-size: 1rem; }
  .summary { max-width: 66ch; font-size: 1.125rem; color: var(--head); }
  .contents { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px; margin-top: 24px; }
  .contents button { all: unset; cursor: pointer; color: var(--primary); } .contents button:hover { color: var(--primary-hover); text-decoration: underline; } .contents button:focus-visible { outline: 2px solid var(--primary); }
  .section { scroll-margin-top: 72px; }
  .parent { all: unset; cursor: pointer; color: var(--primary); text-decoration: underline; } .parent:focus-visible { outline: 2px solid var(--primary); }
  dl { display: flex; flex-wrap: wrap; gap: 16px 48px; margin: 0; padding-top: 16px; border-top: 1px solid var(--border); width: 100%; }
  dl.inner { border: 0; padding: 0; }
  dd { margin: 4px 0 0; font-size: 1.25rem; font-weight: 700; color: var(--head); text-transform: capitalize; } dd.note { font: 13px/1.4 Inter, sans-serif; color: var(--body); text-transform: none; margin-top: 2px; }
  .flush { padding: 8px; }
  .prose { max-width: 66ch; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { font: 12px/1.4 "JetBrains Mono", monospace; color: var(--body); background: var(--high); border: 0; padding: 4px 8px; }
  button.chip { cursor: pointer; } button.chip:hover { background: var(--highest); color: var(--head); }
</style>
