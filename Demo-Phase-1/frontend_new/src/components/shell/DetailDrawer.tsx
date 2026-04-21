"use client";
import { X, ExternalLink, Copy, Clock, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getNodeLabel,
  getRelLabel,
  getPropName,
  nodeDisplayName,
} from "@/lib/labels";
import type { EvidenceData } from "@/lib/api";

interface DetailDrawerProps {
  evidence: EvidenceData | null;
  loading: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

export default function DetailDrawer({
  evidence,
  loading,
  onClose,
  onSelectNode,
}: DetailDrawerProps) {
  if (!evidence && !loading) return null;

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  const SKIP_PROPS = new Set([
    "source_table",
    "source_line",
    "row_uid",
    "source_file",
  ]);

  return (
    <aside className="w-80 border-l border-white/[0.06] bg-slate-900/60 backdrop-blur-sm flex flex-col overflow-hidden animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06] shrink-0">
        <h2 className="text-sm font-semibold text-slate-200">
          Details & Source Info
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-5 rounded" />
            ))}
          </div>
        ) : evidence ? (
          <>
            {/* Title */}
            <div>
              <p className="text-xs text-slate-500 mb-1">
                {evidence.type === "node"
                  ? getNodeLabel(evidence.labels?.[0] || "")
                  : "Connection"}
              </p>
              <h3 className="text-base font-semibold text-slate-100">
                {evidence.type === "node"
                  ? nodeDisplayName(evidence.props)
                  : getRelLabel(evidence.rel_type || "")}
              </h3>
            </div>

            {/* Properties */}
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Properties
              </p>
              {Object.entries(evidence.props)
                .filter(([k]) => !SKIP_PROPS.has(k))
                .slice(0, 20)
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between items-start gap-2 py-1 text-xs"
                  >
                    <span className="text-slate-500 shrink-0">
                      {getPropName(key)}
                    </span>
                    <span className="text-slate-300 text-right truncate max-w-[180px]">
                      {String(value ?? "—")}
                    </span>
                  </div>
                ))}
            </div>

            {/* Where this came from */}
            {evidence.lineage && (
              <div className="glass p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Where This Came From
                </p>
                <p className="text-xs text-slate-300">
                  {evidence.lineage.origin}
                </p>
                <p className="text-xs text-slate-500">
                  {evidence.lineage.transform}
                </p>
              </div>
            )}

            {/* Related items */}
            {evidence.connections.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Related Items ({evidence.connection_count})
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {evidence.connections.slice(0, 15).map((conn, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectNode(conn.neighbor_id)}
                      className={cn(
                        "w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs",
                        "text-slate-300 hover:bg-slate-800/60 transition-colors"
                      )}
                    >
                      <span className="text-slate-500 text-[10px]">
                        {conn.direction === "outgoing" ? "→" : "←"}
                      </span>
                      <span className="text-teal-400/80 shrink-0">
                        {getRelLabel(conn.rel_type)}
                      </span>
                      <span className="truncate">
                        {getNodeLabel(conn.neighbor_label)}{" "}
                        <span className="text-slate-500">
                          {conn.neighbor_identity}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => copyToClipboard(JSON.stringify(evidence.props, null, 2))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy Data
              </button>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
