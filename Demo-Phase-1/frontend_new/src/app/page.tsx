"use client";
import { useState } from "react";
import {
  Search,
  Activity,
  ArrowRight,
  Users,
  Network,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePatients, useSearch } from "@/hooks/usePatientQuery";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patientFilter, setPatientFilter] = useState("");

  const { data: patients, isLoading: patientsLoading } = usePatients();
  const { data: searchResults, isLoading: searchLoading } = useSearch(query);

  function navigateToPatient(id: string) {
    router.push(`/patient/${id}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    // If query looks like a patient ID, navigate directly
    if (/^\d+$/.test(query.trim())) {
      navigateToPatient(query.trim());
    }
  }

  const filteredPatients = patients?.filter((p) =>
    patientFilter ? p.includes(patientFilter) : true
  ) ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal header */}
      <header className="h-14 flex items-center px-6 border-b border-white/[0.06] bg-slate-900/50 backdrop-blur-sm">
        <Activity className="w-5 h-5 text-teal-400 mr-2" />
        <h1 className="text-sm font-semibold text-slate-100">Clinical Explorer</h1>
        <span className="text-xs text-slate-500 ml-2">MIMIC-IV Knowledge Graph</span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl w-full space-y-8 animate-fade-up">
          {/* Title */}
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 tracking-tight">
              Explore Clinical Data,{" "}
              <span className="text-teal-400">Visually</span>
            </h2>
            <p className="text-base text-slate-400 max-w-lg mx-auto leading-relaxed">
              Search by patient ID, drug name, diagnosis, or condition.
              Understand connections between hospital visits, treatments, and outcomes.
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a patient ID (e.g. 10006), drug name, or diagnosis…"
              autoFocus
              className={cn(
                "w-full h-14 pl-12 pr-4 text-base rounded-xl",
                "bg-slate-800/60 border border-white/[0.08]",
                "text-slate-200 placeholder:text-slate-500",
                "focus:outline-none focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10",
                "transition-all duration-300"
              )}
            />
          </form>

          {/* Search results */}
          {searchResults && searchResults.count > 0 && (
            <div className="glass p-2 space-y-0.5 max-h-[300px] overflow-y-auto animate-fade-up">
              {searchResults.results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    if (r.category === "patient") {
                      navigateToPatient(r.identity);
                    }
                  }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/60 transition-colors"
                >
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded",
                      r.category === "patient"
                        ? "bg-red-500/15 text-red-400"
                        : r.category === "diagnosis"
                        ? "bg-violet-500/15 text-violet-400"
                        : "bg-teal-500/15 text-teal-400"
                    )}
                  >
                    {r.category}
                  </span>
                  <span className="text-sm text-slate-200 flex-1">
                    {r.identity}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                </button>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            {[
              {
                icon: Users,
                label: "Browse Patients",
                desc: "Pick from available patient records",
                color: "text-teal-400",
                bg: "bg-teal-500/10",
              },
              {
                icon: Network,
                label: "Explore Connections",
                desc: "See how diagnoses, meds, and labs relate",
                color: "text-violet-400",
                bg: "bg-violet-500/10",
              },
              {
                icon: BookOpen,
                label: "Learn Mode",
                desc: "Understand hospital data and knowledge graphs",
                color: "text-amber-400",
                bg: "bg-amber-500/10",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="glass p-4 flex flex-col items-start gap-2 hover:border-white/[0.12] transition-all cursor-default"
              >
                <div className={cn("p-2 rounded-lg", card.bg)}>
                  <card.icon className={cn("w-4 h-4", card.color)} />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">
                  {card.label}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Patient list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Available Patients
              </p>
              <input
                type="text"
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
                placeholder="Filter…"
                className="h-7 w-32 px-2 text-xs rounded-md bg-slate-800/60 border border-white/[0.06] text-slate-300 placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            {patientsLoading ? (
              <div className="flex gap-2 flex-wrap">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="skeleton w-16 h-8 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap max-h-[200px] overflow-y-auto">
                {filteredPatients.slice(0, 60).map((id) => (
                  <button
                    key={id}
                    onClick={() => navigateToPatient(id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/50 border border-white/[0.06] hover:border-teal-500/30 hover:text-teal-400 hover:bg-teal-500/5 transition-all"
                  >
                    {id}
                  </button>
                ))}
                {filteredPatients.length > 60 && (
                  <span className="px-3 py-1.5 text-xs text-slate-500">
                    +{filteredPatients.length - 60} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Tip */}
          <p className="text-center text-xs text-slate-600 pt-4">
            💡 Click any patient ID to explore their clinical data. Right-click items for more options.
          </p>
        </div>
      </main>
    </div>
  );
}
