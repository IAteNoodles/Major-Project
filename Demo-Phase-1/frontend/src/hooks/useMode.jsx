import { createContext, useContext, useState, useCallback } from "react";

const MODE_CONFIGS = {
  clinical: {
    label: "Doctor View",
    icon: "🩺",
    nodeCap: 40,
    showGraph: false,
    showTimeline: true,
    showSummary: true,
    defaultView: "summary",
    labelStyle: "natural",
    showEditTools: false,
    showDepthControls: false,
    showExport: false,
    semanticColors: 6,
    description: "Simple overview — patient summary, timeline, key info at a glance",
  },
  research: {
    label: "Deep Dive",
    icon: "🔬",
    nodeCap: 1000,
    showGraph: true,
    showTimeline: true,
    showSummary: true,
    defaultView: "graph",
    labelStyle: "technical",
    showEditTools: true,
    showDepthControls: true,
    showExport: true,
    semanticColors: 13,
    description: "Full graph explorer — all connections, filters, and data export",
  },
  learning: {
    label: "Learn",
    icon: "📚",
    nodeCap: 100,
    showGraph: true,
    showTimeline: true,
    showSummary: true,
    defaultView: "summary",
    labelStyle: "annotated",
    showEditTools: false,
    showDepthControls: true,
    showExport: false,
    semanticColors: 13,
    description: "Guided tour — explains how hospital data connects together",
  },
};

const ModeContext = createContext(null);

export function ModeProvider({ children }) {
  const [mode, setModeRaw] = useState(
    () => localStorage.getItem("kg-mode") || "clinical"
  );

  const setMode = useCallback((m) => {
    setModeRaw(m);
    localStorage.setItem("kg-mode", m);
  }, []);

  const config = MODE_CONFIGS[mode] || MODE_CONFIGS.clinical;

  return (
    <ModeContext.Provider value={{ mode, setMode, config, MODE_CONFIGS }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
