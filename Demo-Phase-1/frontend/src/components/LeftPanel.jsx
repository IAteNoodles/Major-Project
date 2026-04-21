import { useMode } from "../hooks/useMode";

const NODE_COLORS = {
  Patient: "#ff6b6b",
  Admission: "#ff9f1c",
  ICUStay: "#ffd166",
  ClinicalEvent: "#4cc9f0",
  Provider: "#22d3ee",
  Caregiver: "#2dd4bf",
  POEOrder: "#86efac",
  PharmacyDispense: "#4ade80",
  ICDDiagnosisCode: "#c084fc",
  ICDProcedureCode: "#a78bfa",
  HCPCSCode: "#f472b6",
  LabItem: "#fb7185",
  ICUItem: "#fde047",
};

// Human-friendly names + descriptions for the sidebar
const NODE_FRIENDLY = {
  Patient:          { name: "Patients",          desc: "People receiving care" },
  Admission:        { name: "Hospital Visits",   desc: "Trips to the hospital" },
  ICUStay:          { name: "ICU Stays",         desc: "Time in intensive care" },
  ClinicalEvent:    { name: "Clinical Events",   desc: "Things that happened (labs, notes, etc.)" },
  Provider:         { name: "Doctors",           desc: "Who provided the care" },
  Caregiver:        { name: "Caregivers",        desc: "Nurses and aides" },
  POEOrder:         { name: "Doctor's Orders",   desc: "Requested tests or medications" },
  PharmacyDispense: { name: "Pharmacy Records",  desc: "Drugs that were given" },
  ICDDiagnosisCode: { name: "Diagnoses",         desc: "Conditions that were found" },
  ICDProcedureCode: { name: "Procedures",        desc: "Surgeries or treatments done" },
  HCPCSCode:        { name: "Billing Codes",     desc: "How things were billed" },
  LabItem:          { name: "Lab Tests",         desc: "Blood, urine, and other tests" },
  ICUItem:          { name: "ICU Readings",      desc: "Vital signs and measurements" },
};

const VIEWS = [
  { id: "summary",  label: "Overview",   icon: "📋" },
  { id: "timeline", label: "Timeline",   icon: "📅" },
  { id: "graph",    label: "Connections", icon: "🔗" },
  { id: "table",    label: "Data Table",  icon: "📊" },
];

export default function LeftPanel({
  currentView,
  onViewChange,
  hiddenTypes,
  onToggleType,
  nodeTypeCounts,
  hasData,
  graphMeta,
}) {
  const { config, mode } = useMode();

  return (
    <aside className="left-panel" id="left-panel">
      {/* View switcher */}
      <div className="view-switcher">
        <div className="section-title">Views</div>
        <div className="view-buttons">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`view-btn${currentView === v.id ? " active" : ""}`}
              onClick={() => onViewChange(v.id)}
              title={v.label}
            >
              <span className="view-icon">{v.icon}</span>
              <span className="view-label">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* What's shown — filter toggles */}
      <div className="filter-section">
        <div className="section-title">What's Shown</div>
        <div className="legend-list">
          {Object.entries(NODE_COLORS).map(([type, color]) => {
            const friendly = NODE_FRIENDLY[type] || { name: type, desc: "" };
            return (
              <button
                key={type}
                className={`legend-row${hiddenTypes.has(type) ? " faded" : ""}`}
                onClick={() => onToggleType(type)}
                title={hiddenTypes.has(type) ? `Show ${friendly.name}` : `Hide ${friendly.name}`}
              >
                <span
                  className="l-dot"
                  style={{ background: hiddenTypes.has(type) ? "#2a3a4a" : color }}
                />
                <span className="l-info">
                  <span className="l-name">{friendly.name}</span>
                  <span className="l-desc">{friendly.desc}</span>
                </span>
                {nodeTypeCounts[type] != null && (
                  <span className="l-count">{nodeTypeCounts[type]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick stats */}
      {hasData && (
        <div className="filter-section">
          <div className="section-title">At a Glance</div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-val">{graphMeta?.node_count ?? 0}</div>
              <div className="stat-lbl">Items</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">{graphMeta?.relationship_count ?? 0}</div>
              <div className="stat-lbl">Connections</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">{Object.keys(nodeTypeCounts).length}</div>
              <div className="stat-lbl">Categories</div>
            </div>
            <div className="stat-card">
              <div className={`stat-val ${graphMeta?.truncated ? "s-warn" : "s-ok"}`}>
                {graphMeta?.truncated ? "⚠" : "✓"}
              </div>
              <div className="stat-lbl">{graphMeta?.truncated ? "Partial" : "Complete"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Depth controls hint */}
      {config.showDepthControls && (
        <div className="filter-section">
          <div className="section-title">Advanced Controls</div>
          <div className="hint-box">
            <p>You can adjust how deep the exploration goes using the controls in the top bar.</p>
          </div>
        </div>
      )}
    </aside>
  );
}
