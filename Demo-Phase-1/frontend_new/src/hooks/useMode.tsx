"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type Mode = "doctor" | "learn" | "research";

export interface ModeConfig {
  key: Mode;
  label: string;
  icon: string;
  description: string;
  defaultView: string;
  graphDefaults: {
    depth: number;
    eventLimit: number;
    maxNodes: number;
  };
}

const MODE_CONFIGS: Record<Mode, ModeConfig> = {
  doctor: {
    key: "doctor",
    label: "Doctor View",
    icon: "🩺",
    description: "Clinical summary with quick access to key diagnoses, medications, and lab results. Graph loads only when you need it.",
    defaultView: "summary",
    graphDefaults: { depth: 1, eventLimit: 50, maxNodes: 80 },
  },
  learn: {
    key: "learn",
    label: "Learn",
    icon: "📚",
    description: "Understand what the data means. See insights, statistical summaries, and annotated visualizations that explain how hospital records connect.",
    defaultView: "learn",
    graphDefaults: { depth: 1, eventLimit: 50, maxNodes: 80 },
  },
  research: {
    key: "research",
    label: "Deep Dive",
    icon: "🔬",
    description: "Full exploratory tools. Expand the graph, adjust depth and limits, filter by entity type, and export data for analysis.",
    defaultView: "graph",
    graphDefaults: { depth: 2, eventLimit: 200, maxNodes: 500 },
  },
};

interface ModeContextValue {
  mode: Mode;
  config: ModeConfig;
  allModes: ModeConfig[];
  setMode: (m: Mode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("doctor");

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
  }, []);

  const value: ModeContextValue = {
    mode,
    config: MODE_CONFIGS[mode],
    allModes: Object.values(MODE_CONFIGS),
    setMode,
  };

  return (
    <ModeContext.Provider value={value}>{children}</ModeContext.Provider>
  );
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be inside ModeProvider");
  return ctx;
}
