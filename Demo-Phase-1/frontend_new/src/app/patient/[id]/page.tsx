"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMode } from "@/hooks/useMode";
import {
  useHealth,
  usePatientSummary,
  usePatientTimeline,
  usePatientGraph,
  useNodeEvidence,
  useEdgeEvidence,
} from "@/hooks/usePatientQuery";
import TopBar from "@/components/shell/TopBar";
import Sidebar from "@/components/shell/Sidebar";
import DetailDrawer from "@/components/shell/DetailDrawer";
import DoctorView from "@/components/views/DoctorView";
import LearnView from "@/components/views/LearnView";
import TimelineView from "@/components/views/TimelineView";
import TableView from "@/components/views/TableView";
import dynamic from "next/dynamic";

// Dynamic import — Sigma.js uses WebGL which is browser-only
const GraphView = dynamic(() => import("@/components/views/GraphView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="glass p-6 flex flex-col items-center gap-3 animate-fade-up">
        <div className="w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
        <p className="text-sm text-slate-300">Loading graph engine…</p>
      </div>
    </div>
  ),
});
import type { NodePayload, RelPayload, TimelineEvent } from "@/lib/api";

export default function PatientPage() {
  const params = useParams();
  const patientId = params.id as string;
  const router = useRouter();
  const { mode, config } = useMode();

  // Track the previous mode so we can auto-switch view when mode changes
  const prevModeRef = useRef(mode);

  // UI state
  const [currentView, setCurrentView] = useState(config.defaultView);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Auto-switch view when mode changes
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setCurrentView(config.defaultView);
      // Close any open detail drawer on mode switch
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [mode, config.defaultView]);

  // Data queries
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: summary, isLoading: summaryLoading } = usePatientSummary(patientId);
  const { data: timeline, isLoading: timelineLoading } = usePatientTimeline(patientId);
  const { data: graph, isLoading: graphLoading } = usePatientGraph(patientId, config.graphDefaults);
  const { data: nodeEvidence, isLoading: nodeEvidenceLoading } = useNodeEvidence(selectedNodeId);
  const { data: edgeEvidence, isLoading: edgeEvidenceLoading } = useEdgeEvidence(selectedEdgeId);

  const evidence = selectedNodeId ? nodeEvidence : selectedEdgeId ? edgeEvidence : null;
  const evidenceLoading = nodeEvidenceLoading || edgeEvidenceLoading;

  // Handlers
  const handleSearch = useCallback(
    (query: string) => {
      if (/^\d+$/.test(query)) router.push(`/patient/${query}`);
    },
    [router]
  );

  const handleNodeClick = useCallback((node: NodePayload) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const handleRelClick = useCallback((rel: RelPayload) => {
    setSelectedEdgeId(rel.id);
    setSelectedNodeId(null);
  }, []);

  const handleTimelineEvent = useCallback((ev: TimelineEvent) => {
    if (ev.node_id) {
      setSelectedNodeId(ev.node_id);
      setSelectedEdgeId(null);
    }
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const handleToggleCategory = useCallback((cat: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleSelectNodeById = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  }, []);

  const handleViewChange = useCallback((view: string) => {
    setCurrentView(view);
  }, []);

  // Only show loading for the data needed by the current mode's default view
  const isInitialLoading =
    (mode === "doctor" && summaryLoading) ||
    (mode === "learn" && (summaryLoading || timelineLoading)) ||
    (mode === "research" && graphLoading);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        health={health ?? null}
        healthLoading={healthLoading}
        onSearch={handleSearch}
        patientId={patientId}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Only show sidebar in research mode — doctor and learn are single-view modes */}
        {mode === "research" && (
          <Sidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
            graphMeta={graph?.meta}
            hiddenCategories={hiddenCategories}
            onToggleCategory={handleToggleCategory}
          />
        )}

        {/* Center content */}
        <main className="flex-1 overflow-y-auto relative">
          {/* Loading overlay */}
          {isInitialLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
              <div className="glass p-6 flex flex-col items-center gap-3 animate-fade-up">
                <div className="w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
                <p className="text-sm text-slate-300">Loading patient data…</p>
              </div>
            </div>
          )}

          {/* ═══ DOCTOR MODE ═══ Single full-page clinical summary, no sidebar. */}
          {mode === "doctor" && summary && currentView === "summary" && (
            <DoctorView
              summary={summary}
              onSwitchView={handleViewChange}
              onSelectNode={handleSelectNodeById}
            />
          )}
          {mode === "doctor" && timeline && currentView === "timeline" && (
            <TimelineView
              timeline={timeline}
              onSelectEvent={handleTimelineEvent}
              onSwitchView={handleViewChange}
              hiddenCategories={hiddenCategories}
            />
          )}

          {/* ═══ LEARN MODE ═══ Educational view with insights and annotated charts. */}
          {mode === "learn" && summary && currentView === "learn" && (
            <LearnView
              summary={summary}
              timeline={timeline}
              onSwitchView={handleViewChange}
              onSelectNode={handleSelectNodeById}
            />
          )}

          {/* ═══ DEEP DIVE (RESEARCH) MODE ═══ Full toolset: graph, timeline, table, summary. */}
          {mode === "research" && currentView === "summary" && summary && (
            <DoctorView
              summary={summary}
              onSwitchView={handleViewChange}
              onSelectNode={handleSelectNodeById}
            />
          )}
          {mode === "research" && currentView === "graph" && graph && (
            <GraphView
              graph={graph}
              hiddenCategories={hiddenCategories}
              onNodeClick={handleNodeClick}
              onLinkClick={handleRelClick}
              onSwitchView={handleViewChange}
            />
          )}
          {mode === "research" && currentView === "timeline" && timeline && (
            <TimelineView
              timeline={timeline}
              onSelectEvent={handleTimelineEvent}
              onSwitchView={handleViewChange}
              hiddenCategories={hiddenCategories}
            />
          )}
          {mode === "research" && currentView === "table" && graph && (
            <TableView
              graph={graph}
              onNodeClick={handleNodeClick}
              onRelClick={handleRelClick}
              onSwitchView={handleViewChange}
            />
          )}

          {/* Empty state */}
          {!isInitialLoading && !summary && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <p className="text-slate-400 text-sm">No data found for patient {patientId}</p>
                <button onClick={() => router.push("/")} className="text-xs text-teal-400 hover:underline">
                  ← Back to search
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Detail drawer */}
        {(evidence || evidenceLoading) && (
          <DetailDrawer
            evidence={evidence ?? null}
            loading={evidenceLoading}
            onClose={handleCloseDrawer}
            onSelectNode={handleSelectNodeById}
          />
        )}
      </div>
    </div>
  );
}
