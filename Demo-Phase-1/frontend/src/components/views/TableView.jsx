import { useMemo, useState } from "react";
import { NL_NODE_LABELS } from "../../utils/labels";

function mainLabel(labels) {
  if (!labels?.length) return "Node";
  const prio = ["Patient", "Admission", "ICUStay", "ClinicalEvent"];
  for (const p of prio) if (labels.includes(p)) return p;
  return labels[0];
}

function friendlyLabel(raw) {
  return NL_NODE_LABELS[raw] || raw;
}

function nodeIdentity(props = {}) {
  if (props.long_title) return props.long_title;
  if (props.drug) return props.drug;
  if (props.medication) return props.medication;
  if (props.label) return props.label;
  const keys = ["subject_id", "hadm_id", "stay_id", "row_uid", "provider_id", "caregiver_id", "itemid", "code", "icd_code"];
  for (const k of keys) if (props[k] != null) return `${k}: ${props[k]}`;
  return "–";
}

// Human-friendly relationship type names
const REL_FRIENDLY = {
  HAS_ADMISSION: "Admitted",
  HAS_ICUSTAY: "ICU Stay",
  HAS_EVENT: "Event",
  HAS_ORDER: "Order",
  HAS_PHARMACY_ORDER: "Pharmacy Order",
  ORDERED_EVENT: "Ordered",
  RECORDED_EVENT: "Recorded By",
  USES_ICD_DIAGNOSIS: "Diagnosed With",
  USES_ICD_PROCEDURE: "Procedure Done",
  USES_HCPCS: "Billed As",
  MEASURES_LAB_ITEM: "Lab Test",
  HAS_SPECIMEN_ITEM: "Sample",
  HAS_TEST_ITEM: "Test",
  FROM_POE_ORDER: "From Order",
  FROM_PHARMACY_DISPENSE: "Dispensed",
  DETAIL_OF: "Detail",
  MEASURES_ICU_ITEM: "ICU Reading",
  USES_ICU_ITEM: "ICU Item",
  PLACED_ORDER: "Order Placed",
  DISPENSES_FOR_ORDER: "Dispensed For",
};

const TABS = ["items", "connections"];

export default function TableView({ rawGraph, onNodeClick, onRelClick }) {
  const [tab, setTab] = useState("items");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("label");
  const [sortDir, setSortDir] = useState(1);

  const nodes = useMemo(() => {
    if (!rawGraph?.nodes) return [];
    let list = rawGraph.nodes.map((n) => ({
      id: n.id,
      label: mainLabel(n.labels),
      friendlyLabel: friendlyLabel(mainLabel(n.labels)),
      labels: n.labels.map(friendlyLabel).join(", "),
      identity: nodeIdentity(n.props),
      source_table: n.props?.source_table || "",
      raw: n,
    }));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        n.friendlyLabel.toLowerCase().includes(q) ||
        n.identity.toLowerCase().includes(q) ||
        n.source_table.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = a[sortKey] || "";
      const bv = b[sortKey] || "";
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });
    return list;
  }, [rawGraph, search, sortKey, sortDir]);

  const rels = useMemo(() => {
    if (!rawGraph?.relationships) return [];
    let list = rawGraph.relationships.map((r) => ({
      id: r.id,
      type: r.rel_type,
      friendlyType: REL_FRIENDLY[r.rel_type] || r.rel_type.replace(/_/g, " ").toLowerCase(),
      start: r.start_id,
      end: r.end_id,
      raw: r,
    }));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.friendlyType.toLowerCase().includes(q) || r.type.toLowerCase().includes(q));
    }
    return list;
  }, [rawGraph, search]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(-sortDir);
    else { setSortKey(key); setSortDir(1); }
  }

  if (!rawGraph?.nodes?.length) {
    return <div className="view-empty"><p>No data loaded yet.</p></div>;
  }

  return (
    <div className="table-view" id="table-view">
      <div className="table-header">
        <div className="table-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`table-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "items" ? `Items (${rawGraph.nodes.length})` : `Connections (${rawGraph.relationships.length})`}
            </button>
          ))}
        </div>
        <input
          className="table-search"
          placeholder="Filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {tab === "items" && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("friendlyLabel")}>Type {sortKey === "friendlyLabel" ? (sortDir > 0 ? "▲" : "▼") : ""}</th>
                <th onClick={() => toggleSort("identity")}>Description</th>
                <th onClick={() => toggleSort("source_table")}>Source</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.id} onClick={() => onNodeClick(n.raw)} className="table-row-click">
                  <td><span className="table-type-badge">{n.friendlyLabel}</span></td>
                  <td>{n.identity}</td>
                  <td className="table-mono">{n.source_table}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "connections" && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Connection Type</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {rels.map((r) => (
                <tr key={r.id} onClick={() => onRelClick(r.raw)} className="table-row-click">
                  <td><span className="table-type-badge">{r.friendlyType}</span></td>
                  <td className="table-mono">{r.start?.slice(-8)}</td>
                  <td className="table-mono">{r.end?.slice(-8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
