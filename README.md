# HyperAgility

An interactive map of what published research says about building LLM agents: which methods beat which, on what tasks and models, how they fail, and what they cost.

**Explore it:** https://hyperagility.org

Results from 571 papers (mostly 2024–2026) were extracted and mapped to shared categories so they can be compared side by side. Every number links back to its paper, page and quote.

| In the data | Count |
|---|---|
| Papers | 571 |
| Method-vs-method results | 29,353 |
| Model-vs-model results | 23,679 |
| Failure cases | 2,245 |
| Cost ratings | 9,208 |
| Token / $ measurements | 2,047 |
| Author conclusions | 2,971 |

## How to read it

Two numbers are compared only when they come from the same paper, model, task and metric. Those comparisons are pooled across papers, and each paper counts once however many results it reports.

The "Which results count" filter changes the evidence used:

- **All results:** everything papers reported. This is the default.
- **Independent:** only comparisons where neither side is the paper's own new method.
- **Same budget:** only comparisons where both sides had the same compute.

Rankings that hold under all three are the most trustworthy.

## Known limits

- Papers choose their own baselines, and many links rest on a handful of papers. Paper counts are shown throughout.
- Categories were assigned by an LLM and checked against an independent re-labelling, with about 90% agreement for methods and tasks.
- Failure-mode labels are less reliable, at about 76% agreement at group level.
- Cost levels are partly inferred from method descriptions.
- About 300 more papers are still being added.

Treat this as a guide to the literature, and check the source paper before relying on a specific result.

## Use it from your agent

An MCP server lets a coding agent query the same results as the site: methods ranked by task and model, head-to-head comparisons, costs, failure modes, and the papers behind each number. It runs locally, only reads, and takes category names, so nothing about your own setup is sent anywhere. Requires Node 20.19 or later.

```sh
claude mcp add hyperagility -- npx -y github:corbulo-ai/hyperagility   # Claude Code
codex mcp add hyperagility -- npx -y github:corbulo-ai/hyperagility    # Codex
```

For other clients, add this to the MCP config:

```json
{ "mcpServers": { "hyperagility": { "command": "npx", "args": ["-y", "github:corbulo-ai/hyperagility"] } } }
```

Then ask the agent to label the methods in your setup with HyperAgility's categories, look up how they did for your task and model, check which reported failure modes you share, and list the papers to read.

| Tool | Returns |
|---|---|
| `kg_overview` | What the data holds, how to use the tools and read the numbers, known limits |
| `kg_vocabulary` | Methods, named systems, task types, design facets, failure modes and models, with definitions |
| `kg_methods` | The "What works" ranking under a task, model, lens or year filter |
| `kg_compare` | Two options head-to-head, by task and model size, with quoted results |
| `kg_inspect` | One method, facet, task, failure mode, cost, model or paper in full |
| `kg_papers` | Papers matching a method, task, model or failure mode, with links |
| `kg_failures` | Failure modes reported for a method or task, with definitions and papers |

The server uses the site's own code (`src/kg.js`, `src/inspect.js`, `src/rank.js`), so its numbers match the site. On start it loads the data the site is currently serving and falls back to the snapshot in this repository; set `HYPERAGILITY_OFFLINE=1` to skip the download. `node mcp/server.mjs --http 8787` serves it over HTTP at `/mcp` instead of stdio.

## Data

| File | Contents |
|---|---|
| [`public/papers.csv`](public/papers.csv) | Every paper: id, title, year, venue, link |
| [`public/kg.json.gz`](public/kg.json.gz) | The full data set the app loads: categories, results, failures, costs and evidence |

Paper PDFs and full text are not included. Follow the links to read the papers at their source. `kg.json.gz` is a released snapshot; the extraction pipeline that produces it is not part of this repository.

## Run it locally

Requires Node 20.19 or later.

```sh
npm ci
npm run dev
```

`npm run build` writes a static site to `dist/` that can be served from any static host.

## License and credit

Please credit both the original paper authors and this site. If you use a specific result or quote, cite the original paper and respect its license. If you reuse the rankings, categories, statistics or data set, credit HyperAgility with a link:

> Source: HyperAgility (hyperagility.org), based on results from the cited papers.

- **Code:** [MIT](LICENSE)
- **Data:** [CC BY 4.0](DATA-LICENSE.md), with exceptions for material that belongs to the original authors

Built by Corbulo.

## Corrections

If a result is wrong, or you are an author and want something changed or removed, please [open an issue](https://github.com/corbulo-ai/hyperagility/issues).
