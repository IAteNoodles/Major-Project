"use client";
import { useState, useMemo } from "react";
import { Table2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextMenu, type MenuEntry } from "@/components/ui/context-menu";
import { getNodeLabel, getRelLabel, nodeDisplayName, NODE_COLORS } from "@/lib/labels";
import type { GraphData, NodePayload, RelPayload } from "@/lib/api";

interface TableViewProps {
  graph: GraphData;
  onNodeClick: (node: NodePayload) => void;
  onRelClick: (rel: RelPayload) => void;
  onSwitchView: (view: string) => void;
}

function mainLabel(labels: string[]): string {
  if (!labels?.length) return "Node";
  const prio = ["Patient", "Admission", "ICUStay", "ClinicalEvent"];
  for (const p of prio) if (labels.includes(p)) return p;
  return labels[0];
}

export default function TableView({
  graph,
  onNodeClick,
  onRelClick,
  onSwitchView,
}: TableViewProps) {
  const [tab, setTab] = useState<"nodes" | "rels">("nodes");
  const [search, setSearch] = useState("");

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return graph.nodes;
    const q = search.toLowerCase();
    return graph.nodes.filter((n) => {
      const name = nodeDisplayName(n.props).toLowerCase();
      const label = mainLabel(n.labels).toLowerCase();
      return name.includes(q) || label.includes(q);
    });
  }, [graph.nodes, search]);

  const filteredRels = useMemo(() => {
    if (!search.trim()) return graph.relationships;
    const q = search.toLowerCase();
    return graph.relationships.filter((r) => {
      return (
        r.rel_type.toLowerCase().includes(q) ||
        getRelLabel(r.rel_type).toLowerCase().includes(q)
      );
    });
  }, [graph.relationships, search]);

  return (
    <div className="p-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Table2 className="w-5 h-5 text-teal-400" />
          Data Explorer
        </h2>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-0.5 border border-white/[0.06]">
          {(["nodes", "rels"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                tab === t
                  ? "bg-teal-500/15 text-teal-400"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {t === "nodes" ? `Items (${graph.nodes.length})` : `Connections (${graph.relationships.length})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-slate-800/50 border border-white/[0.06] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500/30"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-240px)]">
          {tab === "nodes" ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Description
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredNodes.map((node) => {
                  const label = mainLabel(node.labels);
                  const name = nodeDisplayName(node.props);
                  const contextItems: MenuEntry[] = [
                    { label: "View Details", onClick: () => onNodeClick(node) },
                    { label: "Show in Graph", onClick: () => onSwitchView("graph") },
                    { label: "Show in Timeline", onClick: () => onSwitchView("timeline") },
                    { type: "separator" },
                    { label: "Copy Data", onClick: () => navigator.clipboard.writeText(JSON.stringify(node.props, null, 2)) },
                  ];
                  return (
                    <ContextMenu key={node.id} items={contextItems}>
                      <tr
                        onClick={() => onNodeClick(node)}
                        className="border-t border-white/[0.04] hover:bg-slate-800/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
                            style={{
                              backgroundColor: (NODE_COLORS[label] || "#64748b") + "20",
                              color: NODE_COLORS[label] || "#94a3b8",
                            }}
                          >
                            {getNodeLabel(label)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-200 max-w-[300px] truncate">
                          {name}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {String(node.props.source_table || "—")}
                        </td>
                      </tr>
                    </ContextMenu>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Connection Type
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    From
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    To
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRels.map((rel) => {
                  const contextItems: MenuEntry[] = [
                    { label: "View Evidence", onClick: () => onRelClick(rel) },
                    { label: "Show in Graph", onClick: () => onSwitchView("graph") },
                  ];
                  return (
                    <ContextMenu key={rel.id} items={contextItems}>
                      <tr
                        onClick={() => onRelClick(rel)}
                        className="border-t border-white/[0.04] hover:bg-slate-800/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2">
                          <span className="text-xs text-teal-400 font-medium">
                            {getRelLabel(rel.rel_type)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-400 font-mono">
                          {rel.start_id.slice(-8)}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-400 font-mono">
                          {rel.end_id.slice(-8)}
                        </td>
                      </tr>
                    </ContextMenu>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
