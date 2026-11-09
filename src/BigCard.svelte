<script>
  import Tally from "./Tally.svelte";
  import { confidence } from "./kg.js";
  import { optionExtras, LENSES, LEVELS } from "./rank.js";
  let { r, level, lens, rank, total, lead = false, onopen } = $props();
  const extras = $derived(optionExtras(r.key, level));
  const won = $derived(Math.round(r.s.win * r.s.papers));
  const lost = $derived(Math.round(r.s.loss * r.s.papers));
  const lensName = $derived(LENSES.find((l) => l.id === lens).short);
  const one = $derived(LEVELS.find((l) => l.id === level).one);
  const levelName = $derived(LEVELS.find((l) => l.id === level).name);
  const pct = (v) => Math.round(v * 100) + "%";
  const count = (s) => `${Math.round(s.win * s.papers)} of ${s.papers}`;
  const change = $derived(r.s.typical >= 0 ? `improved by about ${pct(r.s.typical)}` : `dropped by about ${pct(-r.s.typical)}`);
  const checks = $derived([
    ["All results", r.all, "Everything papers reported"],
    ["Independent", r.independent, "Not the paper's own method"],
    ["Same budget", r.matched, "Both sides got equal compute"],
  ]);
</script>

<article class="panel" class:lead>
  <p class="label">Ranked {rank} of {total} {levelName}</p>
  <h3><button onclick={() => onopen(r.nav)}>{r.name}</button></h3>
  {#if extras.def}<p class="def">{extras.def}</p>{/if}

  <p class="score mono">Won {won} of {r.s.papers} papers</p>
  <Tally s={r.s} large />
  <p class="story">
    In {won} of the {r.s.papers} {lensName} papers that tested it, this scored better than what it was compared against, and in {lost} it scored worse.
    In a typical paper the score {change}. {confidence(r.s.papers) === "solid" ? "With 10 or more papers, this is the strongest level of evidence here." : "With fewer than 10 papers, treat this as a lead rather than a conclusion."}
  </p>
  {#if r.vsBare.papers && r.vsOther.papers}
    <p class="story">Against a plain model with nothing added, it won {count(r.vsBare)} papers. Against other methods, which is the harder test, it won {count(r.vsOther)}.</p>
  {/if}

  <div class="holds">
    <h4 class="label">Does it hold up?</h4>
    <dl>
      {#each checks as [label, s, note]}
        <div><dt>{label}</dt><dd class="mono">{#if s.papers}<b>{pct(s.win)}</b> of {s.papers} papers{:else}No papers{/if}</dd><dd class="note">{note}</dd></div>
      {/each}
    </dl>
  </div>

  {#if extras.costs.length}<p class="story">Its main costs are {extras.costs.map((c) => c.name.toLowerCase()).join(" and ")}.</p>{/if}
  {#if extras.fails.length}<p class="story">Papers most often report these problems: {extras.fails.map((f) => f.name.toLowerCase()).join("; ")}.</p>{/if}
  <button class="btn" onclick={() => onopen(r.nav)}>See everything on this {one}</button>
</article>

<style>
  article { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; padding: 32px; }
  h3 { font-size: 1.25rem; line-height: 1.15; letter-spacing: -0.02em; font-weight: 700; margin: 0; }
  h3 button { all: unset; cursor: pointer; } h3 button:hover { color: var(--primary-hover); } h3 button:focus-visible { outline: 2px solid var(--primary); }
  .lead h3 { font-size: 1.625rem; line-height: 1.15; }
  .def, .story { max-width: 66ch; font-size: 1rem; }
  .score { font-size: 1.5rem; font-weight: 700; color: var(--head); } .lead .score { font-size: 2rem; }
  .holds { width: 100%; padding-top: 16px; border-top: 1px solid var(--border); }
  h4 { margin: 0 0 8px; }
  dl { display: flex; flex-wrap: wrap; gap: 16px 48px; margin: 0; }
  dt { color: var(--head); font-weight: 600; }
  dd { margin: 2px 0 0; } dd b { color: var(--head); font-size: 1.25rem; } .note { font-size: 13px; }
</style>
