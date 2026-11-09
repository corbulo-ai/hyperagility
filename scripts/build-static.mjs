// Runs after `vite build`. Most crawlers and AI fetchers do not execute JavaScript,
// so this writes the results into the HTML and generates the machine-readable files.
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { setKG, defaultFilters } from "../src/kg.js";
import { rankOptions, productGroups, failureRows, costRows } from "../src/rank.js";

const SITE = "https://hyperagility.org";
const REPO = "https://github.com/corbulo-ai/hyperagility";
const CREDIT = "Source: HyperAgility (hyperagility.org), based on results from the cited papers.";

const D = setKG(JSON.parse(gunzipSync(readFileSync("public/kg.json.gz")).toString()));
const F = defaultFilters();
const stats = D.stats, built = D.built;
const DESCRIPTION = `What ${stats.papers} research papers found about building LLM agents: which methods win, on which tasks and models, what they cost and how they fail.`;

const pct = (v) => Math.round(v * 100) + "%";
const signed = (v) => { const n = Math.round(v * 100); return (n >= 0 ? "+" : "-") + Math.abs(n) + "%"; };
const wonOf = (s) => (s.papers ? `${Math.round(s.win * s.papers)} of ${s.papers}` : "none");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

const mdTable = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)].join("\n");
const htmlTable = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

const methods = rankOptions(F, "class");
const families = rankOptions(F, "family");
const products = productGroups(F, "");
const methodHead = ["Method", "Won (all results)", "Won (independent tests)", "Won (same budget)", "Typical change"];
const methodRows = (rows) => rows.map((r) => [r.name, wonOf(r.all), wonOf(r.independent), wonOf(r.matched), signed(r.s.typical)]);
const lineHead = ["Product line", "Scored higher", "Typical change"];
const lineRows = (rows) => rows.map((r) => [r.name, wonOf(r.s), signed(r.s.typical)]);

const INTRO = `HyperAgility lines up the results from ${stats.papers} research papers on building LLM agents, so you can see which techniques beat the alternatives, on which tasks and models, what they cost, and how they fail.`;
const READING = [
  "Won means a method scored better than whatever that paper compared it against, on the same model, task and metric. Each paper counts once. Results within half a percent count as tied.",
  "Typical change is the median relative change in score across papers.",
  "Independent tests exclude papers introducing that method. Most published results come from papers testing their own new technique, so compare both columns.",
  "Many results rest on few papers. Treat anything under 5 papers as a lead, and check the source paper before relying on a specific result.",
];
const CREDIT_TEXT = `Please cite the original paper when using a specific result or quote, and respect its license. Please credit HyperAgility with a link when reusing the rankings, categories, statistics or data: "${CREDIT}" The data is CC BY 4.0, except paper titles, abstracts and quotes, which belong to their authors. The code is MIT.`;

// ---------- Markdown version of the page (llmstxt.org convention for URLs without a filename) ----------
const markdown = `# HyperAgility

> ${DESCRIPTION}

${INTRO} Data as of ${built}.

## How to read these results

${READING.map((r) => `- ${r}`).join("\n")}

## Methods, best supported first

${mdTable(methodHead, methodRows(methods))}

## Approach families

${mdTable(methodHead.map((h, i) => (i ? h : "Approach family")), methodRows(families))}

## Model product lines, within each maker

Each line against the same maker's other lines, only in experiments that ran both. Newer models tend to beat older ones.

${products.groups.map((g) => `### ${g.maker}\n\n${mdTable(lineHead, lineRows(g.rows))}`).join("\n\n")}

## Failure modes

${mdTable(["Failure", "Papers", "Cases"], failureRows().map((r) => [r.name, r.papers, r.cases]))}

## Costs

${mdTable(["Cost", "Papers", "Rated highest"], costRows().map((r) => [r.name, r.papers, r.costliest]))}

## Data

- [Paper list (CSV)](${SITE}/papers.csv)
- [Full data set (gzipped JSON)](${SITE}/kg.json.gz)

## License and credit

${CREDIT_TEXT}
`;
writeFileSync("dist/index.html.md", markdown);

// ---------- llms.txt (https://llmstxt.org) ----------
writeFileSync("dist/llms.txt", `# HyperAgility

> ${DESCRIPTION}

Results are compared only within the same paper, model, task and metric, and each paper counts once. Most published results come from papers testing their own new technique, so independent-test figures are given alongside all results. Many results rest on few papers, so report paper counts when citing a finding. Data as of ${built}.

${CREDIT_TEXT}

## Results

- [All results in Markdown](${SITE}/index.html.md): Rankings of methods, approach families and model product lines, with paper counts, plus failure modes and costs
- [Interactive site](${SITE}/): Filter by task and model, and open the evidence behind any number

## Data

- [Paper list](${SITE}/papers.csv): CSV with id, title, year, venue and link for all ${stats.papers} papers
- [Full data set](${SITE}/kg.json.gz): Gzipped JSON with categories, comparisons, failures, costs and source quotes

## Optional

- [Data license](${REPO}/blob/main/DATA-LICENSE.md): What is covered, and how to credit it
- [Source code](${REPO}): MIT-licensed code for this site
`);

// ---------- sitemap ----------
writeFileSync("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${built}</lastmod></url>
</urlset>
`);

// ---------- results in the HTML, and Dataset structured data ----------
const staticHtml = `<main id="static">
<h1>Which ways of building AI agents actually work?</h1>
<p>${esc(INTRO)} Data as of ${esc(built)}. <a href="/index.html.md">Read these results as Markdown</a>.</p>
<h2>How to read these results</h2>
<ul>${READING.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
<h2>Methods, best supported first</h2>
${htmlTable(methodHead, methodRows(methods))}
<h2>Model product lines, within each maker</h2>
<p>Each line against the same maker's other lines, only in experiments that ran both.</p>
${products.groups.map((g) => `<h3>${esc(g.maker)}</h3>${htmlTable(lineHead, lineRows(g.rows))}`).join("\n")}
<h2>Data</h2>
<ul><li><a href="/papers.csv">Paper list (CSV)</a></li><li><a href="/kg.json.gz">Full data set (gzipped JSON)</a></li></ul>
<h2>License and credit</h2>
<p>${esc(CREDIT_TEXT)}</p>
<p>Built by <a href="https://corbulo.dev">Corbulo</a>.</p>
</main>`;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "HyperAgility: what works in LLM agent design",
  description: `${DESCRIPTION} Covers ${stats.cmp.toLocaleString("en-US")} method-versus-method results and ${stats.mp.toLocaleString("en-US")} model-versus-model results, each linked to its source paper.`,
  url: `${SITE}/`,
  sameAs: REPO,
  keywords: ["LLM agents", "agent design", "benchmarks", "AI agents", "evidence synthesis"],
  license: "https://creativecommons.org/licenses/by/4.0/",
  isAccessibleForFree: true,
  dateModified: built,
  creator: { "@type": "Organization", name: "Corbulo", url: "https://corbulo.dev" },
  distribution: [
    { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${SITE}/papers.csv` },
    { "@type": "DataDownload", encodingFormat: "application/gzip", contentUrl: `${SITE}/kg.json.gz` },
  ],
};

let html = readFileSync("dist/index.html", "utf8");
html = html.replace(/\b571 research papers/g, `${stats.papers} research papers`);
for (const marker of ['<div id="app"></div>', "</head>"]) if (!html.includes(marker)) throw new Error(`Missing ${marker} in dist/index.html`);
html = html.replace('<div id="app"></div>', () => `<div id="app"></div>\n${staticHtml}`);
html = html.replace("</head>", () => `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n</head>`);
writeFileSync("dist/index.html", html);

console.log(`static: ${methods.length} methods, ${products.groups.length} makers, index.html.md ${markdown.length} chars`);
