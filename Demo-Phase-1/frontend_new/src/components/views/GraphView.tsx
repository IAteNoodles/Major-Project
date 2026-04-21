"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { SigmaContainer, useRegisterEvents, useSigma } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import * as CtxMenu from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";
import {
  getNodeLabel,
  getRelLabel,
  nodeDisplayName,
  NODE_COLORS,
  mainLabel,
  categoryFromLabels,
  CATEGORY_COLORS,
} from "@/lib/labels";
import type { GraphData, NodePayload, RelPayload } from "@/lib/api";
import { Network, MousePointer, Maximize2, ZoomIn, ZoomOut, Eye, EyeOff, Expand, Target, Copy, ArrowRight } from "lucide-react";

/* ─────────────────────── Types ─────────────────────── */

interface GraphViewProps {
  graph: GraphData;
  hiddenCategories: Set<string>;
  onNodeClick: (node: NodePayload) => void;
  onLinkClick: (rel: RelPayload) => void;
  onSwitchView: (view: string) => void;
}

interface NodeContextState {
  x: number;
  y: number;
  node: NodePayload;
  open: boolean;
}

/* ─────────────────── Graph builder ─────────────────── */

function buildGraph(
  data: GraphData,
  hiddenCategories: Set<string>,
  expandedNodes: Set<string>
): { graph: Graph; hiddenCount: number } {
  const g = new Graph({ multi: true, type: "directed" });

  // Find patient node (always visible)
  const patientNode = data.nodes.find((n) => n.labels.includes("Patient"));
  const patientId = patientNode?.id;

  // Build adjacency for progressive disclosure
  const adj = new Map<string, Set<string>>();
  for (const rel of data.relationships) {
    if (!adj.has(rel.start_id)) adj.set(rel.start_id, new Set());
    if (!adj.has(rel.end_id)) adj.set(rel.end_id, new Set());
    adj.get(rel.start_id)!.add(rel.end_id);
    adj.get(rel.end_id)!.add(rel.start_id);
  }

  // Determine visible nodes: patient + direct neighbors + neighbors of expanded nodes
  const visible = new Set<string>();
  if (patientId) {
    visible.add(patientId);
    // Patient's direct neighbors (always visible)
    const directNeighbors = adj.get(patientId) || new Set();
    for (const nid of directNeighbors) visible.add(nid);

    // Expanded nodes' neighbors
    for (const expId of expandedNodes) {
      const neighbors = adj.get(expId) || new Set();
      for (const nid of neighbors) visible.add(nid);
    }
  }

  // If no patient node or very few nodes, show all
  if (!patientId || data.nodes.length <= 30) {
    for (const n of data.nodes) visible.add(n.id);
  }

  let hiddenCount = 0;

  // Add visible nodes
  for (const node of data.nodes) {
    if (!visible.has(node.id)) { hiddenCount++; continue; }
    const cat = categoryFromLabels(node.labels);
    if (hiddenCategories.has(cat)) { hiddenCount++; continue; }

    const label = mainLabel(node.labels);
    const displayName = nodeDisplayName(node.props, node.labels);
    const color = NODE_COLORS[label] || "#64748b";
    const isPatient = node.labels.includes("Patient");
    const isExpanded = expandedNodes.has(node.id);

    // Size based on type importance
    let size = 6;
    if (isPatient) size = 16;
    else if (node.labels.includes("Admission")) size = 11;
    else if (node.labels.includes("ICUStay")) size = 10;
    else if (node.labels.includes("ICDDiagnosisCode")) size = 9;
    else if (node.labels.includes("POEOrder") || node.labels.includes("PharmacyDispense")) size = 8;
    else if (node.labels.includes("LabItem") || node.labels.includes("ICUItem")) size = 8;

    g.addNode(node.id, {
      label: displayName.slice(0, 50),
      x: Math.random() * 200 - 100,
      y: Math.random() * 200 - 100,
      size,
      color,
      originalColor: color,
      originalSize: size,
      nodeType: label,
      category: cat,
      rawNode: node,
      expanded: isExpanded,
      expandable: false,
    });
  }

  // Add edges between visible nodes
  for (const rel of data.relationships) {
    if (!g.hasNode(rel.start_id) || !g.hasNode(rel.end_id)) continue;
    try {
      g.addEdge(rel.start_id, rel.end_id, {
        label: getRelLabel(rel.rel_type),
        rawType: rel.rel_type,
        size: 1.5,
        color: "rgba(100, 116, 139, 0.25)",
        originalColor: "rgba(100, 116, 139, 0.25)",
        rawRel: rel,
        type: "arrow",
      });
    } catch {
      // skip duplicate
    }
  }

  // Run ForceAtlas2 layout
  if (g.order > 1) {
    forceAtlas2.assign(g, {
      iterations: Math.min(200, Math.max(80, g.order * 3)),
      settings: {
        gravity: 5,
        scalingRatio: g.order > 50 ? 20 : 10,
        barnesHutOptimize: g.order > 60,
        strongGravityMode: true,
        slowDown: 8,
        linLogMode: false,
      },
    });
  }

  // Mark expandable nodes (nodes with neighbors not in the graph)
  g.forEachNode((id) => {
    const totalAdj = adj.get(id)?.size || 0;
    const currentAdj = g.degree(id);
    g.setNodeAttribute(id, "expandable", totalAdj > currentAdj);
  });

  return { graph: g, hiddenCount };
}

/* ──────────────── Graph interaction handler ──────────── */

function GraphInteractions({
  onNodeClick,
  onLinkClick,
  onDoubleClickNode,
  onContextNode,
}: {
  onNodeClick: (node: NodePayload) => void;
  onLinkClick: (rel: RelPayload) => void;
  onDoubleClickNode: (nodeId: string) => void;
  onContextNode: (nodeId: string, x: number, y: number) => void;
}) {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const hoveredRef = useRef<string | null>(null);

  useEffect(() => {
    const graph = sigma.getGraph();

    function highlightNeighborhood(nodeId: string) {
      const neighbors = new Set(graph.neighbors(nodeId));
      neighbors.add(nodeId);
      const connectedEdges = new Set(graph.edges(nodeId));

      graph.forEachNode((id, attrs) => {
        if (neighbors.has(id)) {
          graph.setNodeAttribute(id, "color", attrs.originalColor);
          graph.setNodeAttribute(id, "size", (attrs.originalSize || 6) * (id === nodeId ? 1.5 : 1.15));
          graph.setNodeAttribute(id, "highlighted", true);
        } else {
          graph.setNodeAttribute(id, "color", "rgba(100, 116, 139, 0.08)");
          graph.setNodeAttribute(id, "size", (attrs.originalSize || 6) * 0.5);
          graph.setNodeAttribute(id, "highlighted", false);
        }
      });

      graph.forEachEdge((edge, attrs) => {
        if (connectedEdges.has(edge)) {
          const sourceCategory = graph.getNodeAttribute(graph.source(edge), "category") || "other";
          const catColor = CATEGORY_COLORS[sourceCategory] || "#2dd4bf";
          graph.setEdgeAttribute(edge, "color", catColor + "90");
          graph.setEdgeAttribute(edge, "size", 2.5);
        } else {
          graph.setEdgeAttribute(edge, "color", "rgba(100, 116, 139, 0.03)");
          graph.setEdgeAttribute(edge, "size", 0.3);
        }
      });
      sigma.refresh();
    }

    function resetHighlight() {
      graph.forEachNode((id, attrs) => {
        graph.setNodeAttribute(id, "color", attrs.originalColor);
        graph.setNodeAttribute(id, "size", attrs.originalSize || 6);
        graph.setNodeAttribute(id, "highlighted", false);
      });
      graph.forEachEdge((edge, attrs) => {
        graph.setEdgeAttribute(edge, "color", attrs.originalColor);
        graph.setEdgeAttribute(edge, "size", 1.5);
      });
      sigma.refresh();
    }

    registerEvents({
      enterNode: (event) => {
        hoveredRef.current = event.node;
        highlightNeighborhood(event.node);
        const container = sigma.getContainer();
        if (container) container.style.cursor = "pointer";
      },
      leaveNode: () => {
        hoveredRef.current = null;
        resetHighlight();
        const container = sigma.getContainer();
        if (container) container.style.cursor = "grab";
      },
      clickNode: (event) => {
        const attrs = graph.getNodeAttributes(event.node);
        if (attrs.rawNode) onNodeClick(attrs.rawNode);
      },
      doubleClickNode: (event) => {
        event.preventSigmaDefault();
        onDoubleClickNode(event.node);
      },
      rightClickNode: (event) => {
        event.preventSigmaDefault();
        const attrs = graph.getNodeAttributes(event.node);
        const { x, y } = sigma.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
        const container = sigma.getContainer();
        const rect = container?.getBoundingClientRect();
        if (rect) {
          onContextNode(event.node, rect.left + x, rect.top + y);
        }
      },
      clickEdge: (event) => {
        const attrs = graph.getEdgeAttributes(event.edge);
        if (attrs.rawRel) onLinkClick(attrs.rawRel);
      },
    });
  }, [registerEvents, sigma, onNodeClick, onLinkClick, onDoubleClickNode, onContextNode]);

  return null;
}

/* ──────────────── Zoom controls ──────────── */

function ZoomControls() {
  const sigma = useSigma();
  return (
    <div className="absolute top-4 right-4 flex flex-col gap-1 z-20">
      {[
        { icon: ZoomIn, action: () => sigma.getCamera().animatedZoom({ duration: 200 }), tip: "Zoom in" },
        { icon: ZoomOut, action: () => sigma.getCamera().animatedUnzoom({ duration: 200 }), tip: "Zoom out" },
        { icon: Maximize2, action: () => sigma.getCamera().animatedReset({ duration: 300 }), tip: "Reset" },
      ].map((ctrl, i) => (
        <button
          key={i}
          onClick={ctrl.action}
          title={ctrl.tip}
          className="p-2 glass hover:bg-slate-700/60 transition-colors rounded-lg"
        >
          <ctrl.icon className="w-4 h-4 text-slate-300" />
        </button>
      ))}
    </div>
  );
}

/* ──────────────── Main component ──────────── */

export default function GraphView({
  graph: graphData,
  hiddenCategories,
  onNodeClick,
  onLinkClick,
  onSwitchView,
}: GraphViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<NodeContextState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { graph: sigmaGraph, hiddenCount } = useMemo(
    () => buildGraph(graphData, hiddenCategories, expandedNodes),
    [graphData, hiddenCategories, expandedNodes]
  );

  // Double-click: toggle expand on a node
  const handleDoubleClick = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // Right-click: open context menu
  const handleContextNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      const node = graphData.nodes.find((n) => n.id === nodeId);
      if (node) {
        setContextMenu({ x, y, node, open: true });
      }
    },
    [graphData.nodes]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleExpandAll = useCallback(() => {
    const allIds = new Set(graphData.nodes.map((n) => n.id));
    setExpandedNodes(allIds);
  }, [graphData.nodes]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Type counts for legend
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sigmaGraph.forEachNode((_, attrs) => {
      const type = attrs.nodeType as string;
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [sigmaGraph]);

  const visibleNodeCount = sigmaGraph.order;
  const visibleEdgeCount = sigmaGraph.size;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[600px] animate-fade-up"
      onContextMenu={(e) => e.preventDefault()}
    >
      <SigmaContainer
        graph={sigmaGraph}
        settings={{
          renderEdgeLabels: true,
          enableEdgeEvents: true,
          defaultNodeColor: "#64748b",
          defaultEdgeColor: "rgba(100, 116, 139, 0.25)",
          labelSize: 13,
          labelColor: { color: "#e2e8f0" },
          labelFont: "'Inter', sans-serif",
          labelWeight: "500",
          labelRenderedSizeThreshold: 5,
          edgeLabelSize: 10,
          edgeLabelColor: { color: "#64748b" },
          edgeLabelFont: "'Inter', sans-serif",
          minCameraRatio: 0.03,
          maxCameraRatio: 20,
          defaultEdgeType: "arrow",
          stagePadding: 40,
        }}
        className="w-full h-full"
        style={{ background: "#0c1222" }}
      >
        <GraphInteractions
          onNodeClick={onNodeClick}
          onLinkClick={onLinkClick}
          onDoubleClickNode={handleDoubleClick}
          onContextNode={handleContextNode}
        />
        <ZoomControls />
      </SigmaContainer>

      {/* ── Stats bar ── */}
      <div className="absolute top-4 left-4 glass px-3 py-2 flex items-center gap-3 z-10">
        <Network className="w-4 h-4 text-teal-400" />
        <span className="text-xs text-slate-300">
          {visibleNodeCount} node{visibleNodeCount !== 1 && "s"} · {visibleEdgeCount} edge{visibleEdgeCount !== 1 && "s"}
        </span>
        {hiddenCount > 0 && (
          <span className="text-[10px] text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10">
            {hiddenCount} hidden
          </span>
        )}
        {expandedNodes.size > 0 && (
          <button
            onClick={handleCollapseAll}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <EyeOff className="w-3 h-3" />
            Collapse
          </button>
        )}
        <button
          onClick={handleExpandAll}
          className="text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
        >
          <Expand className="w-3 h-3" />
          Show All
        </button>
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-4 glass p-3 max-w-[220px] z-10">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Node Types
        </p>
        <div className="space-y-1">
          {typeCounts.map(([label, count]) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: NODE_COLORS[label] || "#64748b" }}
              />
              <span className="text-slate-300 flex-1">{getNodeLabel(label)}</span>
              <span className="text-slate-500 tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Interaction hint ── */}
      <div className="absolute bottom-4 right-4 glass px-3 py-2 z-10">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <MousePointer className="w-3 h-3" />
            Hover: highlight
          </span>
          <span>Click: details</span>
          <span>Double-click: expand</span>
          <span>Right-click: actions</span>
        </div>
      </div>

      {/* ── Right-click context menu (floating) ── */}
      {contextMenu?.open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          {/* Menu */}
          <div
            className="fixed z-50 glass p-1 min-w-[200px] shadow-2xl animate-fade-up"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {nodeDisplayName(contextMenu.node.props, contextMenu.node.labels)}
              </p>
              <p className="text-[10px] text-slate-500">
                {getNodeLabel(mainLabel(contextMenu.node.labels))}
              </p>
            </div>

            {/* Actions */}
            {[
              {
                icon: Eye,
                label: "View Details",
                onClick: () => { onNodeClick(contextMenu.node); closeContextMenu(); },
              },
              {
                icon: Expand,
                label: expandedNodes.has(contextMenu.node.id) ? "Collapse Connections" : "Expand Connections",
                onClick: () => { handleDoubleClick(contextMenu.node.id); closeContextMenu(); },
              },
              {
                icon: Target,
                label: "Show in Timeline",
                onClick: () => { onSwitchView("timeline"); closeContextMenu(); },
              },
              {
                icon: ArrowRight,
                label: "Show in Table",
                onClick: () => { onSwitchView("table"); closeContextMenu(); },
              },
              { type: "separator" as const },
              {
                icon: Copy,
                label: "Copy Name",
                onClick: () => {
                  navigator.clipboard.writeText(
                    nodeDisplayName(contextMenu.node.props, contextMenu.node.labels)
                  );
                  closeContextMenu();
                },
              },
            ].map((item, i) => {
              if ("type" in item && item.type === "separator") {
                return <div key={i} className="h-px bg-white/[0.06] my-1" />;
              }
              const Icon = (item as { icon: typeof Eye }).icon;
              return (
                <button
                  key={i}
                  onClick={(item as { onClick: () => void }).onClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-teal-500/10 hover:text-teal-400 rounded-md transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {(item as { label: string }).label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
