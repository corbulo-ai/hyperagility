<script>
  // "Use it from your agent": a dismissible banner plus the setup panel for the MCP server (mcp/server.mjs).
  import { onMount } from "svelte";
  let { open = $bindable(false) } = $props();
  const KEY = "ha-agent-banner-dismissed";
  const RUN = "npx -y github:corbulo-ai/hyperagility";
  const CLIENTS = [
    { id: "claude", name: "Claude Code", label: "Run in a terminal", code: `claude mcp add hyperagility -- ${RUN}` },
    { id: "codex", name: "Codex", label: "Run in a terminal", code: `codex mcp add hyperagility -- ${RUN}` },
    { id: "other", name: "Other clients", label: "Add to the client's MCP config (Cursor, VS Code, Windsurf and others)", code: JSON.stringify({ mcpServers: { hyperagility: { command: "npx", args: ["-y", "github:corbulo-ai/hyperagility"] } } }, null, 2) },
  ];
  const PROMPT = "Use hyperagility. Look at how this project's agent setup works and label its methods with HyperAgility's categories. Show how those methods did for our kind of task and model, check which reported failure modes we might share, and list the papers worth reading.";
  let dismissed = $state(true), tab = $state("claude"), copied = $state("");
  const client = $derived(CLIENTS.find((c) => c.id === tab));
  onMount(() => { try { dismissed = localStorage.getItem(KEY) === "1"; } catch (e) { dismissed = false; } });
  function dismiss() { dismissed = true; try { localStorage.setItem(KEY, "1"); } catch (e) {} }
  async function copy(id, text) { try { await navigator.clipboard.writeText(text); copied = id; setTimeout(() => (copied = ""), 1500); } catch (e) {} }
  function onkey(e) { if (e.key === "Escape") open = false; }
</script>

<svelte:window onkeydown={open ? onkey : undefined} />

{#if !dismissed && !open}
  <div class="banner">
    <p><strong>Use HyperAgility from your own agent.</strong> It can query these results, filters and papers directly.</p>
    <button class="btn go" onclick={() => (open = true)}>Show setup</button>
    <button class="hide" onclick={dismiss} aria-label="Hide this banner">×</button>
  </div>
{/if}

{#if open}
  <div class="veil" onclick={() => (open = false)} role="presentation"></div>
  <div class="dialog panel" role="dialog" aria-modal="true" aria-labelledby="agents-title">
    <button class="hide close" onclick={() => (open = false)} aria-label="Close">×</button>
    <h2 id="agents-title" class="section-label">Use HyperAgility from your agent</h2>
    <p>An MCP server gives your agent the same results as this site: methods ranked by task and model, head-to-head comparisons, costs, failure modes, and the papers behind every number.</p>
    <p>It runs on your machine and only reads. Your agent sends category names, so nothing about your own setup leaves it. Needs Node 20.19 or later.</p>
    <div class="tabs" role="tablist">{#each CLIENTS as c}<button class="tab" role="tab" aria-selected={tab === c.id} onclick={() => (tab = c.id)}>{c.name}</button>{/each}</div>
    <div class="label step">{client.label}</div>
    <div class="code"><pre class="mono">{client.code}</pre><button class="btn" onclick={() => copy("cmd", client.code)}>{copied === "cmd" ? "Copied" : "Copy"}</button></div>
    <div class="label step">Then ask your agent something like</div>
    <div class="code"><pre class="prose">{PROMPT}</pre><button class="btn" onclick={() => copy("prompt", PROMPT)}>{copied === "prompt" ? "Copied" : "Copy"}</button></div>
    <p class="note">Tools: <span class="mono">kg_overview, kg_vocabulary, kg_methods, kg_compare, kg_inspect, kg_papers, kg_failures</span>. Agents that only read pages can use <a href="/llms.txt">llms.txt</a>.</p>
  </div>
{/if}

<style>
  .banner { display: flex; align-items: center; gap: 16px; padding: 8px 32px; background: color-mix(in srgb, var(--primary) 12%, var(--surface)); border-bottom: 1px solid var(--border); }
  .banner p { flex: 1; color: var(--body); } .banner strong { color: var(--head); }
  .go { border-color: var(--primary); color: var(--primary); white-space: nowrap; padding: 6px 12px; }
  .hide { all: unset; cursor: pointer; font-size: 22px; line-height: 1; color: var(--muted); padding: 0 4px; } .hide:hover { color: var(--head); }
  .hide:focus-visible { outline: 2px solid var(--primary); }
  .veil { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 40; }
  .dialog { position: fixed; z-index: 41; top: 8vh; left: 50%; transform: translateX(-50%); width: min(680px, calc(100vw - 32px)); max-height: 84vh; overflow: auto; border-color: var(--strong); }
  .dialog p { margin-bottom: 12px; max-width: 66ch; }
  .close { position: absolute; top: 16px; right: 16px; }
  .tabs { margin-top: 16px; }
  .step { margin: 16px 0 8px; }
  .code { display: flex; align-items: flex-start; gap: 8px; background: var(--lowest); border: 1px solid var(--border); padding: 12px; }
  pre { flex: 1; min-width: 0; margin: 0; font-size: 13px; line-height: 1.5; color: var(--head); white-space: pre-wrap; overflow-wrap: anywhere; }
  .prose { font-family: inherit; color: var(--body); }
  .code .btn { padding: 4px 10px; white-space: nowrap; }
  .note { margin: 16px 0 0 !important; color: var(--muted); font-size: 12px; }
  @media (max-width: 800px) { .banner { padding: 8px 16px; gap: 8px; } }
</style>
