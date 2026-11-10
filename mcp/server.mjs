#!/usr/bin/env node
// MCP server for HyperAgility (hyperagility.org): the site's filters, numbers and evidence, for agents.
//   node mcp/server.mjs                 stdio (local agents: Claude Code, Cursor, …)
//   node mcp/server.mjs --http [port]   streamable HTTP at /mcp (default port 8787)
//   --host 0.0.0.0                      listen beyond localhost (when hosting it for other people)
import http from "node:http";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as core from "./core.mjs";

const INSTRUCTIONS = `HyperAgility (hyperagility.org): evidence from research on building LLM agents: which methods were compared on which tasks and models, how often each won, what they cost, how they fail, and the papers (with page and quote) behind every number. It is an index to the literature, not a verdict: use it to find what has been tested, then read the papers it points to. Start with kg_overview. To relate a real agent setup to it, label the setup's parts with categories from kg_vocabulary, then look those categories up with kg_methods / kg_compare / kg_inspect, check kg_failures for failure modes the setup may share, and use kg_papers to get the papers to read. Tools take category ids only; nothing about the setup needs to be sent. Always report paper counts and the evidence level with any number.`;

const scope = {
  task_type: z.string().optional().describe("Task type id (kg_vocabulary kind=task_types)"),
  task_family: z.string().optional().describe("Task family id, broader than task_type"),
  model_tier: z.enum(["frontier", "strong", "small"]).optional().describe("Size class of the model the method ran on"),
  model_lineage: z.string().optional().describe("Model lineage id (kg_vocabulary kind=model_lineages)"),
  lens: z.enum(["all", "independent", "matched"]).optional().describe("all = every result; independent = neither side is the paper's own proposed method; matched = same compute budget on both sides"),
  year_min: z.number().int().optional().describe("Only papers from this year on"),
};
const level = z.enum(core.LEVELS).optional().describe("What the options are: class = method classes (default), family = method families, known = named methods (ReAct, Reflexion…), ctx = context-management mechanisms, ma = multi-agent structures, roles = role assignment, persona = persona types");
const evidence_limit = z.number().int().min(0).max(40).optional().describe("How many quoted result rows to include (default 8)");

function build() {
  const server = new McpServer({ name: "hyperagility", version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const tool = (name, description, inputSchema, fn) =>
    server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } }, async (args) => {
      try { return { content: [{ type: "text", text: fn(args) }] }; }
      catch (e) { if (e instanceof core.Unknown) return { content: [{ type: "text", text: e.message }], isError: true }; throw e; }
    });

  tool("kg_overview", "What the graph contains, how to use these tools, how to read the numbers, and the known limits. Call first.", {}, () => core.overview());

  tool("kg_vocabulary", "The categories the graph uses, with definitions: use it to label the parts of a real setup so they can be looked up, and to get valid ids for the other tools.",
    { kind: z.enum(["methods", "method_families", "named_methods", "task_types", "facets", "failure_modes", "cost_dimensions", "model_lineages", "models"]).describe("methods = the method classes with definitions and what each includes/excludes; facets = context-management, multi-agent structure, role and persona values"),
      search: z.string().optional().describe("Filter by substring (needed for named_methods and models beyond the most common)") }, core.vocabulary);

  tool("kg_methods", "Table of the options tested under a scope (task, model, lens): papers, share of papers won and lost, typical difference, overall strength. The same ranking as the site's 'What works' page, with all-results, independent and same-budget counts side by side.",
    { ...scope, level, method_family: z.string().optional().describe("Only method classes in this family"), min_papers: z.number().int().min(1).optional().describe("Hide options with fewer papers (default 3)"),
      sort: z.enum(["site", "papers", "win"]).optional().describe("Default site: win rate discounted for small samples"), limit: z.number().int().min(1).max(200).optional().describe("Default 40") }, core.listMethods);

  tool("kg_compare", "Head-to-head between two options that papers compared directly: who won in how many papers, split by task and model size, the independent and same-budget checks, and the quoted results with sources.",
    { a: z.string().describe("Option id at the chosen level (`bare_model` = the model with no method)"), b: z.string(), level, ...scope, evidence_limit }, core.compare);

  tool("kg_inspect", "Everything the graph holds on one entity. method / method_family / named_method / facet: record against each alternative, by task and model, costs, failure modes, reported compute, papers, quoted results. task_type / task_family: methods ranked on it, benchmarks, failures. failure_mode: definition, affected methods and tasks, cases. cost_dimension: methods from most to least costly. model: like-for-like comparisons with other models. paper: methods, tasks, models, authors' conclusions, failures, limitations, results with quotes.",
    { kind: z.enum(["method", "method_family", "named_method", "facet", "task_type", "task_family", "failure_mode", "cost_dimension", "model", "paper"]),
      key: z.string().describe("Id of the entity; for paper, the 4-digit id shown in results or part of the title"), ...scope, evidence_limit }, core.inspectEntity);

  tool("kg_papers", "Find the papers to read: those with results matching a method, named method, facet, task, model or failure mode, with links, what each compares and on which benchmarks.",
    { method: z.string().optional().describe("Method class id"), method_family: z.string().optional(), named_method: z.string().optional(), facet: z.string().optional().describe("A facet value, e.g. summarization or hierarchical_orchestrator"),
      failure_mode: z.string().optional().describe("Failure mode id (FM..): only papers reporting it"), query: z.string().optional().describe("Substring of title or abstract"), ...scope,
      abstracts: z.boolean().optional().describe("Include abstracts"), limit: z.number().int().min(1).max(60).optional().describe("Default 15") }, core.findPapers);

  tool("kg_failures", "Failure modes papers report for a method class or family and/or a task, with definitions, counts, severity and the papers describing them. Use it as a checklist of failures a setup of that kind may share.",
    { method: z.string().optional().describe("Method class id"), method_family: z.string().optional(), task_type: scope.task_type, task_family: scope.task_family, year_min: scope.year_min }, core.failures);
  return server;
}

const argv = process.argv.slice(2), arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
await core.load();
if (!argv.includes("--http")) {
  await build().connect(new StdioServerTransport());
} else {
  const port = parseInt(arg("--http")) || parseInt(process.env.PORT) || 8787, host = arg("--host") || "127.0.0.1";
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, accept, mcp-protocol-version, mcp-session-id", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
  const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, ...cors }); res.end(body); };
  http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.method === "OPTIONS") return send(res, 204, "");
    if (url.pathname === "/mcp") {
      if (req.method !== "POST") return send(res, 405, JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server: POST only)" }, id: null }));
      try {
        const chunks = []; let size = 0;
        for await (const c of req) { size += c.length; if (size > 1e6) return send(res, 413, "{}"); chunks.push(c); }
        const server = build(), transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on("close", () => { transport.close(); server.close(); });
        for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);
        await server.connect(transport);
        await transport.handleRequest(req, res, JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) { console.error(e); if (!res.headersSent) send(res, 400, JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Bad request" }, id: null })); }
      return;
    }
    if (url.pathname === "/healthz") return send(res, 200, JSON.stringify({ ok: true, built: (await core.load()).built, data: core.source }));
    send(res, 404, "Not found", "text/plain");
  }).listen(port, host, () => console.error(`hyperagility: MCP endpoint http://${host}:${port}/mcp (${core.source} data)`));
}
