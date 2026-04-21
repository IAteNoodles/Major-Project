import { useMemo, useState } from "react";
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_NAMES } from "../../utils/labels";

const CATEGORY_FILTERS = ["all", "diagnosis", "medication", "lab", "procedure", "icu", "encounter"];

export default function TimelineView({ timeline, onSelectEvent }) {
  const [filter, setFilter] = useState("all");

  const events = useMemo(() => {
    if (!timeline?.events) return [];
    if (filter === "all") return timeline.events;
    return timeline.events.filter((e) => e.category === filter);
  }, [timeline, filter]);

  // Group by hospital visit
  const grouped = useMemo(() => {
    const groups = new Map();
    for (const ev of events) {
      const key = ev.hadm_id || "no-admission";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    }
    return groups;
  }, [events]);

  if (!timeline) {
    return (
      <div className="view-empty">
        <p>Load a patient to see their medical history over time.</p>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="view-empty">
        <p>No events found{filter !== "all" ? ` for "${CATEGORY_NAMES[filter] || filter}"` : ""}.</p>
      </div>
    );
  }

  return (
    <div className="timeline-view" id="timeline-view">
      {/* Category filter */}
      <div className="timeline-filters">
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat}
            className={`tl-filter${filter === cat ? " active" : ""}`}
            onClick={() => setFilter(cat)}
            style={filter === cat && cat !== "all" ? { borderColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat] } : undefined}
          >
            {cat !== "all" && <span>{CATEGORY_ICONS[cat]}</span>}
            <span>{CATEGORY_NAMES[cat] || cat}{cat === "all" ? ` (${timeline.events.length})` : ""}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="timeline-track">
        {[...grouped.entries()].map(([admId, groupEvents]) => (
          <div key={admId} className="timeline-group">
            {admId !== "no-admission" && (
              <div className="timeline-group-header">
                <span className="tl-group-dot" />
                <span className="tl-group-label">Hospital Visit {admId}</span>
                <span className="tl-group-count">{groupEvents.length} events</span>
              </div>
            )}
            <div className="timeline-events">
              {groupEvents.map((ev, i) => (
                <button
                  key={i}
                  className="timeline-event"
                  onClick={() => onSelectEvent(ev)}
                >
                  <div className="tl-event-line">
                    <span
                      className="tl-event-dot"
                      style={{ background: CATEGORY_COLORS[ev.category] || "#94a3b8" }}
                    />
                  </div>
                  <div className="tl-event-content">
                    <div className="tl-event-header">
                      <span className="tl-event-icon">{CATEGORY_ICONS[ev.category] || "📋"}</span>
                      <span className="tl-event-cat" style={{ color: CATEGORY_COLORS[ev.category] }}>
                        {CATEGORY_NAMES[ev.category] || ev.category}
                      </span>
                      {ev.time && <span className="tl-event-time">{ev.time}</span>}
                    </div>
                    <div className="tl-event-desc">{ev.description}</div>
                    {ev.source_table && (
                      <div className="tl-event-source">
                        from {ev.source_table}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
