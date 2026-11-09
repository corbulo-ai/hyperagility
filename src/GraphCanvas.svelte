<script>
  import Graph from "graphology";
  import Sigma from "sigma";
  import { EdgeArrowProgram, EdgeRectangleProgram } from "sigma/rendering";
  import EdgeCurveProgram, { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
  import forceAtlas2 from "graphology-layout-forceatlas2";
  import { circular } from "graphology-layout";

  let { data, selectedId = null, focusIds = null, onselect, dark = true, curved = true } = $props();
  let container;
  let sigma = null;
  let graph = null;
  let hovered = $state(null);

  function build(d) {
    if (sigma) { sigma.kill(); sigma = null; }
    graph = new Graph({ type: d.directed ? "directed" : "undirected", multi: false });
    for (const n of d.nodes) if (!graph.hasNode(n.id)) graph.addNode(n.id, { label: n.label, size: n.size, color: n.color, kind: n.kind, meta: n.meta });
    for (const e of d.edges) {
      if (!graph.hasNode(e.source) || !graph.hasNode(e.target) || e.source === e.target) continue;
      if (graph.hasEdge(e.source, e.target)) continue;
      graph.addEdgeWithKey(e.id, e.source, e.target, { size: e.size, color: e.color, kind: e.kind, meta: e.meta, weight: (e.meta && e.meta.s && e.meta.s.papers) || e.meta?.n || 1,
        type: d.directed ? (curved ? "curvedArrow" : "arrow") : (curved ? "curve" : "line") });
    }
    if (graph.order === 0) return;
    circular.assign(graph, { scale: 100 });
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, { iterations: graph.order > 400 ? 250 : 400, getEdgeWeight: "weight",
      settings: { ...settings, gravity: graph.order > 300 ? 1 : 0.6, scalingRatio: graph.order > 300 ? 6 : 14, strongGravityMode: true, barnesHutOptimize: graph.order > 300, adjustSizes: false, linLogMode: false, outboundAttractionDistribution: true } });
    sigma = new Sigma(graph, container, {
      renderEdgeLabels: false, enableEdgeEvents: true, allowInvalidContainer: true,
      defaultEdgeType: d.directed ? "arrow" : "line",
      edgeProgramClasses: { arrow: EdgeArrowProgram, line: EdgeRectangleProgram, curve: EdgeCurveProgram, curvedArrow: EdgeCurvedArrowProgram },
      labelColor: { color: dark ? "#e8e6e1" : "#2a2a28" }, labelSize: 12, labelWeight: "500", labelDensity: 0.9, labelGridCellSize: 70,
      labelRenderedSizeThreshold: graph.order > 300 ? 9 : 4, zIndex: true, minCameraRatio: 0.05, maxCameraRatio: 4,
      nodeReducer: (node, attr) => reduceNode(node, attr), edgeReducer: (edge, attr) => reduceEdge(edge, attr),
      defaultDrawNodeHover: drawHover,
    });
    sigma.on("enterNode", ({ node }) => { hovered = node; sigma.refresh({ skipIndexation: true }); container.style.cursor = "pointer"; });
    sigma.on("leaveNode", () => { hovered = null; sigma.refresh({ skipIndexation: true }); container.style.cursor = ""; });
    sigma.on("enterEdge", () => (container.style.cursor = "pointer"));
    sigma.on("leaveEdge", () => (container.style.cursor = ""));
    sigma.on("clickNode", ({ node }) => onselect?.({ type: "node", id: node, kind: graph.getNodeAttribute(node, "kind"), meta: graph.getNodeAttribute(node, "meta") }));
    sigma.on("clickEdge", ({ edge }) => onselect?.({ type: "edge", id: edge, kind: graph.getEdgeAttribute(edge, "kind"), meta: graph.getEdgeAttribute(edge, "meta") }));
    sigma.on("clickStage", () => onselect?.(null));
    if (selectedId) setTimeout(() => zoomTo(selectedId, false), 30);
  }
  function drawHover(ctx, data, settings) {
    const size = settings.labelSize, font = settings.labelFont, weight = settings.labelWeight;
    ctx.font = `${weight} ${size}px ${font}`;
    const label = data.label || ""; const w = ctx.measureText(label).width, pad = 5, h = size + pad * 2;
    const x = data.x, y = data.y, r = data.size;
    ctx.fillStyle = dark ? "#202020" : "#ffffff"; ctx.strokeStyle = dark ? "#555" : "#ccc"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (label) { ctx.beginPath(); ctx.roundRect(x + r + 4, y - h / 2, w + pad * 2, h, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark ? "#f0efea" : "#1c1c1a"; ctx.fillText(label, x + r + 4 + pad, y + size / 3); }
    ctx.fillStyle = data.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function activeNode() { return hovered || (selectedId && graph?.hasNode(selectedId) ? selectedId : null); }
  function reduceNode(node, attr) {
    const a = activeNode(); const res = { ...attr };
    if (focusIds && focusIds.size && !focusIds.has(node)) { res.color = dark ? "#3a3a38" : "#dcd9d2"; res.label = ""; res.zIndex = 0; return res; }
    if (a) {
      if (node === a) { res.highlighted = true; res.zIndex = 2; }
      else if (graph.areNeighbors(node, a)) { res.zIndex = 1; }
      else { res.color = dark ? "#353533" : "#e2dfd8"; res.label = ""; res.zIndex = 0; }
    }
    if (selectedId === node) { res.highlighted = true; res.zIndex = 3; }
    return res;
  }
  function reduceEdge(edge, attr) {
    const a = activeNode(); const res = { ...attr };
    if (selectedId === edge) { res.size = (attr.size || 1) * 2 + 1; res.zIndex = 3; return res; }
    if (a && !graph.extremities(edge).includes(a)) res.hidden = true;
    if (focusIds && focusIds.size && !graph.extremities(edge).every((n) => focusIds.has(n))) res.hidden = true;
    return res;
  }
  $effect(() => { const d = data; const dk = dark; const cv = curved; build(d); return () => { if (sigma) { sigma.kill(); sigma = null; } }; });
  $effect(() => { const s = selectedId; const f = focusIds; if (sigma) sigma.refresh({ skipIndexation: true }); });
  export function zoomTo(id, zoom = false) {
    if (!sigma || !graph?.hasNode(id)) return;
    const p = sigma.getNodeDisplayData(id); const cam = sigma.getCamera();
    if (p) cam.animate({ x: p.x, y: p.y, ratio: zoom ? Math.min(cam.ratio, 0.6) : cam.ratio }, { duration: 500 });
  }
  export function resetCamera() { sigma?.getCamera().animatedReset({ duration: 400 }); }
</script>

<div class="canvas" bind:this={container}></div>

<style>
  .canvas { position: absolute; inset: 0; }
</style>
