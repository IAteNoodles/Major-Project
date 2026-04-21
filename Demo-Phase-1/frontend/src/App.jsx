import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { ModeProvider, useMode } from "./hooks/useMode";
import { usePatientData } from "./hooks/usePatientData";
import TopBar from "./components/TopBar";
import SearchLanding from "./components/SearchLanding";
import LeftPanel from "./components/LeftPanel";
import RightPanel from "./components/RightPanel";
import SummaryView from "./components/views/SummaryView";
import TimelineView from "./components/views/TimelineView";
import GraphView from "./components/views/GraphView";
import TableView from "./components/views/TableView";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function mainLabel(labels) {
  if (!labels?.length) return "Node";
  const prio = ["Patient", "Admission", "ICUStay", "ClinicalEvent"];
  for (const p of prio) if (labels.includes(p)) return p;
  return labels[0];
}

function countByLabel(nodes) {
  const counts = {};
  for (const n of nodes) {
    const label = mainLabel(n.labels);
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

function AppInner() {
  const { config } = useMode();
  const data = usePatientData();

  const [subjectId, setSubjectId] = useState("");
  const [patSearch, setPatSearch] = useState("");
  const [currentView, setCurrentView] = useState(config.defaultView);
  const [hasPatient, setHasPatient] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedRel, setSelectedRel] = useState(null);
  const [status, setStatus] = useState({ type: "idle", text: "Ready" });
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // Depth/event controls for research mode
  const [depth, setDepth] = useState(2);
  const [eventLimit, setEventLimit] = useState(260);
  const [maxNodes, setMaxNodes] = useState(620);

  // Init: fetch patients + health check
  useEffect(() => {
    async function init() {
      try {
        const [health] = await Promise.all([
          axios.get(`${API_BASE}/api/health`),
          data.fetchPatients(800),
        ]);
        setStatus({ type: "ok", text: `Connected · ${health.data.database}` });
      } catch (err) {
        setStatus({
          type: "err",
          text: err?.response?.data?.detail || err.message,
        });
      }
    }
    init();
  }, []);

  // When mode changes, switch to default view
  useEffect(() => {
    if (!hasPatient) return;
    setCurrentView(config.defaultView);
  }, [config.defaultView]);

  const isLoading = data.loading.summary || data.loading.timeline || data.loading.graph;

  async function handleVisualize() {
    if (!subjectId) return;
    setStatus({ type: "ok", text: "Loading…" });
    setSelectedNode(null);
    setSelectedRel(null);

    try {
      await data.loadPatient(subjectId, { depth, eventLimit, maxNodes });
      setHasPatient(true);
      setCurrentView(config.defaultView);

      const nodeCount = data.graph?.meta?.node_count || 0;
      const relCount = data.graph?.meta?.relationship_count || 0;
      const truncated = data.graph?.meta?.truncated;
      setStatus({
        type: truncated ? "warn" : "ok",
        text: truncated
          ? `${nodeCount} items (partial view)`
          : `${nodeCount} items · ${relCount} connections`,
      });
    } catch {
      setStatus({ type: "err", text: "Failed to load patient data" });
    }
  }

  function handlePatientSelect(id) {
    setSubjectId(String(id));
    setTimeout(() => {
      setSubjectId(String(id));
      handleVisualize();
    }, 50);
  }

  function handleSearch(query) {
    data.fetchSearch(query);
  }

  function handleToggleType(label) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function handleNodeClick(node) {
    const nodeData = node.raw || node;
    setSelectedNode(nodeData);
    setSelectedRel(null);
    data.fetchEvidence("node", nodeData.id);
  }

  function handleLinkClick(link) {
    const relData = link.raw || link;
    setSelectedRel(relData);
    setSelectedNode(null);
    data.fetchEvidence("edge", relData.id);
  }

  function handleTimelineEvent(ev) {
    if (ev.node_id) {
      setSelectedNode({ id: ev.node_id, labels: [ev.category], props: ev.props });
      setSelectedRel(null);
      data.fetchEvidence("node", ev.node_id);
    }
  }

  const nodeTypeCounts = data.graph?.nodes ? countByLabel(data.graph.nodes) : {};

  // Determine loading message
  const loadMsg = data.loadingMessage || (isLoading ? "Loading…" : "");

  return (
    <div className="app">
      <TopBar
        status={loadMsg ? { type: "ok", text: loadMsg } : status}
        subjectId={subjectId}
        onSubjectChange={setSubjectId}
        patients={data.patients}
        patSearch={patSearch}
        onPatSearchChange={setPatSearch}
        onVisualize={handleVisualize}
        loading={isLoading}
        hasPatient={hasPatient}
      />

      {!hasPatient ? (
        <SearchLanding
          onSearch={handleSearch}
          onPatientSelect={handlePatientSelect}
          searchResults={data.searchResults}
          loading={data.loading.search}
        />
      ) : (
        <div className="workspace three-panel">
          {/* Left panel */}
          <LeftPanel
            currentView={currentView}
            onViewChange={setCurrentView}
            hiddenTypes={hiddenTypes}
            onToggleType={handleToggleType}
            nodeTypeCounts={nodeTypeCounts}
            hasData={!!data.graph?.nodes?.length}
            graphMeta={data.graph?.meta}
          />

          {/* Center — active view */}
          <main className="center-panel" id="center-panel">
            {/* Loading overlay */}
            {isLoading && (
              <div className="loading-overlay">
                <div className="loading-card">
                  <span className="spinner large" />
                  <span className="loading-msg">{loadMsg || "Loading patient data…"}</span>
                  {data.summary?.counts && (
                    <div className="loading-counts">
                      {Object.entries(data.summary.counts).map(([k, v]) => (
                        <span key={k} className="loading-count-chip">{v} {k}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentView === "summary" && (
              <SummaryView
                summary={data.summary}
                onSwitchView={setCurrentView}
                onSelectNode={handleNodeClick}
              />
            )}
            {currentView === "timeline" && (
              <TimelineView
                timeline={data.timeline}
                onSelectEvent={handleTimelineEvent}
              />
            )}
            {currentView === "graph" && (
              <GraphView
                rawGraph={data.graph}
                hiddenTypes={hiddenTypes}
                onNodeClick={handleNodeClick}
                onLinkClick={handleLinkClick}
              />
            )}
            {currentView === "table" && (
              <TableView
                rawGraph={data.graph}
                onNodeClick={handleNodeClick}
                onRelClick={handleLinkClick}
              />
            )}
          </main>

          {/* Right panel — evidence drawer */}
          <RightPanel
            evidence={data.evidence}
            selectedNode={selectedNode}
            selectedRel={selectedRel}
            onSelectNode={handleNodeClick}
            onSwitchView={setCurrentView}
            loading={data.loading.evidence}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ModeProvider>
      <AppInner />
    </ModeProvider>
  );
}
