"use client";
import { useState } from "react";
import { Search, Activity, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMode } from "@/hooks/useMode";
import type { HealthResponse } from "@/lib/api";

interface TopBarProps {
  health?: HealthResponse | null;
  healthLoading: boolean;
  onSearch: (query: string) => void;
  patientId?: string | null;
}

export default function TopBar({
  health,
  healthLoading,
  onSearch,
  patientId,
}: TopBarProps) {
  const { mode, config, allModes, setMode } = useMode();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  }

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center gap-4 px-4 border-b border-white/[0.06] bg-slate-900/80 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-2 shrink-0">
        <Activity className="w-5 h-5 text-teal-400" />
        <div>
          <h1 className="text-sm font-semibold text-slate-100 leading-tight">
            Clinical Explorer
          </h1>
          <p className="text-[10px] text-slate-500 leading-tight">
            MIMIC-IV Knowledge Graph
          </p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient ID, drug, diagnosis…"
            className={cn(
              "w-full h-9 pl-9 pr-3 text-sm rounded-lg",
              "bg-slate-800/60 border border-white/[0.08]",
              "text-slate-200 placeholder:text-slate-500",
              "focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20",
              "transition-all duration-200"
            )}
          />
        </div>
      </form>

      {/* Mode switcher */}
      <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-0.5 border border-white/[0.06]">
        {allModes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            title={m.description}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
              mode === m.key
                ? "bg-teal-500/15 text-teal-400 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            )}
          >
            <span className="mr-1.5">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* Patient badge */}
      {patientId && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/20">
          <span className="text-xs text-teal-400 font-medium">
            Patient {patientId}
          </span>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-1.5 shrink-0">
        {healthLoading ? (
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        ) : health ? (
          <Wifi className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-400" />
        )}
        <span className="text-[10px] text-slate-500 hidden md:block">
          {healthLoading
            ? "Connecting…"
            : health
            ? health.database
            : "Disconnected"}
        </span>
      </div>
    </header>
  );
}
