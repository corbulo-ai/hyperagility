<script>
  import DataTable from "./DataTable.svelte";
  const REPO = "https://github.com/corbulo-ai/hyperagility";
  const columns = [
    { id: "part", label: "What you are using", type: "name", get: (r) => r.part },
    { id: "license", label: "License", type: "text", get: (r) => r.license },
    { id: "ask", label: "What to do", type: "text", get: (r) => r.ask },
  ];
  const rows = [
    { part: "Paper titles, abstracts and quotes", license: "Belong to the original authors", ask: "Cite the paper and follow its license" },
    { part: "Rankings, categories, statistics and structured data", license: "CC BY 4.0", ask: "Credit HyperAgility with a link" },
    { part: "Website source code", license: "MIT", ask: "Keep the license notice" },
    { part: "Paper PDFs and full text", license: "Not distributed here", ask: "Read them at the source" },
  ];
</script>

<header>
  <h1>License and credit</h1>
  <p>HyperAgility is free to use and build on. It exists because of the researchers who ran these experiments, so please credit them as well as this site.</p>
</header>

<div class="cards">
  <article class="panel">
    <h2>Credit the original authors</h2>
    <p>The findings, titles and quotes here come from the papers' authors. If you use a specific result or quote, cite the original paper and respect its license. Every result links back to its source.</p>
  </article>
  <article class="panel">
    <h2>Credit HyperAgility</h2>
    <p>If you reuse the rankings, categories, statistics or data set, credit this site with a link. You can use this wording:</p>
    <blockquote>Source: HyperAgility (hyperagility.org), based on results from the cited papers.</blockquote>
  </article>
</div>

<section class="section">
  <h2 class="section-label">What each license covers</h2>
  <div class="panel flush"><DataTable {columns} {rows} /></div>
  <p class="links">Read the full <a href="{REPO}/blob/main/DATA-LICENSE.md" target="_blank" rel="noopener">data license</a> and <a href="{REPO}/blob/main/LICENSE" target="_blank" rel="noopener">code license</a>.</p>
</section>

<section class="section">
  <h2 class="section-label">Corrections and removals</h2>
  <p class="prose">If a result is wrong, or you are an author and want something changed or removed, <a href="{REPO}/issues" target="_blank" rel="noopener">open an issue</a>.</p>
</section>

<style>
  h1 { font-size: clamp(2rem, 3.6vw, 3rem); line-height: 1.05; font-weight: 700; letter-spacing: -0.02em; }
  header p { max-width: 66ch; margin-top: 12px; font-size: 1.125rem; }
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 32px; }
  article { padding: 32px; }
  article h2 { font-size: 1.625rem; line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 16px; }
  article p { font-size: 1rem; max-width: 60ch; }
  blockquote { margin: 16px 0 0; padding-left: 16px; border-left: 2px solid var(--primary); color: var(--head); font-size: 1rem; }
  .flush { padding: 8px; } .links { margin-top: 16px; } .prose { max-width: 66ch; }
  @media (max-width: 900px) { .cards { grid-template-columns: 1fr; } }
</style>
