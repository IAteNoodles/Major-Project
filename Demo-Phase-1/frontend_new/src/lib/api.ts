import axios from "axios";

const isServer = typeof window === "undefined";
const API_BASE = isServer 
  ? (process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000")
  : "";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// ---------- Types ----------

export interface PatientSummary {
  subject_id: string;
  patient: NodePayload;
  demographics: {
    gender?: string;
    anchor_age?: number;
    anchor_year?: number;
    dod?: string;
  };
  counts: {
    admissions: number;
    icu_stays: number;
    diagnoses: number;
    medications: number;
    labs: number;
  };
  admissions: Record<string, unknown>[];
  icu_stays: Record<string, unknown>[];
  diagnoses: DiagnosisItem[];
  medications: MedicationItem[];
  labs: LabItem[];
}

export interface DiagnosisItem {
  id: string;
  labels: string[];
  props: Record<string, unknown>;
  title: string;
  icd_code?: string;
  source?: string;
}

export interface MedicationItem {
  id: string;
  labels: string[];
  props: Record<string, unknown>;
  title: string;
  source?: string;
}

export interface LabItem {
  id: string;
  labels: string[];
  props: Record<string, unknown>;
  title: string;
  source?: string;
}

export interface TimelineEvent {
  node_id: string;
  category: string;
  time?: string;
  hadm_id?: string;
  description: string;
  source_table?: string;
  props: Record<string, unknown>;
}

export interface TimelineData {
  subject_id: string;
  count: number;
  events: TimelineEvent[];
}

export interface NodePayload {
  id: string;
  labels: string[];
  props: Record<string, unknown>;
}

export interface RelPayload {
  id: string;
  rel_type: string;
  start_id: string;
  end_id: string;
  props: Record<string, unknown>;
}

export interface GraphData {
  subject_id: string;
  nodes: NodePayload[];
  relationships: RelPayload[];
  meta: {
    node_count: number;
    relationship_count: number;
    total_node_count: number;
    truncated: boolean;
    depth: number;
    event_limit: number;
    max_nodes: number;
  };
}

export interface EvidenceConnection {
  direction: "incoming" | "outgoing";
  rel_type: string;
  neighbor_id: string;
  neighbor_label: string;
  neighbor_identity: string;
}

export interface EvidenceData {
  type: "node" | "edge";
  id: string;
  labels?: string[];
  rel_type?: string;
  props: Record<string, unknown>;
  source_table?: string;
  source_line?: number;
  row_uid?: string;
  lineage: {
    origin: string;
    transform: string;
  };
  connection_count: number;
  connections: EvidenceConnection[];
}

export interface SearchResult {
  id: string;
  category: string;
  identity: string;
  label: string;
  source_table?: string;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: SearchResult[];
}

export interface HealthResponse {
  status: string;
  database: string;
  uri: string;
}

// ---------- API Functions ----------

export async function checkHealth(): Promise<HealthResponse> {
  const { data } = await client.get<HealthResponse>("/api/health");
  return data;
}

export async function listPatients(limit = 800): Promise<string[]> {
  const { data } = await client.get<{ patients: string[] }>("/api/patients", {
    params: { limit },
  });
  return data.patients;
}

export async function getPatientSummary(
  subjectId: string
): Promise<PatientSummary> {
  const { data } = await client.get<PatientSummary>(
    `/api/patient/${encodeURIComponent(subjectId)}/summary`
  );
  return data;
}

export async function getPatientTimeline(
  subjectId: string,
  limit = 200
): Promise<TimelineData> {
  const { data } = await client.get<TimelineData>(
    `/api/patient/${encodeURIComponent(subjectId)}/timeline`,
    { params: { limit } }
  );
  return data;
}

export async function getPatientGraph(
  subjectId: string,
  opts: { depth?: number; eventLimit?: number; maxNodes?: number } = {}
): Promise<GraphData> {
  const { data } = await client.get<GraphData>(
    `/api/graph/patient/${encodeURIComponent(subjectId)}`,
    {
      params: {
        depth: opts.depth ?? 1,
        event_limit: opts.eventLimit ?? 50,
        max_nodes: opts.maxNodes ?? 80,
      },
    }
  );
  return data;
}

export async function getNodeEvidence(
  nodeId: string
): Promise<EvidenceData> {
  const { data } = await client.get<EvidenceData>(
    `/api/node/${encodeURIComponent(nodeId)}/evidence`
  );
  return { ...data, type: "node" };
}

export async function getEdgeEvidence(
  edgeId: string
): Promise<EvidenceData> {
  const { data } = await client.get<EvidenceData>(
    `/api/edge/${encodeURIComponent(edgeId)}/evidence`
  );
  return { ...data, type: "edge" };
}

export async function searchEntities(
  query: string,
  limit = 20
): Promise<SearchResponse> {
  const { data } = await client.get<SearchResponse>("/api/search", {
    params: { q: query, limit },
  });
  return data;
}
