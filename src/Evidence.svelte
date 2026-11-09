<script>
  let { items, onopen } = $props();
  let filter = $state("all"), limit = $state(25), open = $state({}), showAll = $state(false);
  $effect(() => { items; filter = "all"; limit = 25; open = {}; });
  const outcome = (e) => (e.won ? "won" : e.lost ? "lost" : "tied");
  const counts = $derived(items.reduce((a, e) => { a[outcome(e)]++; return a; }, { won: 0, tied: 0, lost: 0 }));
  const shown = $derived(filter === "all" ? items : items.filter((e) => outcome(e) === filter));
  const pct = (v) => (v >= 0 ? "+" : "−") + Math.abs(Math.round(v * 100)) + "%";
  const hasDetail = (e) => e.quote || e.cls || e.flags?.length;
  const metaLine = (e) => [e.page && `Page ${e.page}.`, e.cls && `${e.cls}.`, e.flags?.length && `${e.flags.join(", ")}.`].filter(Boolean).join(" ");
  function setFilter(f) { filter = f; limit = 25; open = {}; }
</script>

<div class="bar">
  <div class="pills">
    <button class="pill" aria-pressed={filter === "all"} onclick={() => setFilter("all")}>All {items.length.toLocaleString()}</button>
    {#each ["won", "tied", "lost"] as f}<button class="pill" aria-pressed={filter === f} onclick={() => setFilter(f)}>{f} {counts[f].toLocaleString()}</button>{/each}
  </div>
  <button class="btn" onclick={() => (showAll = !showAll)}>{showAll ? "Hide quotes" : "Show all quotes"}</button>
</div>

<div class="wrap">
  <table>
    <thead><tr><th>Result</th><th>Compared</th><th>Measured on</th><th>Scores</th><th>Paper</th></tr></thead>
    <tbody>
      {#each shown.slice(0, limit) as e, i (i)}
        {@const out = outcome(e)}
        <tr class="row" class:clickable={hasDetail(e)} onclick={() => hasDetail(e) && (open = { ...open, [i]: !open[i] })}>
          <td class="res mono"><i class="dot {out}"></i><span class="word">{out}</span> {pct(e.d)}</td>
          <td class="what">{#if hasDetail(e)}<button aria-expanded={showAll || !!open[i]}>{e.head}</button>{:else}{e.head}{/if}</td>
          <td>{e.sub}</td>
          <td class="mono scores">{e.values}</td>
          <td class="paper"><button onclick={(ev) => { ev.stopPropagation(); onopen({ kind: "paper", key: e.paper.i }); }}>{e.paper.title}</button></td>
        </tr>
        {#if hasDetail(e) && (showAll || open[i])}
          <tr class="detail"><td></td><td colspan="4">
            {#if e.quote}<blockquote>{e.quote}</blockquote>{/if}
            <p class="meta">{metaLine(e)} {#if e.paper.url}<a href={e.paper.url} target="_blank" rel="noopener">Read the paper</a>{/if}</p>
          </td></tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
{#if !shown.length}<p class="none">No {filter} results here.</p>{/if}
{#if shown.length > limit}<button class="btn more" onclick={() => (limit += 25)}>Show {Math.min(25, shown.length - limit)} more of {shown.length.toLocaleString()}</button>{/if}

<style>
  .bar { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-bottom: 16px; }
  .wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font: 14px/1.5 Inter, sans-serif; }
  th { text-align: left; font: 700 11px/1.5 "Space Grotesk", sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); background: var(--surface); border-bottom: 1px solid var(--border); padding: 8px; white-space: nowrap; }
  td { border-bottom: 1px solid var(--border); padding: 12px 8px; vertical-align: top; }
  .clickable { cursor: pointer; } .clickable:hover td { background: var(--high); }
  .res { white-space: nowrap; font-size: 13px; color: var(--head); } .word { text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: .05em; margin-right: 4px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; } .won { background: var(--good); } .lost { background: var(--bad); } .tied { background: var(--muted); }
  .what { color: var(--head); font-weight: 600; min-width: 200px; } .what button, .paper button { all: unset; cursor: pointer; } .what button:focus-visible, .paper button:focus-visible { outline: 2px solid var(--primary); }
  .scores { white-space: nowrap; font-size: 13px; }
  .paper button { color: var(--primary); } .paper button:hover { color: var(--primary-hover); text-decoration: underline; } .paper { min-width: 220px; }
  .detail td { background: var(--surface); }
  blockquote { margin: 0 0 8px; padding-left: 16px; border-left: 2px solid var(--strong); color: var(--head); max-width: 66ch; }
  .meta { font-size: 13px; } .none { padding: 16px 8px; }
  .more { margin-top: 16px; }
  @media (max-width: 760px) {
    table, tbody, tr, td { display: block; } thead { display: none; } td { border: 0; padding: 2px 8px; }
    tr.row { border-top: 1px solid var(--border); padding: 12px 0 4px; } .detail td:first-child { display: none; } .detail td { padding: 8px; }
  }
</style>
