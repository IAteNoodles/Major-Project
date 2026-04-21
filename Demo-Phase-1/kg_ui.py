#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Tuple

import streamlit as st
import streamlit.components.v1 as components
from dotenv import load_dotenv
from neo4j import Driver, GraphDatabase
from pyvis.network import Network


SAFE_TOKEN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
SAFE_REL_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")

NODE_COLORS: Dict[str, str] = {
    "Patient": "#ef4444",
    "Admission": "#f97316",
    "ICUStay": "#f59e0b",
    "ClinicalEvent": "#3b82f6",
    "Provider": "#0ea5e9",
    "Caregiver": "#14b8a6",
    "POEOrder": "#22c55e",
    "PharmacyDispense": "#84cc16",
    "ICDDiagnosisCode": "#8b5cf6",
    "ICDProcedureCode": "#a855f7",
    "HCPCSCode": "#d946ef",
    "LabItem": "#ec4899",
    "ICUItem": "#f43f5e",
}

DISPLAY_KEYS: Tuple[str, ...] = (
    "subject_id",
    "hadm_id",
    "stay_id",
    "row_uid",
    "labevent_id",
    "microevent_id",
    "transfer_id",
    "poe_id",
    "pharmacy_id",
    "provider_id",
    "caregiver_id",
    "itemid",
    "code",
    "icd_code",
)


def load_defaults() -> Dict[str, str]:
    load_dotenv(".env")
    return {
        "uri": os.getenv("NEO4J_URL") or os.getenv("neo4j_url") or "bolt://127.0.0.1:7687",
        "username": os.getenv("NEO4J_USERNAME") or os.getenv("username") or "neo4j",
        "password": os.getenv("NEO4J_PASSWORD") or os.getenv("password") or "",
        "database": os.getenv("NEO4J_DATABASE") or os.getenv("database") or "neo4j",
    }


@st.cache_resource(show_spinner=False)
def get_driver(uri: str, username: str, password: str) -> Driver:
    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        driver.verify_connectivity()
        return driver
    except Exception:
        driver.close()
        if uri.startswith("neo4j://"):
            fallback_uri = "bolt://" + uri[len("neo4j://") :]
            fallback_driver = GraphDatabase.driver(fallback_uri, auth=(username, password))
            fallback_driver.verify_connectivity()
            return fallback_driver
        raise


def run_read(driver: Driver, database: str, query: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    with driver.session(database=database) as session:
        result = session.execute_read(lambda tx: list(tx.run(query, **params)))
    return [dict(record.items()) for record in result]


def run_write(driver: Driver, database: str, query: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    with driver.session(database=database) as session:
        result = session.execute_write(lambda tx: list(tx.run(query, **params)))
    return [dict(record.items()) for record in result]


def main_label(labels: List[str]) -> str:
    priority = [
        "Patient",
        "Admission",
        "ICUStay",
        "ClinicalEvent",
        "Provider",
        "Caregiver",
        "POEOrder",
        "PharmacyDispense",
    ]
    for label in priority:
        if label in labels:
            return label
    return labels[0] if labels else "Node"


def short_identity(props: Dict[str, Any]) -> str:
    for key in DISPLAY_KEYS:
        value = props.get(key)
        if value is not None:
            return f"{key}={value}"
    return "no-id"


def parse_json_literal(raw: str) -> Any:
    text = raw.strip()
    if text == "":
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return raw


def parse_json_object(raw: str) -> Dict[str, Any]:
    text = raw.strip()
    if text == "":
        return {}
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("Expected JSON object")
    return value


def parse_label_list(raw: str) -> List[str]:
    labels = [token.strip() for token in raw.split(",") if token.strip()]
    if not labels:
        raise ValueError("At least one label required")
    for label in labels:
        if not SAFE_TOKEN_RE.fullmatch(label):
            raise ValueError(f"Invalid label: {label}")
    return labels


def ensure_safe_property_key(key: str) -> str:
    token = key.strip()
    if not SAFE_TOKEN_RE.fullmatch(token):
        raise ValueError("Property key must match [A-Za-z_][A-Za-z0-9_]*")
    return token


def ensure_safe_rel_type(rel_type: str) -> str:
    token = rel_type.strip().upper()
    if not SAFE_REL_RE.fullmatch(token):
        raise ValueError("Relationship type must match [A-Z][A-Z0-9_]*")
    return token


def get_patient_ids(driver: Driver, database: str, limit: int) -> List[str]:
    rows = run_read(
        driver,
        database,
        """
MATCH (p:Patient)
RETURN p.subject_id AS subject_id
ORDER BY p.subject_id
LIMIT $limit
""",
        {"limit": limit},
    )
    return [str(row["subject_id"]) for row in rows if row.get("subject_id") is not None]


def fetch_patient_subgraph(
    driver: Driver,
    database: str,
    subject_id: str,
    depth: int,
    event_limit: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    bounded_depth = max(1, min(depth, 4))
    query = f"""
MATCH (p:Patient {{subject_id: $subject_id}})
OPTIONAL MATCH path=(p)-[*1..{bounded_depth}]-(neighbor)
WITH p, collect(distinct neighbor) AS neighbors
CALL {{
  WITH p, neighbors
  WITH [p] + neighbors AS seeds
  UNWIND seeds AS s
  OPTIONAL MATCH (s)-[:HAS_EVENT|RECORDED_EVENT|ORDERED_EVENT]->(ev:ClinicalEvent)
  RETURN collect(distinct ev)[0..$event_limit] AS events
}}
WITH [p] + neighbors + events AS keep
UNWIND keep AS n
WITH collect(distinct n) AS nodes
UNWIND nodes AS n
OPTIONAL MATCH (n)-[r]-(m)
WHERE m IN nodes
RETURN
  collect(distinct {{
    id: elementId(n),
    labels: labels(n),
    props: properties(n)
  }}) AS node_rows,
  collect(distinct CASE
    WHEN r IS NULL THEN NULL
    ELSE {{
      id: elementId(r),
      rel_type: type(r),
      start_id: elementId(startNode(r)),
      end_id: elementId(endNode(r)),
      props: properties(r)
    }}
  END) AS rel_rows
"""
    rows = run_read(
        driver,
        database,
        query,
        {"subject_id": subject_id, "event_limit": event_limit},
    )
    if not rows:
        return [], []
    node_rows = rows[0].get("node_rows") or []
    rel_rows = [row for row in (rows[0].get("rel_rows") or []) if row is not None]
    return node_rows, rel_rows


def to_node_options(nodes: List[Dict[str, Any]]) -> List[Tuple[str, str]]:
    options: List[Tuple[str, str]] = []
    for node in nodes:
        node_id = node["id"]
        label = main_label(node.get("labels", []))
        identity = short_identity(node.get("props", {}))
        options.append((node_id, f"{label} | {identity} | {node_id}"))
    options.sort(key=lambda item: item[1])
    return options


def to_rel_options(rels: List[Dict[str, Any]]) -> List[Tuple[str, str]]:
    options: List[Tuple[str, str]] = []
    for rel in rels:
        rel_id = rel["id"]
        rel_type = rel.get("rel_type", "REL")
        display = f"{rel_type} | {rel.get('start_id')} -> {rel.get('end_id')} | {rel_id}"
        options.append((rel_id, display))
    options.sort(key=lambda item: item[1])
    return options


def build_pyvis_html(nodes: List[Dict[str, Any]], rels: List[Dict[str, Any]]) -> str:
    net = Network(height="760px", width="100%", directed=True, bgcolor="#f8fafc", font_color="#111827")
    net.barnes_hut(gravity=-20000, spring_length=180, spring_strength=0.002)
    net.toggle_physics(True)

    for node in nodes:
        node_id = node["id"]
        labels = node.get("labels", [])
        props = node.get("props", {})
        primary = main_label(labels)
        color = NODE_COLORS.get(primary, "#64748b")
        identity = short_identity(props)
        title_lines = [f"labels: {', '.join(labels)}"]
        for key in sorted(props.keys()):
            value = props[key]
            title_lines.append(f"{key}: {value}")
            if len(title_lines) >= 18:
                title_lines.append("...")
                break

        net.add_node(
            node_id,
            label=f"{primary}\n{identity}",
            title="\n".join(title_lines),
            color=color,
            size=28 if primary == "Patient" else 18,
        )

    for rel in rels:
        props = rel.get("props", {})
        title = "\n".join([f"{key}: {value}" for key, value in sorted(props.items())][:12])
        net.add_edge(
            rel["start_id"],
            rel["end_id"],
            label=rel.get("rel_type", "REL"),
            title=title,
            arrows="to",
        )

    return net.generate_html(notebook=False)


def render_node_editor(driver: Driver, database: str, nodes: List[Dict[str, Any]]) -> None:
    st.subheader("Edit Node")
    options = to_node_options(nodes)
    if not options:
        st.info("No nodes loaded")
        return

    labels = [item[1] for item in options]
    selected_label = st.selectbox("Node", labels, key="node_editor_select")
    selected_node_id = options[labels.index(selected_label)][0]

    target = next(node for node in nodes if node["id"] == selected_node_id)
    st.code(json.dumps(target.get("props", {}), indent=2, default=str), language="json")

    with st.form("node_property_form"):
        key = st.text_input("Property key", value="note")
        value_raw = st.text_input("Property value (JSON literal)", value='""')
        submitted = st.form_submit_button("Upsert property")

    if submitted:
        try:
            safe_key = ensure_safe_property_key(key)
            value = parse_json_literal(value_raw)
            query = f"""
MATCH (n)
WHERE elementId(n) = $node_id
SET n.{safe_key} = $value
RETURN elementId(n) AS node_id
"""
            run_write(driver, database, query, {"node_id": selected_node_id, "value": value})
            st.success("Node updated")
            st.rerun()
        except Exception as exc:
            st.error(str(exc))

    with st.form("node_patch_form"):
        patch_json = st.text_area("Patch properties (JSON object)", value="{}", height=150)
        patch_submitted = st.form_submit_button("Apply patch")

    if patch_submitted:
        try:
            patch = parse_json_object(patch_json)
            run_write(
                driver,
                database,
                """
MATCH (n)
WHERE elementId(n) = $node_id
SET n += $patch
RETURN elementId(n) AS node_id
""",
                {"node_id": selected_node_id, "patch": patch},
            )
            st.success("Node patch applied")
            st.rerun()
        except Exception as exc:
            st.error(str(exc))


def render_rel_editor(driver: Driver, database: str, rels: List[Dict[str, Any]]) -> None:
    st.subheader("Edit Relationship")
    options = to_rel_options(rels)
    if not options:
        st.info("No relationships loaded")
        return

    labels = [item[1] for item in options]
    selected_label = st.selectbox("Relationship", labels, key="rel_editor_select")
    rel_id = options[labels.index(selected_label)][0]

    target = next(rel for rel in rels if rel["id"] == rel_id)
    st.code(json.dumps(target.get("props", {}), indent=2, default=str), language="json")

    with st.form("rel_property_form"):
        key = st.text_input("Property key", value="note")
        value_raw = st.text_input("Property value (JSON literal)", value='""')
        submitted = st.form_submit_button("Upsert relationship property")

    if submitted:
        try:
            safe_key = ensure_safe_property_key(key)
            value = parse_json_literal(value_raw)
            query = f"""
MATCH ()-[r]-()
WHERE elementId(r) = $rel_id
SET r.{safe_key} = $value
RETURN elementId(r) AS rel_id
"""
            run_write(driver, database, query, {"rel_id": rel_id, "value": value})
            st.success("Relationship updated")
            st.rerun()
        except Exception as exc:
            st.error(str(exc))


def render_create_tools(driver: Driver, database: str, nodes: List[Dict[str, Any]]) -> None:
    st.subheader("Create")
    node_options = to_node_options(nodes)

    with st.form("create_node_form"):
        labels_raw = st.text_input("Node labels (comma-separated)", value="ClinicalEvent")
        props_raw = st.text_area("Node properties JSON", value="{}", height=140)
        submit_node = st.form_submit_button("Create node")

    if submit_node:
        try:
            labels = parse_label_list(labels_raw)
            props = parse_json_object(props_raw)
            label_clause = ":".join(labels)
            query = f"""
CREATE (n:{label_clause})
SET n += $props
RETURN elementId(n) AS node_id
"""
            created = run_write(driver, database, query, {"props": props})
            st.success(f"Created node {created[0]['node_id']}")
            st.rerun()
        except Exception as exc:
            st.error(str(exc))

    if not node_options:
        st.info("Load graph to create relationships between visible nodes")
        return

    display_options = [item[1] for item in node_options]
    with st.form("create_rel_form"):
        source_label = st.selectbox("Source node", display_options, key="create_rel_src")
        target_label = st.selectbox("Target node", display_options, key="create_rel_dst")
        rel_type_raw = st.text_input("Relationship type", value="RELATED_TO")
        props_raw = st.text_area("Relationship properties JSON", value="{}", height=100)
        submit_rel = st.form_submit_button("Create relationship")

    if submit_rel:
        try:
            rel_type = ensure_safe_rel_type(rel_type_raw)
            props = parse_json_object(props_raw)
            src_id = node_options[display_options.index(source_label)][0]
            dst_id = node_options[display_options.index(target_label)][0]
            query = f"""
MATCH (a), (b)
WHERE elementId(a) = $src_id AND elementId(b) = $dst_id
MERGE (a)-[r:{rel_type}]->(b)
SET r += $props
RETURN elementId(r) AS rel_id
"""
            created = run_write(driver, database, query, {"src_id": src_id, "dst_id": dst_id, "props": props})
            st.success(f"Created relationship {created[0]['rel_id']}")
            st.rerun()
        except Exception as exc:
            st.error(str(exc))


def render_delete_tools(driver: Driver, database: str, nodes: List[Dict[str, Any]], rels: List[Dict[str, Any]]) -> None:
    st.subheader("Delete")

    rel_options = to_rel_options(rels)
    if rel_options:
        rel_labels = [item[1] for item in rel_options]
        selected_rel = st.selectbox("Relationship to delete", rel_labels, key="delete_rel_select")
        rel_id = rel_options[rel_labels.index(selected_rel)][0]
        if st.button("Delete relationship", type="secondary"):
            run_write(
                driver,
                database,
                """
MATCH ()-[r]-()
WHERE elementId(r) = $rel_id
DELETE r
""",
                {"rel_id": rel_id},
            )
            st.success("Relationship deleted")
            st.rerun()
    else:
        st.info("No relationships in current view")

    node_options = to_node_options(nodes)
    if node_options:
        node_labels = [item[1] for item in node_options]
        selected_node = st.selectbox("Node to delete", node_labels, key="delete_node_select")
        node_id = node_options[node_labels.index(selected_node)][0]
        confirm = st.text_input("Type DELETE to confirm node deletion")
        if st.button("Delete node and attached edges", type="primary"):
            if confirm.strip().upper() != "DELETE":
                st.error("Confirmation text mismatch")
            else:
                run_write(
                    driver,
                    database,
                    """
MATCH (n)
WHERE elementId(n) = $node_id
DETACH DELETE n
""",
                    {"node_id": node_id},
                )
                st.success("Node deleted")
                st.rerun()
    else:
        st.info("No nodes in current view")


def app() -> None:
    st.set_page_config(page_title="MIMIC KG Workbench", layout="wide")
    st.title("MIMIC Patient KG Workbench")
    st.caption("View and edit patient-centric knowledge graph in Neo4j")

    defaults = load_defaults()
    with st.sidebar:
        st.header("Neo4j")
        uri = st.text_input("URI", value=defaults["uri"])
        username = st.text_input("Username", value=defaults["username"])
        password = st.text_input("Password", value=defaults["password"], type="password")
        database = st.text_input("Database", value=defaults["database"])

        st.header("Graph Window")
        patient_list_limit = st.slider("Patient list size", min_value=20, max_value=2000, value=200, step=20)
        hop_depth = st.slider("Neighborhood depth", min_value=1, max_value=4, value=2)
        event_limit = st.slider("Max events in view", min_value=50, max_value=3000, value=400, step=50)

    if not password:
        st.error("Neo4j password missing. Set in .env or sidebar.")
        st.stop()

    try:
        driver = get_driver(uri, username, password)
    except Exception as exc:
        st.error(f"Neo4j connection failed: {exc}")
        st.stop()

    st.success("Connected to Neo4j")

    patient_ids = get_patient_ids(driver, database, patient_list_limit)
    if not patient_ids:
        st.warning("No Patient nodes found. Run ingestion first.")
        st.stop()

    col_a, col_b = st.columns([2, 3])
    with col_a:
        picked_patient = st.selectbox("Pick patient", patient_ids)
    with col_b:
        typed_patient = st.text_input("Or type subject_id", value=picked_patient)

    subject_id = typed_patient.strip() or picked_patient

    try:
        nodes, rels = fetch_patient_subgraph(
            driver=driver,
            database=database,
            subject_id=subject_id,
            depth=hop_depth,
            event_limit=event_limit,
        )
    except Exception as exc:
        st.error(f"Failed to load patient graph: {exc}")
        st.stop()

    if not nodes:
        st.warning(f"No graph found for subject_id={subject_id}")
        st.stop()

    node_count = len(nodes)
    rel_count = len(rels)
    event_count = sum(1 for node in nodes if "ClinicalEvent" in node.get("labels", []))
    m1, m2, m3 = st.columns(3)
    m1.metric("Nodes", node_count)
    m2.metric("Relationships", rel_count)
    m3.metric("Events", event_count)

    html = build_pyvis_html(nodes, rels)
    components.html(html, height=780, scrolling=True)

    tabs = st.tabs(["Edit Node", "Edit Relationship", "Create", "Delete", "Table"])
    with tabs[0]:
        render_node_editor(driver, database, nodes)
    with tabs[1]:
        render_rel_editor(driver, database, rels)
    with tabs[2]:
        render_create_tools(driver, database, nodes)
    with tabs[3]:
        render_delete_tools(driver, database, nodes, rels)
    with tabs[4]:
        st.subheader("Current Subgraph Nodes")
        node_table = []
        for node in nodes:
            node_table.append(
                {
                    "id": node["id"],
                    "labels": ",".join(node.get("labels", [])),
                    "identity": short_identity(node.get("props", {})),
                    "source_table": node.get("props", {}).get("source_table"),
                }
            )
        st.dataframe(node_table, use_container_width=True, hide_index=True)

        st.subheader("Current Subgraph Relationships")
        rel_table = []
        for rel in rels:
            rel_table.append(
                {
                    "id": rel["id"],
                    "type": rel.get("rel_type"),
                    "start": rel.get("start_id"),
                    "end": rel.get("end_id"),
                }
            )
        st.dataframe(rel_table, use_container_width=True, hide_index=True)


if __name__ == "__main__":
    app()
