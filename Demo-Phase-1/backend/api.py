#!/usr/bin/env python3
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from neo4j import Driver, GraphDatabase


ROOT_DIR = Path(__file__).resolve().parents[1]

IDENTITY_KEYS = (
    "subject_id",
    "hadm_id",
    "stay_id",
    "row_uid",
    "provider_id",
    "caregiver_id",
    "itemid",
    "code",
    "icd_code",
)

MEDICATION_TABLES = {
    "prescriptions",
    "emar",
    "emar_detail",
    "pharmacy",
    "poe",
    "poe_detail",
}

LAB_TABLES = {
    "labevents",
    "microbiologyevents",
    "chartevents",
    "datetimeevents",
}

DIAGNOSIS_TABLES = {"diagnoses_icd", "drgcodes"}
PROCEDURE_TABLES = {"procedures_icd", "procedureevents", "hcpcsevents"}
ICU_TABLES = {"icustays", "inputevents", "outputevents", "ingredientevents"}


@dataclass(frozen=True)
class Neo4jSettings:
    uri: str
    username: str
    password: str
    database: str


@dataclass(frozen=True)
class CorsSettings:
    allow_origins: List[str]
    allow_origin_regex: str
    allow_credentials: bool


def _load_settings() -> Neo4jSettings:
    load_dotenv(ROOT_DIR / ".env")
    uri = os.getenv("NEO4J_URL") or os.getenv("neo4j_url") or "bolt://127.0.0.1:7687"
    username = os.getenv("NEO4J_USERNAME") or os.getenv("username") or "neo4j"
    password = os.getenv("NEO4J_PASSWORD") or os.getenv("password") or ""
    database = os.getenv("NEO4J_DATABASE") or os.getenv("database") or "neo4j"
    if not password:
        raise RuntimeError("Neo4j password missing. Set NEO4J_PASSWORD or password in .env")
    return Neo4jSettings(uri=uri, username=username, password=password, database=database)


def _parse_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _load_cors_settings() -> CorsSettings:
    load_dotenv(ROOT_DIR / ".env")
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://0.0.0.0:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:3000",
    ]
    raw_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
    allow_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if not allow_origins:
        allow_origins = default_origins

    allow_origin_regex = os.getenv(
        "CORS_ALLOW_ORIGIN_REGEX",
        r".*",
    )
    allow_credentials = _parse_bool_env("CORS_ALLOW_CREDENTIALS", True)
    return CorsSettings(
        allow_origins=allow_origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=allow_credentials,
    )


def _main_label(labels: List[str]) -> str:
    priority = ["Patient", "Admission", "ICUStay", "ClinicalEvent"]
    for label in priority:
        if label in labels:
            return label
    return labels[0] if labels else "Node"


def _identity_from_props(props: Dict[str, Any], fallback: str = "") -> str:
    for key in IDENTITY_KEYS:
        value = props.get(key)
        if value is not None:
            return str(value)
    return fallback


def _category_from_node(labels: List[str], props: Dict[str, Any]) -> str:
    source_table = str(props.get("source_table") or "").lower()
    label_set = set(labels)

    if "Patient" in label_set:
        return "patient"
    if "Admission" in label_set or source_table in {"admissions", "transfers", "services"}:
        return "encounter"
    if (
        "ICDDiagnosisCode" in label_set
        or "DiagnosisEvent" in label_set
        or source_table in DIAGNOSIS_TABLES
    ):
        return "diagnosis"
    if (
        "ICDProcedureCode" in label_set
        or "ProcedureCodeEvent" in label_set
        or source_table in PROCEDURE_TABLES
    ):
        return "procedure"
    if (
        "LabItem" in label_set
        or "LabEvent" in label_set
        or "MicrobiologyEvent" in label_set
        or source_table in LAB_TABLES
    ):
        return "lab"
    if (
        "ICUStay" in label_set
        or "ICUItem" in label_set
        or source_table in ICU_TABLES
    ):
        return "icu"
    if (
        "POEOrder" in label_set
        or "PharmacyDispense" in label_set
        or "PrescriptionEvent" in label_set
        or "EMAREvent" in label_set
        or source_table in MEDICATION_TABLES
    ):
        return "medication"
    return "other"


def _event_time(props: Dict[str, Any]) -> Optional[str]:
    keys = (
        "charttime",
        "starttime",
        "storetime",
        "eventtime",
        "chartdate",
        "admittime",
        "intime",
        "transfertime",
        "endtime",
        "outtime",
        "dischtime",
    )
    for key in keys:
        value = props.get(key)
        if value:
            return str(value)
    return None


def _event_description(labels: List[str], props: Dict[str, Any]) -> str:
    source_table = props.get("source_table")
    preferred_keys = (
        "long_title",
        "short_title",
        "drug",
        "medication",
        "result_name",
        "test_name",
        "spec_type_desc",
        "curr_service",
        "event_txt",
        "label",
    )
    for key in preferred_keys:
        value = props.get(key)
        if value:
            return str(value)

    if props.get("icd_code"):
        return f"ICD {props['icd_code']}"
    if props.get("itemid"):
        return f"Item {props['itemid']}"
    if source_table:
        return f"{source_table} event"
    return _main_label(labels)


def _to_node_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "labels": row.get("labels") or [],
        "props": row.get("props") or {},
    }


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, int(value)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = _load_settings()
    driver = GraphDatabase.driver(settings.uri, auth=(settings.username, settings.password), keep_alive=True)
    try:
        driver.verify_connectivity()
    except Exception:
        driver.close()
        if settings.uri.startswith("neo4j://"):
            fallback_uri = "bolt://" + settings.uri[len("neo4j://") :]
            driver = GraphDatabase.driver(
                fallback_uri,
                auth=(settings.username, settings.password),
                keep_alive=True,
            )
            driver.verify_connectivity()
            settings = Neo4jSettings(
                uri=fallback_uri,
                username=settings.username,
                password=settings.password,
                database=settings.database,
            )
        else:
            raise

    app.state.driver = driver
    app.state.neo4j_settings = settings
    try:
        yield
    finally:
        driver.close()


app = FastAPI(title="MIMIC KG API", version="1.0.0", lifespan=lifespan)
cors_settings = _load_cors_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_settings.allow_origins,
    allow_origin_regex=cors_settings.allow_origin_regex,
    allow_credentials=cors_settings.allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _driver() -> Driver:
    driver: Optional[Driver] = getattr(app.state, "driver", None)
    if driver is None:
        raise RuntimeError("Neo4j driver is not initialized")
    return driver


def _settings() -> Neo4jSettings:
    settings: Optional[Neo4jSettings] = getattr(app.state, "neo4j_settings", None)
    if settings is None:
        raise RuntimeError("Neo4j settings are not initialized")
    return settings


def _read(query: str, params: Optional[Dict[str, Any]] = None, database: Optional[str] = None) -> List[Dict[str, Any]]:
    params = params or {}
    target_db = database or _settings().database
    with _driver().session(database=target_db) as session:
        result = session.execute_read(lambda tx: list(tx.run(query, **params)))
    return [dict(record.items()) for record in result]


def _ensure_patient_exists(subject_id: str) -> None:
    rows = _read(
        """
MATCH (p:Patient {subject_id: $subject_id})
RETURN elementId(p) AS id
LIMIT 1
""",
        {"subject_id": subject_id},
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"Patient not found: {subject_id}")


@app.get("/api/health")
def health() -> Dict[str, Any]:
    rows = _read("RETURN 1 AS ok")
    if not rows:
        raise HTTPException(status_code=503, detail="Neo4j query failed")
    return {
        "status": "ok",
        "database": _settings().database,
        "uri": _settings().uri,
    }


@app.get("/api/patients")
def list_patients(limit: int = Query(800, ge=1, le=5000)) -> Dict[str, Any]:
    rows = _read(
        """
MATCH (p:Patient)
WHERE p.subject_id IS NOT NULL
RETURN p.subject_id AS subject_id
ORDER BY toString(p.subject_id)
LIMIT $limit
""",
        {"limit": int(limit)},
    )
    return {"patients": [str(row["subject_id"]) for row in rows if row.get("subject_id") is not None]}


@app.get("/api/patient/{subject_id}/summary")
def patient_summary(subject_id: str) -> Dict[str, Any]:
    _ensure_patient_exists(subject_id)

    patient_row = _read(
        """
MATCH (p:Patient {subject_id: $subject_id})
RETURN elementId(p) AS id, labels(p) AS labels, properties(p) AS props
LIMIT 1
""",
        {"subject_id": subject_id},
    )[0]
    patient = _to_node_payload(patient_row)
    patient_props = patient["props"]

    admission_rows = _read(
        """
MATCH (p:Patient {subject_id: $subject_id})-[:HAS_ADMISSION]->(a:Admission)
RETURN elementId(a) AS id, labels(a) AS labels, properties(a) AS props
ORDER BY coalesce(a.admittime, toString(a.source_line))
LIMIT 200
""",
        {"subject_id": subject_id},
    )
    admissions = [
        {
            **(row.get("props") or {}),
            "id": row["id"],
            "labels": row.get("labels") or [],
        }
        for row in admission_rows
    ]

    icu_rows = _read(
        """
MATCH (p:Patient {subject_id: $subject_id})-[:HAS_ICUSTAY]->(s:ICUStay)
RETURN elementId(s) AS id, labels(s) AS labels, properties(s) AS props
ORDER BY coalesce(s.intime, toString(s.source_line))
LIMIT 200
""",
        {"subject_id": subject_id},
    )
    icu_stays = [
        {
            **(row.get("props") or {}),
            "id": row["id"],
            "labels": row.get("labels") or [],
        }
        for row in icu_rows
    ]

    diagnosis_rows = _read(
        """
MATCH (p:Patient {subject_id: $subject_id})-[:HAS_EVENT]->(e:ClinicalEvent)-[:USES_ICD_DIAGNOSIS]->(c:ICDDiagnosisCode)
RETURN
  elementId(e) AS id,
  labels(e) AS labels,
  properties(e) AS props,
  c.long_title AS long_title,
  c.icd_code AS mapped_icd_code
ORDER BY coalesce(e.chartdate, e.charttime, toString(e.source_line))
LIMIT 200
""",
        {"subject_id": subject_id},
    )
    diagnoses: List[Dict[str, Any]] = []
    for row in diagnosis_rows:
        node = _to_node_payload(row)
        props = node["props"]
        mapped_code = row.get("mapped_icd_code") or props.get("icd_code")
        diagnoses.append(
            {
                **node,
                "title": row.get("long_title") or props.get("long_title") or f"ICD {mapped_code}",
                "icd_code": mapped_code,
                "source": props.get("source_table"),
            }
        )

    medication_rows = _read(
        """
MATCH (p:Patient {subject_id: $subject_id})-[:HAS_EVENT]->(e:ClinicalEvent)
WHERE e.source_table IN $tables
RETURN elementId(e) AS id, labels(e) AS labels, properties(e) AS props
ORDER BY coalesce(e.starttime, e.charttime, e.storetime, toString(e.source_line))
LIMIT 300
""",
        {"subject_id": subject_id, "tables": sorted(MEDICATION_TABLES)},
    )
    medications: List[Dict[str, Any]] = []
    for row in medication_rows:
        node = _to_node_payload(row)
        props = node["props"]
        title = (
            props.get("drug")
            or props.get("medication")
            or props.get("medication_name")
            or props.get("event_txt")
            or props.get("pharmacy_id")
            or "Medication"
        )
        medications.append({**node, "title": str(title), "source": props.get("source_table")})

    lab_rows = _read(
        """
MATCH (p:Patient {subject_id: $subject_id})-[:HAS_EVENT]->(e:ClinicalEvent)
WHERE e.source_table IN $tables
RETURN elementId(e) AS id, labels(e) AS labels, properties(e) AS props
ORDER BY coalesce(e.charttime, e.storetime, e.chartdate, toString(e.source_line))
LIMIT 300
""",
        {"subject_id": subject_id, "tables": sorted(LAB_TABLES)},
    )
    labs: List[Dict[str, Any]] = []
    for row in lab_rows:
        node = _to_node_payload(row)
        props = node["props"]
        title = (
            props.get("label")
            or props.get("result_name")
            or props.get("test_name")
            or props.get("itemid")
            or "Lab"
        )
        labs.append({**node, "title": str(title), "source": props.get("source_table")})

    return {
        "subject_id": subject_id,
        "patient": patient,
        "demographics": {
            "gender": patient_props.get("gender"),
            "anchor_age": patient_props.get("anchor_age"),
            "anchor_year": patient_props.get("anchor_year"),
            "dod": patient_props.get("dod"),
        },
        "counts": {
            "admissions": len(admissions),
            "icu_stays": len(icu_stays),
            "diagnoses": len(diagnoses),
            "medications": len(medications),
            "labs": len(labs),
        },
        "admissions": admissions,
        "icu_stays": icu_stays,
        "diagnoses": diagnoses,
        "medications": medications,
        "labs": labs,
    }


@app.get("/api/patient/{subject_id}/timeline")
def patient_timeline(subject_id: str, limit: int = Query(200, ge=1, le=2000)) -> Dict[str, Any]:
    _ensure_patient_exists(subject_id)
    rows = _read(
        """
MATCH (p:Patient {subject_id: $subject_id})-[:HAS_EVENT]->(e:ClinicalEvent)
RETURN elementId(e) AS id, labels(e) AS labels, properties(e) AS props
ORDER BY coalesce(
  e.charttime,
  e.starttime,
  e.storetime,
  e.eventtime,
  e.chartdate,
  e.admittime,
  e.intime,
  e.transfertime,
  e.endtime,
  e.outtime,
  e.dischtime,
  toString(e.source_line)
)
LIMIT $limit
""",
        {"subject_id": subject_id, "limit": int(limit)},
    )

    events: List[Dict[str, Any]] = []
    for row in rows:
        node = _to_node_payload(row)
        props = node["props"]
        category = _category_from_node(node["labels"], props)
        events.append(
            {
                "node_id": node["id"],
                "category": category,
                "time": _event_time(props),
                "hadm_id": props.get("hadm_id"),
                "description": _event_description(node["labels"], props),
                "source_table": props.get("source_table"),
                "props": props,
            }
        )

    return {
        "subject_id": subject_id,
        "count": len(events),
        "events": events,
    }


@app.get("/api/graph/patient/{subject_id}")
def patient_graph(
    subject_id: str,
    depth: int = Query(2, ge=1, le=4),
    event_limit: int = Query(260, ge=10, le=5000),
    max_nodes: int = Query(620, ge=50, le=2000),
) -> Dict[str, Any]:
    bounded_depth = _clamp(depth, 1, 4)
    bounded_event_limit = _clamp(event_limit, 10, 5000)
    bounded_max_nodes = _clamp(max_nodes, 50, 2000)

    query = (
        """
MATCH (p:Patient {subject_id: $subject_id})
WITH p
CALL {
  WITH p
  OPTIONAL MATCH path=(p)-[*1.."""
        + str(bounded_depth)
        + """]-(neighbor)
  RETURN collect(DISTINCT neighbor) AS neighbors
}
CALL {
  WITH p, neighbors
  WITH [p] + neighbors AS seeds
  UNWIND seeds AS s
  OPTIONAL MATCH (s)-[:HAS_EVENT|RECORDED_EVENT|ORDERED_EVENT]->(ev:ClinicalEvent)
  RETURN collect(DISTINCT ev)[0..$event_limit] AS events
}
WITH [p] + neighbors + events AS keep
UNWIND keep AS n
WITH collect(DISTINCT n) AS nodes
WITH [node IN nodes WHERE node IS NOT NULL] AS nodes
WITH nodes,
     CASE WHEN size(nodes) > $max_nodes THEN nodes[0..$max_nodes] ELSE nodes END AS limited_nodes
UNWIND limited_nodes AS n
OPTIONAL MATCH (n)-[r]-(m)
WHERE m IN limited_nodes
RETURN
  size(nodes) AS total_nodes,
  collect(DISTINCT {
    id: elementId(n),
    labels: labels(n),
    props: properties(n)
  }) AS node_rows,
  collect(DISTINCT CASE
    WHEN r IS NULL THEN NULL
    ELSE {
      id: elementId(r),
      rel_type: type(r),
      start_id: elementId(startNode(r)),
      end_id: elementId(endNode(r)),
      props: properties(r)
    }
  END) AS rel_rows
"""
    )

    rows = _read(
        query,
        {
            "subject_id": subject_id,
            "event_limit": bounded_event_limit,
            "max_nodes": bounded_max_nodes,
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"Patient not found: {subject_id}")

    raw_nodes = rows[0].get("node_rows") or []
    raw_rels = [rel for rel in (rows[0].get("rel_rows") or []) if rel is not None]

    nodes_by_id: Dict[str, Dict[str, Any]] = {}
    for node in raw_nodes:
        node_id = node.get("id")
        if not node_id:
            continue
        nodes_by_id[node_id] = {
            "id": node_id,
            "labels": node.get("labels") or [],
            "props": node.get("props") or {},
        }

    rels_by_id: Dict[str, Dict[str, Any]] = {}
    for rel in raw_rels:
        rel_id = rel.get("id")
        if not rel_id:
            continue
        rels_by_id[rel_id] = {
            "id": rel_id,
            "rel_type": rel.get("rel_type"),
            "start_id": rel.get("start_id"),
            "end_id": rel.get("end_id"),
            "props": rel.get("props") or {},
        }

    total_nodes = int(rows[0].get("total_nodes") or len(nodes_by_id))

    return {
        "subject_id": subject_id,
        "nodes": list(nodes_by_id.values()),
        "relationships": list(rels_by_id.values()),
        "meta": {
            "node_count": len(nodes_by_id),
            "relationship_count": len(rels_by_id),
            "total_node_count": total_nodes,
            "truncated": total_nodes > len(nodes_by_id),
            "depth": bounded_depth,
            "event_limit": bounded_event_limit,
            "max_nodes": bounded_max_nodes,
        },
    }


@app.get("/api/node/{node_id}/evidence")
def node_evidence(node_id: str) -> Dict[str, Any]:
    rows = _read(
        """
MATCH (n)
WHERE elementId(n) = $node_id
OPTIONAL MATCH (n)-[r]-(m)
RETURN
  elementId(n) AS id,
  labels(n) AS labels,
  properties(n) AS props,
  collect(DISTINCT CASE
    WHEN r IS NULL THEN NULL
    ELSE {
      direction: CASE WHEN startNode(r) = n THEN 'outgoing' ELSE 'incoming' END,
      rel_type: type(r),
      neighbor_id: elementId(m),
      neighbor_labels: labels(m),
      neighbor_props: properties(m)
    }
  END) AS connections
""",
        {"node_id": node_id},
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"Node not found: {node_id}")

    row = rows[0]
    labels = row.get("labels") or []
    props = row.get("props") or {}
    source_table = props.get("source_table")
    source_line = props.get("source_line")
    row_uid = props.get("row_uid")

    connections: List[Dict[str, Any]] = []
    for connection in row.get("connections") or []:
        if connection is None:
            continue
        neighbor_props = connection.get("neighbor_props") or {}
        connections.append(
            {
                "direction": connection.get("direction"),
                "rel_type": connection.get("rel_type"),
                "neighbor_id": connection.get("neighbor_id"),
                "neighbor_label": _main_label(connection.get("neighbor_labels") or []),
                "neighbor_identity": _identity_from_props(
                    neighbor_props,
                    fallback=str(connection.get("neighbor_id") or ""),
                ),
            }
        )

    origin_parts: List[str] = []
    if source_table:
        origin_parts.append(str(source_table))
    if source_line is not None:
        origin_parts.append(f"line {source_line}")
    origin = " | ".join(origin_parts) if origin_parts else f"node {node_id}"
    transform = (
        "CSV row transformed into ClinicalEvent node"
        if "ClinicalEvent" in labels
        else "CSV row transformed into entity node"
    )

    return {
        "type": "node",
        "id": node_id,
        "labels": labels,
        "props": props,
        "source_table": source_table,
        "source_line": source_line,
        "row_uid": row_uid,
        "lineage": {
            "origin": origin,
            "transform": transform,
        },
        "connection_count": len(connections),
        "connections": connections,
    }


@app.get("/api/edge/{edge_id}/evidence")
def edge_evidence(edge_id: str) -> Dict[str, Any]:
    rows = _read(
        """
MATCH (a)-[r]-(b)
WHERE elementId(r) = $edge_id
RETURN
  elementId(r) AS id,
  type(r) AS rel_type,
  properties(r) AS props,
  elementId(a) AS start_id,
  labels(a) AS start_labels,
  properties(a) AS start_props,
  elementId(b) AS end_id,
  labels(b) AS end_labels,
  properties(b) AS end_props
LIMIT 1
""",
        {"edge_id": edge_id},
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"Edge not found: {edge_id}")

    row = rows[0]
    start_id = row.get("start_id")
    end_id = row.get("end_id")
    rel_type = row.get("rel_type")
    props = row.get("props") or {}

    connections = [
        {
            "direction": "outgoing",
            "rel_type": rel_type,
            "neighbor_id": end_id,
            "neighbor_label": _main_label(row.get("end_labels") or []),
            "neighbor_identity": _identity_from_props(row.get("end_props") or {}, fallback=str(end_id or "")),
        },
        {
            "direction": "incoming",
            "rel_type": rel_type,
            "neighbor_id": start_id,
            "neighbor_label": _main_label(row.get("start_labels") or []),
            "neighbor_identity": _identity_from_props(
                row.get("start_props") or {},
                fallback=str(start_id or ""),
            ),
        },
    ]

    return {
        "type": "edge",
        "id": edge_id,
        "rel_type": rel_type,
        "props": props,
        "source_table": props.get("source_table"),
        "source_line": props.get("source_line"),
        "row_uid": props.get("row_uid"),
        "lineage": {
            "origin": f"relationship {rel_type}",
            "transform": "Relationship created by ETL link rule",
        },
        "connection_count": len(connections),
        "connections": connections,
    }


@app.get("/api/search")
def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=200)) -> Dict[str, Any]:
    token = q.strip().lower()
    if not token:
        return {"query": q, "count": 0, "results": []}

    wanted = _clamp(limit, 1, 200)
    results: List[Dict[str, Any]] = []
    seen: set[str] = set()

    patient_rows = _read(
        """
MATCH (p:Patient)
WHERE toLower(toString(p.subject_id)) CONTAINS $q
RETURN elementId(p) AS id, labels(p) AS labels, properties(p) AS props
ORDER BY toString(p.subject_id)
LIMIT $limit
""",
        {"q": token, "limit": wanted},
    )
    for row in patient_rows:
        node = _to_node_payload(row)
        node_id = node["id"]
        if node_id in seen:
            continue
        seen.add(node_id)
        props = node["props"]
        results.append(
            {
                "id": node_id,
                "category": "patient",
                "identity": str(props.get("subject_id") or node_id),
                "label": _main_label(node["labels"]),
                "source_table": props.get("source_table"),
            }
        )
        if len(results) >= wanted:
            return {"query": q, "count": len(results), "results": results}

    remaining = wanted - len(results)
    if remaining > 0:
        other_rows = _read(
            """
MATCH (n)
WHERE NOT n:Patient
  AND (
    toLower(coalesce(toString(n.icd_code), "")) CONTAINS $q
    OR toLower(coalesce(toString(n.long_title), "")) CONTAINS $q
    OR toLower(coalesce(toString(n.short_title), "")) CONTAINS $q
    OR toLower(coalesce(toString(n.drug), "")) CONTAINS $q
    OR toLower(coalesce(toString(n.medication), "")) CONTAINS $q
    OR toLower(coalesce(toString(n.label), "")) CONTAINS $q
    OR toLower(coalesce(toString(n.result_name), "")) CONTAINS $q
    OR toLower(coalesce(toString(n.subject_id), "")) CONTAINS $q
    OR toLower(coalesce(toString(n.source_table), "")) CONTAINS $q
  )
RETURN elementId(n) AS id, labels(n) AS labels, properties(n) AS props
LIMIT $limit
""",
            {"q": token, "limit": remaining * 4},
        )
        for row in other_rows:
            node = _to_node_payload(row)
            node_id = node["id"]
            if node_id in seen:
                continue
            seen.add(node_id)
            props = node["props"]
            results.append(
                {
                    "id": node_id,
                    "category": _category_from_node(node["labels"], props),
                    "identity": _identity_from_props(props, fallback=node_id),
                    "label": _main_label(node["labels"]),
                    "source_table": props.get("source_table"),
                }
            )
            if len(results) >= wanted:
                break

    return {
        "query": q,
        "count": len(results),
        "results": results,
    }


@app.get("/api/schema")
def schema() -> Dict[str, Any]:
    label_rows = _read(
        """
MATCH (n)
UNWIND labels(n) AS label
RETURN label, count(*) AS count
ORDER BY count DESC, label ASC
"""
    )
    rel_rows = _read(
        """
MATCH ()-[r]->()
RETURN type(r) AS rel_type, count(*) AS count
ORDER BY count DESC, rel_type ASC
"""
    )
    node_count_rows = _read("MATCH (n) RETURN count(n) AS node_count")
    rel_count_rows = _read("MATCH ()-[r]->() RETURN count(r) AS relationship_count")

    property_keys: List[str] = []
    try:
        prop_rows = _read("CALL db.propertyKeys() YIELD propertyKey RETURN propertyKey ORDER BY propertyKey")
        property_keys = [str(row["propertyKey"]) for row in prop_rows if row.get("propertyKey") is not None]
    except Exception:
        property_keys = []

    return {
        "database": _settings().database,
        "counts": {
            "nodes": int(node_count_rows[0]["node_count"] if node_count_rows else 0),
            "relationships": int(
                rel_count_rows[0]["relationship_count"] if rel_count_rows else 0
            ),
        },
        "labels": [
            {"label": str(row["label"]), "count": int(row["count"])}
            for row in label_rows
            if row.get("label") is not None
        ],
        "relationship_types": [
            {"rel_type": str(row["rel_type"]), "count": int(row["count"])}
            for row in rel_rows
            if row.get("rel_type") is not None
        ],
        "property_keys": property_keys,
    }
