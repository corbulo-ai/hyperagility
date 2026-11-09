<script>
  import { D, linName, defaultFilters } from "./kg.js";
  import { LENSES } from "./rank.js";
  let { F = $bindable() } = $props();
  const NON_TASK = "non_task_entry";
  const nonTaskFamily = D.tax.task_type[NON_TASK]?.family;
  const families = Object.entries(D.tax.task_family).filter(([k]) => k !== nonTaskFamily);
  const taskTypes = $derived(Object.entries(D.tax.task_type).filter(([k, v]) => k !== NON_TASK && (!F.tf || v.family === F.tf)));
  const lineages = (D.dict.lin || []).filter((x) => x && !["other", "unknown", "n/a"].includes(x)).sort((a, b) => linName(a).localeCompare(linName(b)));
  const lens = $derived(LENSES.find((l) => l.id === F.lens));
  const changed = $derived(Boolean(F.tf || F.tt || F.tier || F.lin || F.yearMin || F.lens !== "all"));
</script>

<div class="grid">
  <label class="field"><span class="label">Task</span><select bind:value={F.tf} onchange={() => (F.tt = "")}><option value="">All tasks</option>{#each families as [k, v]}<option value={k}>{v.name}</option>{/each}</select></label>
  <label class="field"><span class="label">Task type</span><select bind:value={F.tt}><option value="">All task types</option>{#each taskTypes as [k, v]}<option value={k}>{v.name}</option>{/each}</select></label>
  <label class="field"><span class="label">Model size</span><select bind:value={F.tier}><option value="">Any size</option><option value="frontier">Frontier</option><option value="strong">Strong or mid-size</option><option value="small">Small</option></select></label>
  <label class="field"><span class="label">Model family</span><select bind:value={F.lin}><option value="">Any family</option>{#each lineages as l}<option value={l}>{linName(l)}</option>{/each}</select></label>
  <label class="field"><span class="label">Papers from</span><select bind:value={F.yearMin}><option value={0}>Any year</option><option value={2024}>2024 or later</option><option value={2025}>2025 or later</option><option value={2026}>2026</option></select></label>
</div>
<div class="lens">
  <span class="label">Results that count</span>
  <div class="pills">{#each LENSES as l}<button class="pill" aria-pressed={F.lens === l.id} onclick={() => (F.lens = l.id)}>{l.label}</button>{/each}</div>
  <span class="help">{lens.help}</span>
  {#if changed}<button class="clear" onclick={() => (F = defaultFilters())}>Clear filters</button>{/if}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
  .lens { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 16px; }
  .help { color: var(--body); }
  .clear { all: unset; cursor: pointer; color: var(--primary); text-decoration: underline; margin-left: auto; }
  .clear:focus-visible { outline: 2px solid var(--primary); }
</style>
