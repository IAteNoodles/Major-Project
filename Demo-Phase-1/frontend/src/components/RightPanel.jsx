import { useMode } from "../hooks/useMode";
import { getRelLabel, getNodeLabel, CATEGORY_COLORS, NL_NODE_LABELS } from "../utils/labels";
import { getRecommendations } from "../utils/recommendations";

function mainLabel(labels) {
  if (!labels?.length) return "Node";
  const prio = ["Patient", "Admission", "ICUStay", "ClinicalEvent"];
  for (const p of prio) if (labels.includes(p)) return p;
  return labels[0];
}

function formatVal(val) {
  if (val === null || val === undefined) return "–";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

// Human-friendly property names
const PROP_FRIENDLY = {
  subject_id: "Patient ID",
  hadm_id: "Visit ID",
  stay_id: "ICU Stay ID",
  row_uid: "Record ID",
  admittime: "Admitted",
  dischtime: "Discharged",
  deathtime: "Time of Death",
  admission_type: "Visit Type",
  admission_location: "Arrived From",
  discharge_location: "Discharged To",
  insurance: "Insurance",
  language: "Language",
  marital_status: "Marital Status",
  race: "Ethnicity",
  gender: "Sex",
  anchor_age: "Age (approx.)",
  anchor_year: "Year",
  dod: "Date of Death",
  icd_code: "Diagnosis Code",
  icd_version: "Code Version",
  long_title: "Description",
  source_table: "From Table",
  drug: "Drug Name",
  medication: "Medication",
  itemid: "Item ID",
  label: "Name",
  category: "Category",
  provider_id: "Provider ID",
  caregiver_id: "Caregiver ID",
  code: "Code",
  seq_num: "Sequence #",
  first_careunit: "First ICU Unit",
  last_careunit: "Last ICU Unit",
  intime: "Start Time",
  outtime: "End Time",
  los: "Length of Stay",
};

function friendlyPropName(key) {
  return PROP_FRIENDLY[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const NODE_COLORS = {
  Patient: "#ff6b6b", Admission: "#ff9f1c", ICUStay: "#ffd166",
  ClinicalEvent: "#4cc9f0", Provider: "#22d3ee", Caregiver: "#2dd4bf",
  POEOrder: "#86efac", PharmacyDispense: "#4ade80",
  ICDDiagnosisCode: "#c084fc", ICDProcedureCode: "#a78bfa",
  HCPCSCode: "#f472b6", LabItem: "#fb7185", ICUItem: "#fde047",
};

// Connection direction in plain English
function dirLabel(dir) {
  return dir === "outgoing" ? "→" : "←";
}

export default function RightPanel({
  evidence,
  selectedNode,
  selectedRel,
  onSelectNode,
  onSwitchView,
  loading,
}) {
  const { mode } = useMode();
  const recommendations = selectedNode
    ? getRecommendations(selectedNode.labels || [])
    : selectedRel
      ? getRecommendations([])
      : [];

  function handleRecommendation(rec) {
    if (rec.action === "view") onSwitchView?.(rec.target);
  }

  return (
    <aside className="right-panel" id="right-panel">
      <div className="rp-header">
        <span className="rp-title">Details & Source Info</span>
      </div>

      <div className="rp-body">
        {loading && (
          <div className="rp-loading">
            <span className="spinner" /> Loading details…
          </div>
        )}

        {/* Selected item details */}
        {selectedNode && (
          <div className="rp-section">
            <div className="inspect-card">
              <span
                className="inspect-dot"
                style={{ background: NODE_COLORS[mainLabel(selectedNode.labels)] || "#94a3b8" }}
              />
              <div>
                <div className="inspect-type">
                  {getNodeLabel(mainLabel(selectedNode.labels), mode)}
                </div>
                <div className="inspect-id">
                  {selectedNode.props?.subject_id
                    ? `Patient ${selectedNode.props.subject_id}`
                    : selectedNode.props?.hadm_id
                      ? `Visit ${selectedNode.props.hadm_id}`
                      : selectedNode.props?.row_uid
                        ? `Record ${selectedNode.props.row_uid}`
                        : selectedNode.props?.long_title || selectedNode.props?.drug || selectedNode.props?.label || `ID: ${selectedNode.id?.slice(-8)}`}
                </div>
              </div>
            </div>

            {/* Type tags */}
            <div className="label-chips">
              {selectedNode.labels?.map((l) => (
                <span key={l} className="chip">{getNodeLabel(l, mode)}</span>
              ))}
            </div>

            {/* Properties — with friendly names */}
            <div className="section-title">Details</div>
            <div className="prop-table">
              {Object.entries(selectedNode.props || {}).map(([k, v]) => (
                <div key={k} className="prop-row">
                  <span className="prop-key">{friendlyPropName(k)}</span>
                  <span className="prop-val">{formatVal(v)}</span>
                </div>
              ))}
              {!Object.keys(selectedNode.props || {}).length && (
                <div className="prop-empty">No details available</div>
              )}
            </div>
          </div>
        )}

        {/* Relationship details */}
        {selectedRel && (
          <div className="rp-section">
            <div className="inspect-card">
              <span className="inspect-dot" style={{ background: "#38bdf8" }} />
              <div>
                <div className="inspect-type">{getRelLabel(selectedRel.rel_type, mode)}</div>
                <div className="inspect-id">Connection between two items</div>
              </div>
            </div>
            <div className="rel-flow">
              <span className="rel-node">From</span>
              <span className="rel-arrow">→</span>
              <span className="rel-node">To</span>
            </div>
            <div className="section-title">Details</div>
            <div className="prop-table">
              {Object.entries(selectedRel.props || {}).map(([k, v]) => (
                <div key={k} className="prop-row">
                  <span className="prop-key">{friendlyPropName(k)}</span>
                  <span className="prop-val">{formatVal(v)}</span>
                </div>
              ))}
              {!Object.keys(selectedRel.props || {}).length && (
                <div className="prop-empty">No additional details</div>
              )}
            </div>
          </div>
        )}

        {/* Where this data came from */}
        {evidence && (
          <div className="rp-section">
            <div className="section-title">Where This Came From</div>
            <div className="evidence-card">
              <div className="ev-row">
                <span className="ev-label">Source</span>
                <span className="ev-value">{evidence.lineage?.origin || evidence.lineage?.explanation || "MIMIC-IV Database"}</span>
              </div>
              <div className="ev-row">
                <span className="ev-label">How it was created</span>
                <span className="ev-value">{evidence.lineage?.transform || "Directly from hospital records"}</span>
              </div>
              {evidence.source_table && (
                <div className="ev-row">
                  <span className="ev-label">Original table</span>
                  <span className="ev-value">{evidence.source_table}</span>
                </div>
              )}
              {evidence.source_line && (
                <div className="ev-row">
                  <span className="ev-label">Record line</span>
                  <span className="ev-value">{evidence.source_line}</span>
                </div>
              )}
              {evidence.row_uid && (
                <div className="ev-row">
                  <span className="ev-label">Record ID</span>
                  <span className="ev-value ev-mono">{evidence.row_uid}</span>
                </div>
              )}
              {evidence.connection_count != null && (
                <div className="ev-row">
                  <span className="ev-label">Connected to</span>
                  <span className="ev-value">{evidence.connection_count} other items</span>
                </div>
              )}
            </div>

            {/* Related items */}
            {evidence.connections?.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 14 }}>Related Items</div>
                <div className="connections-list">
                  {evidence.connections.slice(0, 12).map((c, i) => (
                    <div key={i} className="connection-chip">
                      <span className="conn-dir">{dirLabel(c.direction)}</span>
                      <span className="conn-type">{getRelLabel(c.rel_type, mode)}</span>
                      <span className="conn-target">{c.neighbor_identity}</span>
                    </div>
                  ))}
                  {evidence.connections.length > 12 && (
                    <div className="summary-more">+{evidence.connections.length - 12} more</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* What you can do next */}
        {(selectedNode || selectedRel) && recommendations.length > 0 && (
          <div className="rp-section">
            <div className="section-title">What You Can Do</div>
            <div className="next-steps">
              {recommendations.map((rec, i) => (
                <button key={i} className="next-step-btn" onClick={() => handleRecommendation(rec)}>
                  <span className="ns-arrow">→</span>
                  <span>{rec.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedNode && !selectedRel && !evidence && (
          <div className="hint-box">
            <p>Click on anything in the graph, timeline, or table to see its details here.</p>
            <p>Every piece of data can be traced back to the original hospital records.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
