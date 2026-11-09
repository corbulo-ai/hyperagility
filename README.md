# Agent Design Knowledge Graph

An interactive map of what published research says about building LLM agents: which methods beat which, on what tasks and models, how they fail, and what they cost.

**Explore it:** https://hyperagility.org

Results from 571 papers (mostly 2024–2026) were extracted and mapped to shared categories so they can be compared side by side. Every number links back to its paper, page and quote.

| In the graph | Count |
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

- **All:** everything papers reported.
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

## Data

| File | Contents |
|---|---|
| [`public/papers.csv`](public/papers.csv) | Every paper: id, title, year, venue, link |
| [`public/kg.json.gz`](public/kg.json.gz) | The full graph the app loads: taxonomies, results, failures, costs and evidence |

Paper PDFs and full text are not included. Follow the links to read the papers at their source. `kg.json.gz` is a released snapshot; the extraction pipeline that produces it is not part of this repository.

## Run it locally

Requires Node 20.19 or later.

```sh
npm ci
npm run dev
```

`npm run build` writes a static site to `dist/` that can be served from any static host.

## Licenses

- **Code:** [MIT](LICENSE)
- **Data:** [CC BY 4.0](DATA-LICENSE.md), with exceptions for material that belongs to the original authors

## Corrections

If a result is wrong, or you are an author and want something changed or removed, please [open an issue](https://github.com/corbulo-ai/hyperagility/issues).
