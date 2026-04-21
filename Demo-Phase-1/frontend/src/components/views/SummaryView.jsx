import { useMode } from "../../hooks/useMode";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "../../utils/labels";

function StatCard({ value, label, accent }) {
  return (
    <div className="summary-stat">
      <div className="summary-stat-val" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="summary-stat-lbl">{label}</div>
    </div>
  );
}

function CategoryCard({ title, icon, items, color, onItemClick }) {
  if (!items?.length) return null;
  return (
    <div className="summary-category" style={{ borderColor: color + "40" }}>
      <div className="summary-cat-header">
        <span>{icon}</span>
        <span className="summary-cat-title">{title}</span>
        <span className="summary-cat-count" style={{ color }}>{items.length}</span>
      </div>
      <div className="summary-cat-list">
        {items.slice(0, 8).map((item, i) => (
          <button
            key={i}
            className="summary-item"
            onClick={() => onItemClick?.(item)}
          >
            <span className="summary-item-dot" style={{ background: color }} />
            <span className="summary-item-text">{item.title || item.label || item.description || "Unknown"}</span>
            {item.icd_code && <span className="summary-item-code">{item.icd_code}</span>}
          </button>
        ))}
        {items.length > 8 && (
          <div className="summary-more">+{items.length - 8} more</div>
        )}
      </div>
    </div>
  );
}

export default function SummaryView({ summary, onSwitchView, onSelectNode }) {
  const { mode } = useMode();

  if (!summary) {
    return (
      <div className="view-empty">
        <p>Select a patient and click <strong>Explore</strong> to see their clinical summary.</p>
      </div>
    );
  }

  const demo = summary.demographics || {};
  const counts = summary.counts || {};

  return (
    <div className="summary-view" id="summary-view">
      {/* Patient header */}
      <div className="summary-header">
        <div className="summary-avatar">
          <svg viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="15" r="8" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(56,189,248,0.1)" />
            <path d="M6 36c0-7.7 6.3-14 14-14s14 6.3 14 14" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(56,189,248,0.05)" />
          </svg>
        </div>
        <div className="summary-header-info">
          <h2 className="summary-patient-id">Patient {summary.subject_id}</h2>
          <div className="summary-demo-row">
            {demo.gender && <span className="demo-chip">{demo.gender === "F" ? "Female" : demo.gender === "M" ? "Male" : demo.gender}</span>}
            {demo.anchor_age && <span className="demo-chip">Age ~{demo.anchor_age}</span>}
            {demo.dod && <span className="demo-chip deceased">Deceased</span>}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="summary-stats-row">
        <StatCard value={counts.admissions || 0} label="Admissions" accent="#ff9f1c" />
        <StatCard value={counts.icu_stays || 0} label="ICU Stays" accent="#ffd166" />
        <StatCard value={counts.diagnoses || 0} label="Diagnoses" accent="#c084fc" />
        <StatCard value={counts.medications || 0} label="Medications" accent="#4ade80" />
        <StatCard value={counts.labs || 0} label="Lab Results" accent="#fb7185" />
      </div>

      {/* Category cards */}
      <div className="summary-categories">
        <CategoryCard
          title="Diagnoses"
          icon={CATEGORY_ICONS.diagnosis}
          items={summary.diagnoses}
          color={CATEGORY_COLORS.diagnosis}
          onItemClick={onSelectNode}
        />
        <CategoryCard
          title="Medications"
          icon={CATEGORY_ICONS.medication}
          items={summary.medications?.map((m) => ({
            ...m,
            title: m.props?.drug || m.props?.medication || m.source,
          }))}
          color={CATEGORY_COLORS.medication}
          onItemClick={onSelectNode}
        />
        <CategoryCard
          title="Lab Results"
          icon={CATEGORY_ICONS.lab}
          items={summary.labs}
          color={CATEGORY_COLORS.lab}
          onItemClick={onSelectNode}
        />
        <CategoryCard
          title="ICU Stays"
          icon={CATEGORY_ICONS.icu}
          items={summary.icu_stays?.map((s) => ({
            ...s,
            title: `Stay ${s.stay_id} · ${s.first_careunit || "ICU"}`,
          }))}
          color={CATEGORY_COLORS.icu}
          onItemClick={onSelectNode}
        />
      </div>

      {/* Actions */}
      <div className="summary-actions">
        <button className="action-card" onClick={() => onSwitchView("timeline")}>
          <span>📅</span>
          <div>
            <strong>View Timeline</strong>
            <span>See chronological clinical events</span>
          </div>
        </button>
        <button className="action-card" onClick={() => onSwitchView("graph")}>
          <span>🔗</span>
          <div>
            <strong>Explore Connections</strong>
            <span>Visualize the knowledge graph</span>
          </div>
        </button>
        <button className="action-card" onClick={() => onSwitchView("table")}>
          <span>📊</span>
          <div>
            <strong>Data Table</strong>
            <span>Browse nodes and relationships</span>
          </div>
        </button>
      </div>

      {/* Admissions list */}
      {summary.admissions?.length > 0 && (
        <div className="summary-section">
          <div className="section-title">Admissions</div>
          <div className="admissions-list">
            {summary.admissions.map((a, i) => (
              <div key={i} className="admission-card">
                <div className="admission-header">
                  <span className="admission-id">Admission {a.hadm_id}</span>
                  {a.admission_type && <span className="admission-type">{a.admission_type}</span>}
                </div>
                <div className="admission-times">
                  {a.admittime && <span>Admitted: {a.admittime}</span>}
                  {a.dischtime && <span>Discharged: {a.dischtime}</span>}
                </div>
                {a.discharge_location && (
                  <span className="admission-loc">→ {a.discharge_location}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
