import { useState } from "react";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "../utils/labels";

export default function SearchLanding({ onSearch, onPatientSelect, searchResults, loading }) {
  const [query, setQuery] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(query);
  }

  const quickActions = [
    {
      icon: "👤",
      title: "Browse Patients",
      desc: "Look through patient records and their medical history",
      action: () => onSearch("10"),
    },
    {
      icon: "🧬",
      title: "See How It Works",
      desc: "Understand how hospital data connects together",
      action: () => onSearch("schema"),
    },
    {
      icon: "📖",
      title: "Try a Demo Patient",
      desc: "Start with a guided walkthrough of a sample patient",
      action: () => onPatientSelect("10000032"),
    },
  ];

  return (
    <div className="search-landing" id="search-landing">
      <div className="landing-hero">
        <div className="hero-graph-bg">
          <svg viewBox="0 0 400 200" fill="none">
            <circle cx="200" cy="60" r="18" stroke="#38bdf880" strokeWidth="1" fill="rgba(56,189,248,0.04)" />
            <circle cx="120" cy="130" r="14" stroke="#c084fc80" strokeWidth="1" fill="rgba(192,132,252,0.04)" />
            <circle cx="280" cy="130" r="14" stroke="#4ade8080" strokeWidth="1" fill="rgba(74,222,128,0.04)" />
            <circle cx="60" cy="80" r="10" stroke="#fb718580" strokeWidth="1" fill="rgba(251,113,133,0.04)" />
            <circle cx="340" cy="80" r="10" stroke="#fde04780" strokeWidth="1" fill="rgba(253,224,71,0.04)" />
            <circle cx="160" cy="170" r="8" stroke="#22d3ee60" strokeWidth="1" fill="rgba(34,211,238,0.03)" />
            <circle cx="240" cy="170" r="8" stroke="#ff9f1c60" strokeWidth="1" fill="rgba(255,159,28,0.03)" />
            <line x1="200" y1="78" x2="128" y2="118" stroke="#38bdf840" strokeDasharray="4 3" />
            <line x1="200" y1="78" x2="272" y2="118" stroke="#38bdf840" strokeDasharray="4 3" />
            <line x1="134" y1="130" x2="232" y2="170" stroke="#c084fc30" strokeDasharray="4 3" />
            <line x1="266" y1="130" x2="168" y2="170" stroke="#4ade8030" strokeDasharray="4 3" />
            <line x1="70" y1="85" x2="120" y2="120" stroke="#fb718540" strokeDasharray="4 3" />
            <line x1="330" y1="85" x2="280" y2="120" stroke="#fde04740" strokeDasharray="4 3" />
          </svg>
        </div>

        <h1 className="hero-title">Explore Clinical Data, Visually</h1>
        <p className="hero-sub">
          Search for patients, diagnoses, medications, or lab results.
          See how everything connects — and trace it back to the original hospital records.
        </p>

        <form className="search-bar" onSubmit={handleSubmit}>
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            placeholder="Search by patient ID, drug name, diagnosis, or condition…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            id="search-input"
          />
          <button className="search-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Search"}
          </button>
        </form>
      </div>

      {/* Search results */}
      {searchResults && searchResults.results?.length > 0 && (
        <div className="search-results">
          <div className="results-header">
            <span className="results-count">{searchResults.count} results</span>
            <span className="results-query">for "{searchResults.query}"</span>
          </div>
          <div className="results-list">
            {searchResults.results.map((r, i) => (
              <button
                key={i}
                className="result-card"
                onClick={() => {
                  if (r.category === "patient") onPatientSelect(r.identity);
                }}
              >
                <span className="result-icon">{CATEGORY_ICONS[r.category] || "📋"}</span>
                <div className="result-info">
                  <span className="result-identity">{r.identity}</span>
                  <span className="result-category" style={{ color: CATEGORY_COLORS[r.category] }}>
                    {r.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {searchResults && searchResults.results?.length === 0 && (
        <div className="search-empty">No results for "{searchResults.query}"</div>
      )}

      {/* Quick actions */}
      {!searchResults && (
        <div className="quick-actions">
          {quickActions.map((a, i) => (
            <button key={i} className="quick-card" onClick={a.action}>
              <span className="quick-icon">{a.icon}</span>
              <div className="quick-info">
                <span className="quick-title">{a.title}</span>
                <span className="quick-desc">{a.desc}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="landing-tips">
        <div className="tip"><span>🖱️</span><span><strong>Drag</strong> to rotate the 3D view</span></div>
        <div className="tip"><span>🔍</span><span><strong>Scroll</strong> to zoom in and out</span></div>
        <div className="tip"><span>👆</span><span><strong>Click</strong> anything to see details</span></div>
        <div className="tip"><span>🔀</span><span><strong>Switch views</strong> at the top</span></div>
      </div>
    </div>
  );
}
