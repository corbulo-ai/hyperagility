<script>
  // One unit per paper, ordered won, tied, lost, so the length is the sample size.
  // Large tiles carry color; table strips stay neutral so color remains scarce.
  let { s, large = false, unit = 8 } = $props();
  const won = $derived(Math.round(s.win * s.papers));
  const lost = $derived(Math.round(s.loss * s.papers));
  const tied = $derived(s.papers - won - lost);
  const label = $derived(`${s.papers} ${s.papers === 1 ? "paper" : "papers"}: ${won} won, ${tied} tied, ${lost} lost`);
  const size = $derived(s.papers > 150 ? "tiny" : s.papers > 60 ? "small" : "");
</script>

{#if large}
  <div class="tiles {size}" role="img" aria-label={label}>
    {#each { length: won } as _}<i class="won"></i>{/each}{#each { length: tied } as _}<i class="tied"></i>{/each}{#each { length: lost } as _}<i class="lost"></i>{/each}
  </div>
  <p class="key mono"><span><i class="dot won"></i>{won} won</span><span><i class="dot tied"></i>{tied} tied</span><span><i class="dot lost"></i>{lost} lost</span></p>
{:else}
  <span class="strip" role="img" aria-label={label} title={label} style="--u:{unit}px">{#if won}<b class="s-won" style="width:{won * unit}px"></b>{/if}{#if tied}<b class="s-tied" style="width:{tied * unit}px"></b>{/if}{#if lost}<b class="s-lost" style="width:{lost * unit}px"></b>{/if}</span>
{/if}

<style>
  .tiles { display: flex; flex-wrap: wrap; gap: 4px; }
  .tiles i { width: 24px; height: 32px; }
  .tiles.small { gap: 3px; } .tiles.small i { width: 14px; height: 24px; }
  .tiles.tiny { gap: 2px; } .tiles.tiny i { width: 8px; height: 16px; }
  .won { background: var(--good); } .tied { background: var(--muted); } .lost { background: var(--bad); }
  .key { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; font-size: 12px; color: var(--body); }
  .key span { display: inline-flex; align-items: center; gap: 8px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .strip { display: inline-flex; height: 12px; vertical-align: -1px; }
  .strip b { height: 100%; -webkit-mask: repeating-linear-gradient(to right, #000 0 calc(var(--u) - 1px), transparent calc(var(--u) - 1px) var(--u)); mask: repeating-linear-gradient(to right, #000 0 calc(var(--u) - 1px), transparent calc(var(--u) - 1px) var(--u)); }
  .s-won { background: var(--body); } .s-tied { background: var(--muted); } .s-lost { background: var(--strip-lost); }
</style>
