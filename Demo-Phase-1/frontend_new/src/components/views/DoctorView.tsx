"use client";
import { useState } from "react";
import {
  Heart,
  Pill,
  FlaskConical,
  Stethoscope,
  Calendar,
  ChevronRight,
  AlertTriangle,
  ClipboardList,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { nodeDisplayName } from "@/lib/labels";
import { ContextMenu, type MenuEntry } from "@/components/ui/context-menu";
import type { PatientSummary, MedicationItem, LabItem, DiagnosisItem } from "@/lib/api";

/**
 * Resolves the best display title for a summary item.
 * Falls back to nodeDisplayName (which checks all known property fields)
 * when the backend-provided title is a raw ID or generic placeholder.
 */
function smartTitle(item: { title: string; props: Record<string, unknown>; labels?: string[] }): string {
  const t = item.title;
  // If title is meaningful (not a number, not "Medication", not "Lab"), use it
  if (t && !/^\d+$/.test(t) && t !== "Medication" && t !== "Lab" && t !== "Unknown") {
    return t;
  }
  // Otherwise dig into props for a better name
  return nodeDisplayName(item.props, item.labels);
}

interface DoctorViewProps {
  summary: PatientSummary;
  onSwitchView: (view: string) => void;
  onSelectNode: (nodeId: string) => void;
}

type DoctorTab = "overview" | "diagnoses" | "medications" | "labs";

export default function DoctorView({
  summary,
  onSwitchView,
  onSelectNode,
}: DoctorViewProps) {
  const d = summary.demographics;
  const [activeTab, setActiveTab] = useState<DoctorTab>("overview");

  const tabs: { key: DoctorTab; label: string; icon: React.ElementType; count: number; color: string }[] = [
    { key: "overview", label: "Overview", icon: ClipboardList, count: 0, color: "text-teal-400" },
    { key: "diagnoses", label: "Diagnoses", icon: Heart, count: summary.counts.diagnoses, color: "text-violet-400" },
    { key: "medications", label: "Medications", icon: Pill, count: summary.counts.medications, color: "text-emerald-400" },
    { key: "labs", label: "Lab Results", icon: FlaskConical, count: summary.counts.labs, color: "text-amber-400" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-up">
      {/* Patient header — always visible */}
      <div className="glass p-5 flex items-start gap-4 mb-5">
        <div className="w-14 h-14 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
          <Stethoscope className="w-7 h-7 text-teal-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-100">
              Patient {summary.subject_id}
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Doctor View
            </span>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            {d.gender && (
              <span className="flex items-center gap-1">
                {d.gender === "M" ? "♂ Male" : d.gender === "F" ? "♀ Female" : d.gender}
              </span>
            )}
            {d.anchor_age != null && <span>Age ~{d.anchor_age}</span>}
            {d.anchor_year && <span>Year ref: {d.anchor_year}</span>}
            {d.dod && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="w-3 h-3" />
                Deceased ({d.dod})
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="hidden sm:flex gap-3">
          {[
            { label: "Visits", value: summary.counts.admissions, color: "text-orange-400" },
            { label: "ICU", value: summary.counts.icu_stays, color: "text-pink-400" },
          ].map((m) => (
            <div key={m.label} className="text-center px-3 py-2 bg-slate-800/40 rounded-lg">
              <p className={cn("text-xl font-bold tabular-nums", m.color)}>{m.value}</p>
              <p className="text-[10px] text-slate-500">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* In-page tab navigation */}
      <div className="flex gap-1 mb-5 border-b border-white/[0.06] pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all",
                active
                  ? "border-teal-400 text-teal-400"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
              )}
            >
              <Icon className={cn("w-4 h-4", active ? tab.color : "text-slate-500")} />
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full",
                  active ? "bg-teal-500/15 text-teal-400" : "bg-slate-800 text-slate-500"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Timeline link on right side */}
        <button
          onClick={() => onSwitchView("timeline")}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" />
          View Timeline
        </button>
      </div>

      {/* ═══ TAB: Overview ═══ */}
      {activeTab === "overview" && (
        <div className="space-y-5 animate-fade-up">
          {/* Key metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Hospital Visits", value: summary.counts.admissions, color: "text-orange-400", bg: "bg-orange-500/10" },
              { label: "ICU Stays", value: summary.counts.icu_stays, color: "text-pink-400", bg: "bg-pink-500/10" },
              { label: "Diagnoses", value: summary.counts.diagnoses, color: "text-violet-400", bg: "bg-violet-500/10" },
              { label: "Medications", value: summary.counts.medications, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Lab Tests", value: summary.counts.labs, color: "text-amber-400", bg: "bg-amber-500/10" },
            ].map((m) => (
              <div key={m.label} className={cn("glass p-4 text-center border-l-2", m.color.replace("text-", "border-"))}>
                <p className={cn("text-3xl font-bold tabular-nums", m.color)}>{m.value}</p>
                <p className="text-xs text-slate-500 mt-1">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Top diagnoses preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-violet-400" />
                Top Diagnoses
              </h3>
              <div className="space-y-1">
                {summary.diagnoses.slice(0, 5).map((dx) => (
                  <button
                    key={dx.id}
                    onClick={() => onSelectNode(dx.id)}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800/50 transition-colors text-sm text-slate-300"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    <span className="truncate">{smartTitle(dx)}</span>
                  </button>
                ))}
                {summary.diagnoses.length > 5 && (
                  <button
                    onClick={() => setActiveTab("diagnoses")}
                    className="text-xs text-teal-400 hover:underline px-2 pt-1"
                  >
                    View all {summary.diagnoses.length} →
                  </button>
                )}
              </div>
            </div>

            <div className="glass p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <Pill className="w-3.5 h-3.5 text-emerald-400" />
                Active Medications
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {summary.medications.slice(0, 12).map((med) => (
                  <button
                    key={med.id}
                    onClick={() => onSelectNode(med.id)}
                    className="px-2 py-1 rounded-md text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20 transition-all"
                  >
                    {med.title}
                  </button>
                ))}
                {summary.medications.length > 12 && (
                  <button
                    onClick={() => setActiveTab("medications")}
                    className="px-2 py-1 text-xs text-teal-400 hover:underline"
                  >
                    +{summary.medications.length - 12} more
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Clinical alert / deceased warning */}
          {d.dod && (
            <div className="glass p-4 border-l-2 border-red-400 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400">Patient Deceased</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Date of death recorded as {d.dod}. All records reflect historical data.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Diagnoses ═══ */}
      {activeTab === "diagnoses" && (
        <div className="space-y-1 animate-fade-up">
          {summary.diagnoses.map((dx) => {
            const contextItems: MenuEntry[] = [
              { label: "View Details", onClick: () => onSelectNode(dx.id) },
              { label: "Show in Timeline", onClick: () => onSwitchView("timeline") },
              { label: "Find Related Items", onClick: () => onSelectNode(dx.id) },
              { type: "separator" },
              { label: "Copy Diagnosis", onClick: () => navigator.clipboard.writeText(smartTitle(dx)) },
            ];
            return (
              <ContextMenu key={dx.id} items={contextItems}>
                <button
                  onClick={() => onSelectNode(dx.id)}
                  className="w-full text-left glass px-4 py-3 flex items-center gap-3 hover:border-violet-500/30 transition-colors group"
                >
                  <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate group-hover:text-violet-300 transition-colors">
                      {smartTitle(dx)}
                    </p>
                    <div className="flex gap-2 mt-0.5">
                      {dx.icd_code && <span className="text-[10px] text-slate-500">ICD: {dx.icd_code}</span>}
                      {dx.source && <span className="text-[10px] text-slate-600">Source: {dx.source}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              </ContextMenu>
            );
          })}
        </div>
      )}

      {/* ═══ TAB: Medications ═══ */}
      {activeTab === "medications" && (
        <div className="space-y-1 animate-fade-up">
          {summary.medications.map((med) => {
            const contextItems: MenuEntry[] = [
              { label: "View Details", onClick: () => onSelectNode(med.id) },
              { label: "Show in Timeline", onClick: () => onSwitchView("timeline") },
              { type: "separator" },
              { label: "Copy Name", onClick: () => navigator.clipboard.writeText(smartTitle(med)) },
            ];
            return (
              <ContextMenu key={med.id} items={contextItems}>
                <button
                  onClick={() => onSelectNode(med.id)}
                  className="w-full text-left glass px-4 py-3 flex items-center gap-3 hover:border-emerald-500/30 transition-colors group"
                >
                  <Pill className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate group-hover:text-emerald-300 transition-colors">
                      {smartTitle(med)}
                    </p>
                    {med.source && <p className="text-[10px] text-slate-500">Source: {med.source}</p>}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              </ContextMenu>
            );
          })}
        </div>
      )}

      {/* ═══ TAB: Labs ═══ */}
      {activeTab === "labs" && (
        <div className="space-y-1 animate-fade-up">
          {summary.labs.map((lab) => {
            const contextItems: MenuEntry[] = [
              { label: "View Details", onClick: () => onSelectNode(lab.id) },
              { label: "Show in Timeline", onClick: () => onSwitchView("timeline") },
            ];
            return (
              <ContextMenu key={lab.id} items={contextItems}>
                <button
                  onClick={() => onSelectNode(lab.id)}
                  className="w-full text-left glass px-4 py-3 flex items-center gap-3 hover:border-amber-500/30 transition-colors group"
                >
                  <FlaskConical className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate group-hover:text-amber-300 transition-colors">
                      {smartTitle(lab)}
                    </p>
                    {lab.source && <p className="text-[10px] text-slate-500">Source: {lab.source}</p>}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              </ContextMenu>
            );
          })}
        </div>
      )}
    </div>
  );
}
