"use client";
import { useState } from "react";
import {
  BookOpen,
  Database,
  BarChart3,
  Lightbulb,
  ArrowRight,
  Layers,
  GitBranch,
  Brain,
  GraduationCap,
  HelpCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { CATEGORY_COLORS, CATEGORY_NAMES, NODE_LABELS, NODE_DESCRIPTIONS, REL_LABELS } from "@/lib/labels";
import type { PatientSummary, TimelineData } from "@/lib/api";

interface LearnViewProps {
  summary: PatientSummary;
  timeline?: TimelineData | null;
  onSwitchView: (view: string) => void;
  onSelectNode: (nodeId: string) => void;
}

type LearnTab = "insights" | "data-map" | "glossary";

export default function LearnView({
  summary,
  timeline,
  onSwitchView,
  onSelectNode,
}: LearnViewProps) {
  const d = summary.demographics;
  const [activeTab, setActiveTab] = useState<LearnTab>("insights");

  const insights = generateInsights(summary, timeline);

  const categoryData = [
    { name: "Diagnoses", value: summary.counts.diagnoses, color: CATEGORY_COLORS.diagnosis },
    { name: "Medications", value: summary.counts.medications, color: CATEGORY_COLORS.medication },
    { name: "Lab Tests", value: summary.counts.labs, color: CATEGORY_COLORS.lab },
    { name: "ICU Stays", value: summary.counts.icu_stays, color: CATEGORY_COLORS.icu },
    { name: "Visits", value: summary.counts.admissions, color: CATEGORY_COLORS.encounter },
  ].filter((d) => d.value > 0);

  const timelineCats: Record<string, number> = {};
  if (timeline?.events) {
    for (const ev of timeline.events) {
      const cat = ev.category || "other";
      timelineCats[cat] = (timelineCats[cat] || 0) + 1;
    }
  }
  const timelineChartData = Object.entries(timelineCats)
    .map(([cat, count]) => ({
      name: CATEGORY_NAMES[cat] || cat,
      count,
      fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other,
    }))
    .sort((a, b) => b.count - a.count);

  const tabs: { key: LearnTab; label: string; icon: React.ElementType }[] = [
    { key: "insights", label: "Insights & Charts", icon: Lightbulb },
    { key: "data-map", label: "How It Works", icon: GitBranch },
    { key: "glossary", label: "Term Glossary", icon: GraduationCap },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="glass p-5 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-100">
                Learning Summary — Patient {summary.subject_id}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Learn Mode
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              A breakdown of what we know about this patient and how hospital data becomes a knowledge graph
            </p>
          </div>
        </div>

        {/* Patient quick facts with annotations */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            {
              label: "Sex",
              value: d.gender === "M" ? "Male" : d.gender === "F" ? "Female" : d.gender || "—",
              tip: "Biological sex from patient demographics table",
              icon: "♀♂",
            },
            {
              label: "Approximate Age",
              value: d.anchor_age != null ? `~${d.anchor_age}` : "—",
              tip: "Age is shifted for patient privacy (MIMIC de-identification)",
              icon: "🎂",
            },
            {
              label: "Reference Year",
              value: d.anchor_year ? String(d.anchor_year) : "—",
              tip: "Year anchor used for date-shifting all timestamps",
              icon: "📅",
            },
            {
              label: "Status",
              value: d.dod ? "Deceased" : "Alive at last record",
              tip: "Based on date_of_death field in MIMIC-IV patients table",
              icon: d.dod ? "⚠" : "✓",
              alert: !!d.dod,
            },
          ].map((fact) => (
            <div key={fact.label} className="bg-slate-800/40 rounded-lg p-3 group relative" title={fact.tip}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs text-slate-500">{fact.label}</span>
                <HelpCircle className="w-3 h-3 text-slate-600 group-hover:text-violet-400 transition-colors" />
              </div>
              <p className={cn("text-sm font-semibold", fact.alert ? "text-red-400" : "text-slate-200")}>
                {fact.value}
              </p>
              <p className="text-[10px] text-slate-600 mt-1 leading-tight opacity-0 group-hover:opacity-100 transition-opacity">
                {fact.tip}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab navigation */}
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
                  ? "border-violet-400 text-violet-400"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB: Insights & Charts ═══ */}
      {activeTab === "insights" && (
        <div className="space-y-6 animate-fade-up">
          {/* Data-driven insights */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-amber-400" />
              What the Data Tells Us
            </h3>
            <div className="space-y-2">
              {insights.map((insight, i) => (
                <div key={i} className="glass px-4 py-3 flex items-start gap-3">
                  <span className="text-lg shrink-0">{insight.icon}</span>
                  <div>
                    <p className="text-sm text-slate-200">{insight.text}</p>
                    {insight.detail && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{insight.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Charts side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Data Composition
              </h4>
              <p className="text-[10px] text-slate-600 mb-2">How the patient's records break down by type</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={0.8} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {categoryData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}: {d.value}
                  </span>
                ))}
              </div>
            </div>

            {timelineChartData.length > 0 && (
              <div className="glass p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Clinical Events by Type
                </h4>
                <p className="text-[10px] text-slate-600 mb-2">Distribution of timeline events across categories</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timelineChartData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {timelineChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} opacity={0.7} />
                      ))}
                    </Bar>
                    <RechartsTooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: How It Works ═══ */}
      {activeTab === "data-map" && (
        <div className="space-y-6 animate-fade-up">
          {/* 3-step pipeline */}
          <section className="glass p-5">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
              <GitBranch className="w-4 h-4 text-teal-400" />
              From Hospital Records to Knowledge Graph
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              MIMIC-IV is a large, de-identified clinical dataset from a hospital. Here's how it becomes the
              interactive graph you see in Deep Dive mode:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  step: "1",
                  title: "Raw Tables (CSV)",
                  desc: "Hospital database exports containing patient demographics, admissions, prescriptions, lab results, ICU stays, and clinical orders.",
                  icon: <Database className="w-5 h-5 text-blue-400" />,
                  example: "patients.csv, admissions.csv, labevents.csv…",
                },
                {
                  step: "2",
                  title: "Graph Transformation",
                  desc: "Each row becomes a node (patient, event, diagnosis). Columns become properties. Foreign keys become relationships ('was diagnosed with', 'prescribed').",
                  icon: <Layers className="w-5 h-5 text-teal-400" />,
                  example: "Patient → HAS_DIAGNOSIS → ICD Code",
                },
                {
                  step: "3",
                  title: "Interactive Exploration",
                  desc: "The graph lets you follow connections — from a patient to their visits, to diagnoses, to medications, and back. Every connection is traceable.",
                  icon: <GitBranch className="w-5 h-5 text-violet-400" />,
                  example: "Click any node → see its connections",
                },
              ].map((step) => (
                <div key={step.step} className="bg-slate-800/40 rounded-lg p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    {step.icon}
                    <span className="text-xs font-bold text-teal-400">Step {step.step}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-1">{step.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed flex-1">{step.desc}</p>
                  <p className="text-[10px] text-slate-600 mt-2 italic font-mono">e.g. {step.example}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Relationship types */}
          <section>
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              Connection Types in the Graph
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              These are the relationships that link nodes together. Each represents a real clinical association:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(REL_LABELS).map(([rawType, friendlyName]) => (
                <div key={rawType} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/30">
                  <span className="text-teal-400 text-xs">→</span>
                  <span className="text-xs font-medium text-slate-200">{friendlyName}</span>
                  <span className="text-[10px] text-slate-600 ml-auto font-mono">{rawType}</span>
                </div>
              ))}
            </div>
          </section>

          {/* CTA to Deep Dive */}
          <div className="glass p-4 flex items-center gap-4 border-l-2 border-teal-400">
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">Want to explore the actual graph?</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Switch to Deep Dive mode to interactively explore all nodes and connections.
              </p>
            </div>
            <button
              onClick={() => onSwitchView("graph")}
              className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-teal-500/15 text-teal-400 border border-teal-500/20 hover:bg-teal-500/25 transition-all"
            >
              Open Deep Dive
            </button>
          </div>
        </div>
      )}

      {/* ═══ TAB: Glossary ═══ */}
      {activeTab === "glossary" && (
        <div className="space-y-4 animate-fade-up">
          <p className="text-xs text-slate-500 mb-2">
            A reference for all node types the knowledge graph uses to represent clinical data:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(NODE_LABELS).map(([rawLabel, friendlyName]) => (
              <div key={rawLabel} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-slate-800/30 glass">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <GraduationCap className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{friendlyName}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    {NODE_DESCRIPTIONS[rawLabel] || `Graph label: ${rawLabel}`}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1 font-mono">Neo4j label: {rawLabel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Insight generator
interface Insight {
  icon: string;
  text: string;
  detail?: string;
}

function generateInsights(summary: PatientSummary, timeline?: TimelineData | null): Insight[] {
  const insights: Insight[] = [];
  const c = summary.counts;

  if (c.admissions > 0) {
    insights.push({
      icon: "🏥",
      text: `This patient had ${c.admissions} hospital visit${c.admissions > 1 ? "s" : ""}.`,
      detail: c.admissions > 3
        ? "Multiple hospital visits may indicate a chronic or recurring condition requiring repeated care."
        : "Each visit generates admissions records, diagnoses, procedures, and medication orders.",
    });
  }

  if (c.icu_stays > 0) {
    insights.push({
      icon: "🫀",
      text: `${c.icu_stays} ICU stay${c.icu_stays > 1 ? "s" : ""} were recorded.`,
      detail: "ICU (Intensive Care Unit) stays indicate critical care was needed. These generate additional monitoring data like vital signs and fluid balance.",
    });
  }

  if (c.diagnoses > 0) {
    insights.push({
      icon: "🏷️",
      text: `${c.diagnoses} unique diagnos${c.diagnoses > 1 ? "es" : "is"} recorded.`,
      detail: c.diagnoses > 10
        ? "A high number includes both primary conditions and comorbidities (secondary conditions that affect treatment)."
        : "Diagnoses are recorded using ICD codes — an international standard for classifying diseases.",
    });
  }

  if (c.medications > 0 && c.diagnoses > 0) {
    const ratio = (c.medications / c.diagnoses).toFixed(1);
    insights.push({
      icon: "📈",
      text: `Treatment intensity: ~${ratio} medication records per diagnosis.`,
      detail: "Higher ratios suggest more active pharmacological management. This includes prescriptions, dispensing records, and administration events.",
    });
  }

  if (c.labs > 0) {
    insights.push({
      icon: "🧪",
      text: `${c.labs} lab test${c.labs > 1 ? "s" : ""} recorded.`,
      detail: "Lab tests include blood work, urinalysis, microbiology cultures, and specialized tests. Results help doctors track treatment effectiveness.",
    });
  }

  if (timeline && timeline.count > 0) {
    const categories = new Set(timeline.events.map((e) => e.category));
    insights.push({
      icon: "📊",
      text: `${timeline.count} clinical events across ${categories.size} categories.`,
      detail: `Categories: ${[...categories].map((c) => CATEGORY_NAMES[c] || c).join(", ")}. Each event is one point on the patient's timeline.`,
    });
  }

  return insights;
}
