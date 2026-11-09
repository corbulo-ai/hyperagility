<script>
  import Tally from "./Tally.svelte";
  import { confidence } from "./kg.js";
  // Column types: name, tally, pct, signed, num, text, wonof, ev, level
  let { columns, rows, onopen, pageSize = 25, headless = false } = $props();
  let sortId = $state(null), dir = $state(-1), limit = $state(25);
  $effect(() => { rows; limit = pageSize; });

  const TEXT = ["name", "text"];
  const pct = (v) => Math.round(v * 100) + "%";
  const signed = (v) => { const n = Math.round(v * 100); return (n >= 0 ? "+" : "−") + Math.abs(n) + "%"; };
  function sortValue(c, r) {
    const v = c.get(r);
    if (c.type === "tally" || c.type === "ev") return v.papers;
    if (c.type === "wonof") return v.papers ? v.win : -1;
    return v;
  }
  const sorted = $derived.by(() => {
    const c = columns.find((x) => x.id === sortId);
    if (!c) return rows;
    return [...rows].sort((a, b) => { const x = sortValue(c, a), y = sortValue(c, b); return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir; });
  });
  function sortBy(c) {
    if (sortId === c.id) dir = -dir;
    else { sortId = c.id; dir = TEXT.includes(c.type) ? 1 : -1; }
  }
  const unitFor = (c) => Math.min(8, 160 / Math.max(1, ...rows.map((r) => c.get(r).papers)));
</script>

<div class="wrap">
  <table>
    {#if !headless}
      <thead><tr>
        {#each columns as c}
          <th class={c.type} aria-sort={sortId === c.id ? (dir > 0 ? "ascending" : "descending") : "none"}>
            <button onclick={() => sortBy(c)}>{c.label}{#if sortId === c.id}<span aria-hidden="true">{dir > 0 ? " ▲" : " ▼"}</span>{/if}</button>
          </th>
        {/each}
      </tr></thead>
    {/if}
    <tbody>
      {#each sorted.slice(0, limit) as r}
        <tr class:clickable={r.nav} onclick={() => r.nav && onopen(r.nav)}>
          {#each columns as c}
            {@const v = c.get(r)}
            <td class={c.type}>
              {#if c.type === "name"}
                {#if r.nav}<button class="open">{v}</button>{:else}<span class="title">{v}</span>{/if}
                {#if c.sub && c.sub(r)}<small>{c.sub(r)}</small>{/if}
              {:else if c.type === "tally"}<Tally s={v} unit={unitFor(c)} /> <span class="n">{v.papers}</span>
              {:else if c.type === "pct"}{pct(v)}
              {:else if c.type === "signed"}{signed(v)}
              {:else if c.type === "wonof"}{#if v.papers}<span class="strong">{pct(v.win)}</span> of {v.papers}{:else}None{/if}
              {:else if c.type === "ev"}{confidence(v.papers)}
              {:else if c.type === "level"}<span class="level"><span style="width:{Math.round(Math.min(1, v) * 100)}%"></span></span> {v.toFixed(2)}
              {:else}{v}{/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
{#if rows.length > limit}<button class="btn more" onclick={() => (limit += pageSize)}>Show {Math.min(pageSize, rows.length - limit)} more of {rows.length.toLocaleString()}</button>{/if}

<style>
  .wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font: 14px/1.5 Inter, sans-serif; }
  th { text-align: left; background: var(--surface); border-bottom: 1px solid var(--border); padding: 0; white-space: nowrap; }
  th button { all: unset; display: block; cursor: pointer; font: 700 11px/1.5 "Space Grotesk", sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); padding: 8px 16px 8px 8px; }
  th button:hover { color: var(--head); } th button:focus-visible { outline: 2px solid var(--primary); }
  td { border-bottom: 1px solid var(--border); padding: 12px 16px 12px 8px; vertical-align: top; color: var(--body); }
  .pct, .signed, .num, .wonof, .level, .tally, .ev { font-family: "JetBrains Mono", monospace; font-size: 13px; white-space: nowrap; }
  td.pct, td.signed, td.num, td.wonof { text-align: right; } th.pct button, th.signed button, th.num button, th.wonof button { text-align: right; }
  td.name { min-width: 240px; } .open, .title { color: var(--head); font-weight: 600; }
  td.name small { display: block; color: var(--body); font-size: 13px; max-width: 66ch; margin-top: 2px; }
  td.ev { text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: var(--muted); padding-top: 14px; }
  .strong { color: var(--head); font-weight: 600; } .n { color: var(--body); margin-left: 4px; }
  tr.clickable { cursor: pointer; } tr.clickable:hover td { background: var(--high); }
  .open { all: unset; cursor: pointer; color: var(--head); font-weight: 600; } .open:focus-visible { outline: 2px solid var(--primary); }
  .level { white-space: nowrap; } .level > span { display: inline-block; width: 96px; height: 8px; background: var(--high); vertical-align: middle; margin-right: 8px; } .level > span > span { display: block; height: 100%; background: var(--body); }
  .more { margin-top: 16px; }
</style>
