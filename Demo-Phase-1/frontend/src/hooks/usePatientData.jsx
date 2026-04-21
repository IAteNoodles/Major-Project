import { useState, useCallback } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export function usePatientData() {
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [graph, setGraph] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [schema, setSchema] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState({
    summary: false,
    timeline: false,
    graph: false,
    evidence: false,
    search: false,
    patients: false,
    schema: false,
  });
  const [errors, setErrors] = useState({});
  const [loadingMessage, setLoadingMessage] = useState("");

  const setLoadState = (key, val) =>
    setLoading((p) => ({ ...p, [key]: val }));

  const setErr = (key, err) =>
    setErrors((p) => ({
      ...p,
      [key]: err?.response?.data?.detail || err?.message || String(err),
    }));

  const clearErr = (key) => setErrors((p) => ({ ...p, [key]: null }));

  const fetchPatients = useCallback(async (limit = 800) => {
    setLoadState("patients", true);
    clearErr("patients");
    try {
      const res = await axios.get(`${API}/api/patients`, { params: { limit } });
      setPatients(res.data.patients || []);
    } catch (e) {
      setErr("patients", e);
    } finally {
      setLoadState("patients", false);
    }
  }, []);

  const fetchSummary = useCallback(async (subjectId) => {
    setLoadState("summary", true);
    clearErr("summary");
    setLoadingMessage("Building patient overview...");
    try {
      const res = await axios.get(`${API}/api/patient/${encodeURIComponent(subjectId)}/summary`);
      setSummary(res.data);
    } catch (e) {
      setErr("summary", e);
    } finally {
      setLoadState("summary", false);
      setLoadingMessage("");
    }
  }, []);

  const fetchTimeline = useCallback(async (subjectId, limit = 200) => {
    setLoadState("timeline", true);
    clearErr("timeline");
    setLoadingMessage("Tracing clinical events...");
    try {
      const res = await axios.get(
        `${API}/api/patient/${encodeURIComponent(subjectId)}/timeline`,
        { params: { limit } }
      );
      setTimeline(res.data);
    } catch (e) {
      setErr("timeline", e);
    } finally {
      setLoadState("timeline", false);
      setLoadingMessage("");
    }
  }, []);

  const fetchGraph = useCallback(
    async (subjectId, { depth = 2, eventLimit = 260, maxNodes = 620 } = {}) => {
      setLoadState("graph", true);
      clearErr("graph");
      setLoadingMessage("Building patient neighborhood...");
      try {
        const res = await axios.get(
          `${API}/api/graph/patient/${encodeURIComponent(subjectId)}`,
          { params: { depth, event_limit: eventLimit, max_nodes: maxNodes } }
        );
        setGraph(res.data);
        setLoadingMessage("Linking medications...");
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        setErr("graph", e);
      } finally {
        setLoadState("graph", false);
        setLoadingMessage("");
      }
    },
    []
  );

  const fetchEvidence = useCallback(async (type, id) => {
    setLoadState("evidence", true);
    clearErr("evidence");
    try {
      const endpoint =
        type === "node"
          ? `${API}/api/node/${encodeURIComponent(id)}/evidence`
          : `${API}/api/edge/${encodeURIComponent(id)}/evidence`;
      const res = await axios.get(endpoint);
      setEvidence({ type, ...res.data });
    } catch (e) {
      setErr("evidence", e);
    } finally {
      setLoadState("evidence", false);
    }
  }, []);

  const fetchSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setLoadState("search", true);
    clearErr("search");
    try {
      const res = await axios.get(`${API}/api/search`, {
        params: { q: query, limit: 20 },
      });
      setSearchResults(res.data);
    } catch (e) {
      setErr("search", e);
    } finally {
      setLoadState("search", false);
    }
  }, []);

  const fetchSchema = useCallback(async () => {
    setLoadState("schema", true);
    clearErr("schema");
    try {
      const res = await axios.get(`${API}/api/schema`);
      setSchema(res.data);
    } catch (e) {
      setErr("schema", e);
    } finally {
      setLoadState("schema", false);
    }
  }, []);

  const loadPatient = useCallback(
    async (subjectId, opts = {}) => {
      await Promise.all([
        fetchSummary(subjectId),
        fetchTimeline(subjectId),
        fetchGraph(subjectId, opts),
      ]);
    },
    [fetchSummary, fetchTimeline, fetchGraph]
  );

  return {
    summary,
    timeline,
    graph,
    evidence,
    searchResults,
    schema,
    patients,
    loading,
    errors,
    loadingMessage,
    fetchPatients,
    fetchSummary,
    fetchTimeline,
    fetchGraph,
    fetchEvidence,
    fetchSearch,
    fetchSchema,
    loadPatient,
    setGraph,
    setEvidence,
  };
}
