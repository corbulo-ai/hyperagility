<script>
  let { sections = [], onnav, onback, onfwd, canBack = false, canFwd = false } = $props();
  const pct = (v) => (v >= 0 ? "+" : "") + Math.round(v * 100) + "%";
  let evLimit = $state(25);
  let openQuote = $state({});
  $effect(() => { sections; evLimit = 25; openQuote = {}; });
  function barStyle(it, sec) {
    if (sec.unsigned) { const max = sec.scale || 1; return `left:0;width:${Math.max(2, 100 * Math.min(1, it.value / max))}%;background:var(--acc)`; }
    const v = Math.max(-1, Math.min(1, it.value));
    return v >= 0 ? `left:50%;width:${50 * v}%;background:var(--good)` : `left:${50 + 50 * v}%;width:${-50 * v}%;background:var(--bad)`;
  }
</script>

<div class="insp">
  <div class="navrow">
    <button class="ghost" disabled={!canBack} onclick={onback} title="Back">←</button>
    <button class="ghost" disabled={!canFwd} onclick={onfwd} title="Forward">→</button>
  </div>
  {#if !sections || !sections.length}
    <div class="empty">
      <h3>Click anything</h3>
      <p>Click a node or an edge in the graph, or search above. Every number here links to the papers, results and quotes behind it, and every name is clickable so you can keep exploring.</p>
    </div>
  {:else}
    {#each sections as sec, si (si)}
      {#if sec.type === "header"}
        <div class="hdr">
          <div class="sub">{sec.subtitle}{#if sec.nav} · <a href="#" onclick={(e) => { e.preventDefault(); onnav(sec.nav); }}>open parent</a>{/if}</div>
          <h2>{sec.title}</h2>
          {#if sec.text}<p class="def">{sec.text}</p>{/if}
          {#if sec.link}<a href={sec.link} target="_blank" rel="noopener">Open paper ↗</a>{/if}
        </div>
      {:else if sec.type === "text"}
        <div class="sec"><h4>{sec.title}</h4><p class="small">{sec.text}</p></div>
      {:else if sec.type === "kpis"}
        {#if sec.items.length}
        <div class="sec">
          {#if sec.title}<h4>{sec.title}</h4>{/if}
          <div class="kpis">{#each sec.items as k}<div class="kpi"><b>{k.value}</b><span>{k.label}</span>{#if k.note}<i>{k.note}</i>{/if}</div>{/each}</div>
        </div>
        {/if}
      {:else if sec.type === "bars"}
        {#if sec.items.length}
        <div class="sec">
          <h4>{sec.title}</h4>{#if sec.hint}<p class="hint">{sec.hint}</p>{/if}
          {#each sec.items as it}
            <button class="barrow" onclick={() => it.nav && onnav(it.nav)} disabled={!it.nav}>
              <span class="bl">{it.label}</span>
              <span class="track">{#if !sec.unsigned}<span class="mid"></span>{/if}<span class="fill" style={barStyle(it, sec)}></span></span>
              <span class="bd">{it.display}</span>
            </button>
          {/each}
        </div>
        {/if}
      {:else if sec.type === "list"}
        {#if sec.items.length}
        <div class="sec">
          <h4>{sec.title}</h4>
          {#each sec.items as it}
            <button class="li" onclick={() => it.nav && onnav(it.nav)} disabled={!it.nav}><span>{it.label}</span>{#if it.sub}<small>{it.sub}</small>{/if}</button>
          {/each}
        </div>
        {/if}
      {:else if sec.type === "chips"}
        {#if sec.items.length}
        <div class="sec"><h4>{sec.title}</h4><div class="chips">{#each sec.items as c}<button class="chip" onclick={() => c.nav && onnav(c.nav)} disabled={!c.nav}>{c.label}</button>{/each}</div></div>
        {/if}
      {:else if sec.type === "evidence"}
        {#if sec.items.length}
        <div class="sec">
          <h4>{sec.title} <small>({sec.items.length}{sec.items.length >= 120 ? "+" : ""})</small></h4>
          {#each sec.items.slice(0, evLimit) as ev, ei}
            <div class="ev">
              <div class="evh"><span class="res {ev.won ? 'win' : ev.lost ? 'lose' : 'tie'}">{ev.won ? "won" : ev.lost ? "lost" : "tie"} {pct(ev.d)}</span> <b>{ev.head}</b></div>
              <div class="small">{ev.sub}{#if ev.values} · <span class="mono">{ev.values}</span>{/if}{#if ev.cls} · <i>{ev.cls}</i>{/if}</div>
              {#if ev.flags?.length}<div class="flags">{#each ev.flags as f}<span>{f}</span>{/each}</div>{/if}
              {#if ev.quote}
                <button class="qbtn" onclick={() => (openQuote = { ...openQuote, [ei]: !openQuote[ei] })}>{openQuote[ei] ? "hide quote" : "show quote"}{ev.page ? ` · p.${ev.page}` : ""}</button>
                {#if openQuote[ei]}<blockquote>“{ev.quote}”</blockquote>{/if}
              {/if}
              <div class="small"><a href="#" onclick={(e) => { e.preventDefault(); onnav({ kind: "paper", key: ev.paper.i }); }}>{ev.paper.title}</a> ({ev.paper.year}) {#if ev.paper.url}<a href={ev.paper.url} target="_blank" rel="noopener">↗</a>{/if}</div>
            </div>
          {/each}
          {#if sec.items.length > evLimit}<button class="more" onclick={() => (evLimit += 25)}>Show more</button>{/if}
        </div>
        {/if}
      {/if}
    {/each}
  {/if}
</div>

<style>
  .insp { padding: 14px 16px 40px; }
  .navrow { display: flex; gap: 6px; margin-bottom: 6px; }
  .ghost { font: inherit; background: none; border: 1px solid var(--line); color: var(--fg); border-radius: 6px; padding: 2px 9px; cursor: pointer; }
  .ghost:disabled { opacity: .35; cursor: default; }
  .empty { color: var(--mut); padding: 30px 6px; } .empty h3 { color: var(--fg); margin: 0 0 6px; }
  .hdr h2 { margin: 2px 0 6px; font-size: 19px; line-height: 1.3; } .hdr .sub { font-size: 12px; color: var(--mut); text-transform: uppercase; letter-spacing: .04em; }
  .def { color: var(--mut); font-size: 14px; margin: 0 0 8px; }
  .sec { margin-top: 18px; } h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--mut); } h4 small { text-transform: none; }
  .hint { font-size: 12px; color: var(--mut); margin: -2px 0 6px; } .small { font-size: 13px; color: var(--mut); }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
  .kpi { background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; }
  .kpi b { font-size: 18px; } .kpi span { font-size: 12px; } .kpi i { font-size: 11px; color: var(--mut); font-style: normal; }
  .barrow { all: unset; display: grid; grid-template-columns: minmax(110px, 1.2fr) 1fr auto; gap: 8px; align-items: center; width: 100%; padding: 4px 4px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .barrow:hover:not(:disabled) { background: var(--bg2); } .barrow:disabled { cursor: default; }
  .bl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .bd { color: var(--mut); font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .track { position: relative; height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; } .fill { position: absolute; top: 0; bottom: 0; border-radius: 4px; }
  .mid { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--mut); opacity: .6; }
  .li { all: unset; display: flex; flex-direction: column; padding: 6px 6px; border-radius: 6px; cursor: pointer; font-size: 14px; width: calc(100% - 12px); }
  .li:hover:not(:disabled) { background: var(--bg2); } .li:disabled { cursor: default; } .li small { color: var(--mut); font-size: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .chip { font: inherit; font-size: 12px; border: 1px solid var(--line); background: var(--bg2); color: var(--fg); border-radius: 99px; padding: 2px 9px; cursor: pointer; } .chip:disabled { cursor: default; opacity: .8; }
  .ev { border-top: 1px solid var(--line); padding: 9px 0; font-size: 14px; } .evh b { font-weight: 600; }
  .res { font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; } .win { background: rgba(46,160,90,.18); color: var(--good); } .lose { background: rgba(210,70,70,.18); color: var(--bad); } .tie { background: var(--line); color: var(--mut); }
  .flags { display: flex; gap: 5px; margin: 3px 0; } .flags span { font-size: 11px; color: var(--mut); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
  .qbtn { all: unset; font-size: 12px; color: var(--acc); cursor: pointer; } blockquote { margin: 4px 0; padding: 4px 10px; border-left: 3px solid var(--line); color: var(--mut); font-size: 13px; font-style: italic; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .more { font: inherit; margin-top: 8px; border: 1px solid var(--line); background: var(--bg2); color: var(--fg); border-radius: 8px; padding: 5px 12px; cursor: pointer; }
  a { color: var(--acc); }
</style>
