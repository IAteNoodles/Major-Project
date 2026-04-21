"use client";
import {
  LayoutDashboard,
  Clock,
  Network,
  Table2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_NAMES, CATEGORY_COLORS } from "@/lib/labels";
import type { GraphData } from "@/lib/api";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  graphMeta?: GraphData["meta"];
  hiddenCategories: Set<string>;
  onToggleCategory: (cat: string) => void;
}

// Deep Dive sidebar shows all views
const VIEW_ITEMS = [
  { key: "summary", label: "Summary", icon: LayoutDashboard },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "graph", label: "Graph Explorer", icon: Network },
  { key: "table", label: "Data Table", icon: Table2 },
];

const FILTER_CATEGORIES = [
  "diagnosis",
  "medication",
  "lab",
  "procedure",
  "encounter",
  "icu",
  "other",
];

export default function Sidebar({
  currentView,
  onViewChange,
  collapsed,
  onToggleCollapse,
  graphMeta,
  hiddenCategories,
  onToggleCategory,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col border-r border-white/[0.06] bg-slate-900/50 transition-all duration-300",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        <div className={cn("mb-3", collapsed && "hidden")}>
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Deep Dive Views
          </p>
        </div>
        {VIEW_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              title={item.label}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                active
                  ? "bg-teal-500/12 text-teal-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {/* Category filters */}
        {!collapsed && (
          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Filter by Type
            </p>
            {FILTER_CATEGORIES.map((cat) => {
              const hidden = hiddenCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all",
                    hidden
                      ? "text-slate-600"
                      : "text-slate-300 hover:bg-slate-800/50"
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                    style={{
                      backgroundColor: CATEGORY_COLORS[cat],
                      opacity: hidden ? 0.2 : 1,
                    }}
                  />
                  <span className={cn(hidden && "line-through")}>
                    {CATEGORY_NAMES[cat] || cat}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Graph stats */}
        {!collapsed && graphMeta && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] px-2 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Graph Info
            </p>
            <p className="text-xs text-slate-400">
              {graphMeta.node_count} items · {graphMeta.relationship_count} connections
            </p>
            {graphMeta.truncated && (
              <p className="text-xs text-amber-400">
                Showing partial data (limited to {graphMeta.max_nodes})
              </p>
            )}
          </div>
        )}
      </nav>

      {/* Collapse */}
      <button
        onClick={onToggleCollapse}
        className="h-10 flex items-center justify-center border-t border-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
