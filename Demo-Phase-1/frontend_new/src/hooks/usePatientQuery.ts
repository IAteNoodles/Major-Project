"use client";
import { useQuery } from "@tanstack/react-query";
import {
  checkHealth,
  listPatients,
  getPatientSummary,
  getPatientTimeline,
  getPatientGraph,
  getNodeEvidence,
  getEdgeEvidence,
  searchEntities,
  type PatientSummary,
  type TimelineData,
  type GraphData,
  type EvidenceData,
  type SearchResponse,
} from "@/lib/api";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: checkHealth,
    retry: 2,
    staleTime: 30_000,
  });
}

export function usePatients(limit = 800) {
  return useQuery({
    queryKey: ["patients", limit],
    queryFn: () => listPatients(limit),
    staleTime: 5 * 60_000,
  });
}

export function usePatientSummary(subjectId: string | null) {
  return useQuery<PatientSummary>({
    queryKey: ["patient", subjectId, "summary"],
    queryFn: () => getPatientSummary(subjectId!),
    enabled: !!subjectId,
    staleTime: 5 * 60_000,
  });
}

export function usePatientTimeline(subjectId: string | null, limit = 200) {
  return useQuery<TimelineData>({
    queryKey: ["patient", subjectId, "timeline", limit],
    queryFn: () => getPatientTimeline(subjectId!, limit),
    enabled: !!subjectId,
    staleTime: 5 * 60_000,
  });
}

export function usePatientGraph(
  subjectId: string | null,
  opts: { depth?: number; eventLimit?: number; maxNodes?: number } = {}
) {
  return useQuery<GraphData>({
    queryKey: ["patient", subjectId, "graph", opts],
    queryFn: () => getPatientGraph(subjectId!, opts),
    enabled: !!subjectId,
    staleTime: 5 * 60_000,
  });
}

export function useNodeEvidence(nodeId: string | null) {
  return useQuery<EvidenceData>({
    queryKey: ["evidence", "node", nodeId],
    queryFn: () => getNodeEvidence(nodeId!),
    enabled: !!nodeId,
    staleTime: 2 * 60_000,
  });
}

export function useEdgeEvidence(edgeId: string | null) {
  return useQuery<EvidenceData>({
    queryKey: ["evidence", "edge", edgeId],
    queryFn: () => getEdgeEvidence(edgeId!),
    enabled: !!edgeId,
    staleTime: 2 * 60_000,
  });
}

export function useSearch(query: string) {
  return useQuery<SearchResponse>({
    queryKey: ["search", query],
    queryFn: () => searchEntities(query),
    enabled: query.trim().length >= 1,
    staleTime: 60_000,
  });
}
