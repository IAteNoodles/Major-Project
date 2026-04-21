import ModeSwitch from "./ModeSwitch";

export default function TopBar({
  status,
  subjectId,
  onSubjectChange,
  patients,
  patSearch,
  onPatSearchChange,
  onVisualize,
  loading,
  hasPatient,
}) {
  const filteredPatients = patSearch
    ? patients.filter((p) => String(p).includes(patSearch))
    : patients;

  return (
    <header className="topbar" id="topbar">
      <div className="brand">
        <div className="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <circle cx="4" cy="5" r="2" />
            <circle cx="20" cy="5" r="2" />
            <circle cx="4" cy="19" r="2" />
            <circle cx="20" cy="19" r="2" />
            <line x1="12" y1="9" x2="5.4" y2="6.6" />
            <line x1="12" y1="9" x2="18.6" y2="6.6" />
            <line x1="12" y1="15" x2="5.4" y2="17.4" />
            <line x1="12" y1="15" x2="18.6" y2="17.4" />
          </svg>
        </div>
        <div>
          <div className="brand-title">Clinical Explorer</div>
          <div className="brand-sub">MIMIC-IV Knowledge Graph</div>
        </div>
      </div>

      <ModeSwitch />

      <div className="topbar-controls">
        <input
          className="pat-search"
          placeholder="Find patient…"
          value={patSearch}
          onChange={(e) => onPatSearchChange(e.target.value)}
          id="patient-search-input"
        />
        <div className="ctrl-stack">
          <span className="ctrl-label">Patient</span>
          <select
            className="ctrl-select"
            value={subjectId}
            onChange={(e) => onSubjectChange(e.target.value)}
            id="patient-select"
          >
            <option value="">Pick a patient…</option>
            {filteredPatients.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
        <button
          className="load-btn"
          onClick={onVisualize}
          disabled={loading || !subjectId}
          id="visualize-btn"
        >
          {loading ? (
            <>
              <span className="spinner" />
              Loading…
            </>
          ) : (
            "Explore"
          )}
        </button>
        <div className={`status-pill s-${status.type}`}>
          <span className="status-dot" />
          {status.text}
        </div>
      </div>
    </header>
  );
}
