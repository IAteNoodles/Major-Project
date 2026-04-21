import { useRef, useEffect, useState, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import { useMode } from "../../hooks/useMode";
import { getRelLabel, getNodeLabel, NL_NODE_LABELS } from "../../utils/labels";

const NODE_COLORS = {
  Patient: "#ff6b6b", Admission: "#ff9f1c", ICUStay: "#ffd166",
  ClinicalEvent: "#4cc9f0", Provider: "#22d3ee", Caregiver: "#2dd4bf",
  POEOrder: "#86efac", PharmacyDispense: "#4ade80",
  ICDDiagnosisCode: "#c084fc", ICDProcedureCode: "#a78bfa",
  HCPCSCode: "#f472b6", LabItem: "#fb7185", ICUItem: "#fde047",
};

const REL_COLORS = {
  HAS_ADMISSION: "#ff6b6b", HAS_ICUSTAY: "#f59e0b", HAS_EVENT: "#67e8f9",
  ORDERED_EVENT: "#0ea5e9", RECORDED_EVENT: "#2dd4bf",
  USES_ICD_DIAGNOSIS: "#c084fc", USES_ICD_PROCEDURE: "#a78bfa",
  USES_HCPCS: "#f472b6", MEASURES_LAB_ITEM: "#fb7185",
  HAS_SPECIMEN_ITEM: "#f43f5e", HAS_TEST_ITEM: "#ec4899",
  FROM_POE_ORDER: "#86efac", FROM_PHARMACY_DISPENSE: "#4ade80",
  DETAIL_OF: "#94a3b8", MEASURES_ICU_ITEM: "#fde047",
  USES_ICU_ITEM: "#facc15", HAS_ORDER: "#16a34a", HAS_PHARMACY_ORDER: "#22c55e",
};

const REL_IMPORTANCE = {
  HAS_ADMISSION: 5, HAS_ICUSTAY: 5, HAS_ORDER: 4, HAS_PHARMACY_ORDER: 4,
  ORDERED_EVENT: 4, RECORDED_EVENT: 4, FROM_POE_ORDER: 4,
  FROM_PHARMACY_DISPENSE: 4, USES_ICD_DIAGNOSIS: 4, USES_ICD_PROCEDURE: 4,
  MEASURES_LAB_ITEM: 3, MEASURES_ICU_ITEM: 3, USES_ICU_ITEM: 3, HAS_EVENT: 1,
};

function mainLabel(labels) {
  if (!labels?.length) return "Node";
  const prio = ["Patient", "Admission", "ICUStay", "ClinicalEvent"];
  for (const p of prio) if (labels.includes(p)) return p;
  return labels[0];
}

function nodeTooltip(props = {}, label, mode) {
  const friendly = getNodeLabel(label, mode);
  // Try to show a meaningful name
  if (props.long_title) return `${friendly}: ${props.long_title}`;
  if (props.drug) return `${friendly}: ${props.drug}`;
  if (props.medication) return `${friendly}: ${props.medication}`;
  if (props.label) return `${friendly}: ${props.label}`;
  if (props.subject_id) return `${friendly} #${props.subject_id}`;
  if (props.hadm_id) return `${friendly} #${props.hadm_id}`;
  if (props.stay_id) return `${friendly} #${props.stay_id}`;
  return friendly;
}

export default function GraphView({ rawGraph, hiddenTypes, onNodeClick, onLinkClick }) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const { mode } = useMode();

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const graphData = useMemo(() => {
    if (!rawGraph?.nodes) return { nodes: [], links: [] };

    const nodes = rawGraph.nodes.map((n) => {
      const label = mainLabel(n.labels);
      return {
        id: n.id, labels: n.labels, props: n.props, nodeLabel: label,
        color: NODE_COLORS[label] || "#94a3b8",
        val: label === "Patient" ? 20 : label === "Admission" || label === "ICUStay" ? 11 : 6,
        importance: label === "Patient" ? 5 : label === "Admission" || label === "ICUStay" ? 4 : 2,
      };
    });

    const links = rawGraph.relationships.map((r) => ({
      id: r.id, source: r.start_id, target: r.end_id, relType: r.rel_type, props: r.props,
      color: REL_COLORS[r.rel_type] || "#94a3b8",
      width: r.rel_type === "HAS_EVENT" ? 0.65 : r.rel_type === "HAS_ADMISSION" || r.rel_type === "HAS_ICUSTAY" ? 2.9 : 1.7,
      particles: r.rel_type === "HAS_EVENT" ? 0 : r.rel_type === "HAS_ADMISSION" || r.rel_type === "HAS_ICUSTAY" ? 4 : 2,
      importance: REL_IMPORTANCE[r.rel_type] || 2,
    }));

    return { nodes, links };
  }, [rawGraph]);

  const nodeTypeCounts = useMemo(() => {
    const counts = {};
    for (const n of graphData.nodes) counts[n.nodeLabel] = (counts[n.nodeLabel] || 0) + 1;
    return counts;
  }, [graphData.nodes]);

  if (!rawGraph?.nodes?.length) {
    return (
      <div className="view-empty">
        <p>No graph data loaded. Click <strong>Explore</strong> to see how this patient's data connects.</p>
      </div>
    );
  }

  return (
    <div className="graph-view" id="graph-view">
      {/* Floating controls */}
      <div className="graph-ctrl-group">
        <button className="icon-btn" title="Zoom to fit" onClick={() => fgRef.current?.zoomToFit(800, 50)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>

      {/* Metrics — human-friendly type names */}
      <div className="metrics-bar">
        {Object.entries(nodeTypeCounts).map(([type, count]) => (
          <div key={type} className="metric-chip">
            <span className="metric-dot" style={{ background: NODE_COLORS[type] || "#94a3b8" }} />
            <span className="metric-type">{NL_NODE_LABELS[type] || type}</span>
            <span className="metric-count">{count}</span>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="graph-canvas" ref={containerRef}>
        {dims.width > 0 && (
          <ForceGraph3D
            ref={fgRef}
            graphData={graphData}
            width={dims.width}
            height={dims.height}
            backgroundColor="#020b14"
            nodeLabel={(node) => nodeTooltip(node.props, node.nodeLabel, mode)}
            nodeColor={(node) => node.color}
            nodeVal={(node) => node.val}
            nodeOpacity={0.95}
            nodeVisibility={(node) => !hiddenTypes.has(node.nodeLabel)}
            linkColor={(link) => link.color}
            linkWidth={(link) => link.width}
            linkOpacity={0.85}
            linkDirectionalArrowLength={4.2}
            linkDirectionalArrowRelPos={1}
            linkDirectionalParticles={(link) => link.particles}
            linkDirectionalParticleWidth={1.45}
            linkDirectionalParticleSpeed={0.0034}
            linkVisibility={(link) => {
              const src = link.source?.nodeLabel;
              const tgt = link.target?.nodeLabel;
              return !hiddenTypes.has(src) && !hiddenTypes.has(tgt);
            }}
            warmupTicks={28}
            cooldownTicks={85}
            d3VelocityDecay={0.21}
            d3AlphaDecay={0.03}
            onEngineStop={() => fgRef.current?.zoomToFit(1050, 46)}
            nodeThreeObject={(node) => {
              const friendly = getNodeLabel(node.nodeLabel, mode);
              // In clinical mode, show short name. In learning mode, show just the first part before "—"
              const displayText = mode === "learning"
                ? friendly.split("—")[0].trim()
                : (NL_NODE_LABELS[node.nodeLabel] || node.nodeLabel);
              const sprite = new SpriteText(displayText);
              sprite.color = node.color;
              sprite.textHeight = node.importance >= 4 ? 9 : 6;
              sprite.backgroundColor = "rgba(1,11,20,0.55)";
              sprite.padding = 2;
              return sprite;
            }}
            linkThreeObjectExtend
            linkThreeObject={(link) => {
              if ((link.importance || 0) < 4) return null;
              const label = getRelLabel(link.relType, mode);
              const s = new SpriteText(label);
              s.color = link.color;
              s.textHeight = 4.2;
              s.backgroundColor = "rgba(2,11,20,0.75)";
              return s;
            }}
            linkPositionUpdate={(sprite, { start, end }) => {
              if (!sprite || !start || !end) return;
              sprite.position.set(
                start.x + (end.x - start.x) * 0.5,
                start.y + (end.y - start.y) * 0.5,
                start.z + (end.z - start.z) * 0.5
              );
            }}
            onNodeClick={(node) => {
              onNodeClick(node);
              if (fgRef.current) {
                const dist = 180;
                const mag = Math.hypot(node.x || 1, node.y || 1, node.z || 1) || 1;
                const r = 1 + dist / mag;
                fgRef.current.cameraPosition(
                  { x: node.x * r, y: node.y * r, z: node.z * r }, node, 900
                );
              }
            }}
            onLinkClick={onLinkClick}
          />
        )}
      </div>
    </div>
  );
}
