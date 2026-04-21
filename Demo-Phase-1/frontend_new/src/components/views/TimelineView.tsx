"use client";
import { useState, useMemo } from "react";
import { Clock, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContextMenu, type MenuEntry } from "@/components/ui/context-menu";
import { CATEGORY_COLORS, CATEGORY_NAMES } from "@/lib/labels";
import type { TimelineData, TimelineEvent } from "@/lib/api";

interface TimelineViewProps {
  timeline: TimelineData;
  onSelectEvent: (ev: TimelineEvent) => void;
  onSwitchView: (view: string) => void;
  hiddenCategories: Set<string>;
}

export default function TimelineView({
  timeline,
  onSelectEvent,
  onSwitchView,
  hiddenCategories,
}: TimelineViewProps) {
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const events = useMemo(() => {
    return timeline.events.filter((ev) => {
      if (hiddenCategories.has(ev.category)) return false;
      if (activeFilter !== "all" && ev.category !== activeFilter) return false;
      return true;
    });
  }, [timeline.events, hiddenCategories, activeFilter]);

  // Group by date
  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      const date = ev.time ? ev.time.split("T")[0].split(" ")[0] : "Unknown Date";
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(ev);
    }
    return [...map.entries()];
  }, [events]);

  const categories = useMemo(() => {
    const cats = new Set(timeline.events.map((e) => e.category));
    return ["all", ...cats];
  }, [timeline.events]);

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-400" />
          Medical Timeline
        </h2>
        <span className="text-xs text-slate-500">
          {events.length} of {timeline.count} events
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeFilter === cat
                ? "bg-teal-500/15 text-teal-400 border border-teal-500/20"
                : "text-slate-400 border border-white/[0.06] hover:bg-slate-800/50"
            )}
          >
            {cat !== "all" && (
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other }}
              />
            )}
            {CATEGORY_NAMES[cat] || cat}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="glass p-8 text-center">
          <p className="text-slate-400 text-sm">No events match the current filter.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-white/[0.08]" />

          {groups.map(([date, evs]) => (
            <div key={date} className="mb-6">
              {/* Date header */}
              <div className="relative flex items-center gap-3 mb-2">
                <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-teal-500/30 flex items-center justify-center z-10">
                  <div className="w-2 h-2 rounded-full bg-teal-400" />
                </div>
                <span className="text-xs font-semibold text-slate-400">{date}</span>
              </div>

              {/* Events */}
              <div className="ml-8 space-y-1">
                {evs.map((ev, i) => {
                  const contextItems: MenuEntry[] = [
                    { label: "View Details", onClick: () => onSelectEvent(ev) },
                    { label: "Show in Graph", onClick: () => onSwitchView("graph") },
                    { type: "separator" },
                    { label: "Copy Description", onClick: () => navigator.clipboard.writeText(ev.description) },
                  ];
                  return (
                    <ContextMenu key={`${ev.node_id}-${i}`} items={contextItems}>
                      <button
                        onClick={() => onSelectEvent(ev)}
                        className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/40 transition-colors group"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.other }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate group-hover:text-teal-300 transition-colors">
                            {ev.description}
                          </p>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500">
                              {CATEGORY_NAMES[ev.category] || ev.category}
                            </span>
                            {ev.time && (
                              <span className="text-[10px] text-slate-600">
                                {ev.time.split("T")[1]?.slice(0, 5) || ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </ContextMenu>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
