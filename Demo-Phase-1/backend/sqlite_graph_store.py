#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def _json_load(value: str) -> Any:
    return json.loads(value)


def _to_index_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    return None


def make_node_key(label: str, key_fields: Sequence[str], values: Dict[str, Any]) -> str:
    payload = {
        "label": label,
        "keys": [[field, values.get(field)] for field in key_fields],
    }
    digest = hashlib.sha1(_json_dump(payload).encode("utf-8")).hexdigest()
    return f"{label}:{digest}"


def make_edge_key(rel_type: str, start_node_key: str, end_node_key: str) -> str:
    payload = [rel_type, start_node_key, end_node_key]
    digest = hashlib.sha1(_json_dump(payload).encode("utf-8")).hexdigest()
    return f"{rel_type}:{digest}"


class SQLiteGraphStore:
    def __init__(self, db_path: str) -> None:
        resolved = Path(db_path).expanduser().resolve()
        resolved.parent.mkdir(parents=True, exist_ok=True)
        self.db_path = str(resolved)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA journal_mode = WAL")

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def ensure_schema(self, drop_existing: bool = False) -> None:
        with self._lock, self._conn:
            if drop_existing:
                self._conn.execute("DROP TABLE IF EXISTS edges")
                self._conn.execute("DROP TABLE IF EXISTS node_props")
                self._conn.execute("DROP TABLE IF EXISTS node_labels")
                self._conn.execute("DROP TABLE IF EXISTS nodes")

            self._conn.execute(
                """
CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_key TEXT NOT NULL UNIQUE,
    labels_json TEXT NOT NULL,
    props_json TEXT NOT NULL
)
"""
            )
            self._conn.execute(
                """
CREATE TABLE IF NOT EXISTS node_labels (
    node_key TEXT NOT NULL,
    label TEXT NOT NULL,
    PRIMARY KEY (node_key, label),
    FOREIGN KEY (node_key) REFERENCES nodes(node_key) ON DELETE CASCADE
)
"""
            )
            self._conn.execute(
                """
CREATE TABLE IF NOT EXISTS node_props (
    node_key TEXT NOT NULL,
    prop_key TEXT NOT NULL,
    prop_value TEXT NOT NULL,
    PRIMARY KEY (node_key, prop_key, prop_value),
    FOREIGN KEY (node_key) REFERENCES nodes(node_key) ON DELETE CASCADE
)
"""
            )
            self._conn.execute(
                """
CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    edge_key TEXT NOT NULL UNIQUE,
    rel_type TEXT NOT NULL,
    start_node_key TEXT NOT NULL,
    end_node_key TEXT NOT NULL,
    props_json TEXT NOT NULL,
    FOREIGN KEY (start_node_key) REFERENCES nodes(node_key) ON DELETE CASCADE,
    FOREIGN KEY (end_node_key) REFERENCES nodes(node_key) ON DELETE CASCADE
)
"""
            )

            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_node_labels_label ON node_labels(label)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_node_props_key_value ON node_props(prop_key, prop_value)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_edges_rel_type ON edges(rel_type)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_edges_start ON edges(start_node_key)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_edges_end ON edges(end_node_key)"
            )

    def _decode_node(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": str(row["id"]),
            "node_key": row["node_key"],
            "labels": _json_load(row["labels_json"]),
            "props": _json_load(row["props_json"]),
        }

    def _decode_edge(self, row: sqlite3.Row) -> Dict[str, Any]:
        return {
            "id": str(row["id"]),
            "edge_key": row["edge_key"],
            "rel_type": row["rel_type"],
            "start_node_key": row["start_node_key"],
            "end_node_key": row["end_node_key"],
            "props": _json_load(row["props_json"]),
        }

    def _node_exists(self, node_key: str) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM nodes WHERE node_key = ?",
            (node_key,),
        ).fetchone()
        return row is not None

    def _refresh_node_indexes(self, node_key: str, labels: List[str], props: Dict[str, Any]) -> None:
        self._conn.execute("DELETE FROM node_labels WHERE node_key = ?", (node_key,))
        self._conn.execute("DELETE FROM node_props WHERE node_key = ?", (node_key,))

        for label in sorted(set(labels)):
            self._conn.execute(
                "INSERT INTO node_labels(node_key, label) VALUES (?, ?)",
                (node_key, label),
            )

        for prop_key, raw_value in props.items():
            index_value = _to_index_value(raw_value)
            if index_value is None:
                continue
            self._conn.execute(
                "INSERT INTO node_props(node_key, prop_key, prop_value) VALUES (?, ?, ?)",
                (node_key, prop_key, index_value),
            )

    def upsert_node(self, node_key: str, labels: Sequence[str], props: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock, self._conn:
            existing = self._conn.execute(
                "SELECT labels_json, props_json FROM nodes WHERE node_key = ?",
                (node_key,),
            ).fetchone()

            if existing is None:
                merged_labels = sorted(set(labels))
                merged_props = dict(props)
                self._conn.execute(
                    "INSERT INTO nodes(node_key, labels_json, props_json) VALUES (?, ?, ?)",
                    (node_key, _json_dump(merged_labels), _json_dump(merged_props)),
                )
            else:
                old_labels = _json_load(existing["labels_json"])
                old_props = _json_load(existing["props_json"])
                merged_labels = sorted(set(old_labels) | set(labels))
                merged_props = dict(old_props)
                merged_props.update(props)
                self._conn.execute(
                    "UPDATE nodes SET labels_json = ?, props_json = ? WHERE node_key = ?",
                    (_json_dump(merged_labels), _json_dump(merged_props), node_key),
                )

            self._refresh_node_indexes(node_key, merged_labels, merged_props)
            row = self._conn.execute(
                "SELECT * FROM nodes WHERE node_key = ?",
                (node_key,),
            ).fetchone()
            return self._decode_node(row)

    def get_node_by_key(self, node_key: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM nodes WHERE node_key = ?",
                (node_key,),
            ).fetchone()
            if row is None:
                return None
            return self._decode_node(row)

    def get_node_by_id(self, node_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM nodes WHERE id = ?",
                (node_id,),
            ).fetchone()
            if row is None:
                return None
            return self._decode_node(row)

    def get_nodes_by_keys(self, node_keys: Sequence[str]) -> List[Dict[str, Any]]:
        if not node_keys:
            return []
        with self._lock:
            placeholders = ",".join("?" for _ in node_keys)
            rows = self._conn.execute(
                f"SELECT * FROM nodes WHERE node_key IN ({placeholders})",
                tuple(node_keys),
            ).fetchall()
            by_key = {row["node_key"]: self._decode_node(row) for row in rows}
        return [by_key[key] for key in node_keys if key in by_key]

    def find_node_keys(self, label: str, criteria: Dict[str, Any]) -> List[str]:
        with self._lock:
            if not criteria:
                rows = self._conn.execute(
                    "SELECT node_key FROM node_labels WHERE label = ?",
                    (label,),
                ).fetchall()
                return [row["node_key"] for row in rows]

            params: List[Any] = []
            joins: List[str] = []
            for index, (prop_key, prop_value) in enumerate(criteria.items()):
                idx_value = _to_index_value(prop_value)
                if idx_value is None:
                    return []
                alias = f"p{index}"
                joins.append(
                    f"JOIN node_props {alias} ON {alias}.node_key = nl.node_key "
                    f"AND {alias}.prop_key = ? AND {alias}.prop_value = ?"
                )
                params.extend([prop_key, idx_value])

            sql = " ".join(
                [
                    "SELECT DISTINCT nl.node_key",
                    "FROM node_labels nl",
                    *joins,
                    "WHERE nl.label = ?",
                ]
            )
            params.append(label)
            rows = self._conn.execute(sql, tuple(params)).fetchall()
            return [row["node_key"] for row in rows]

    def upsert_edge(
        self,
        rel_type: str,
        start_node_key: str,
        end_node_key: str,
        props: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        payload = dict(props or {})
        with self._lock, self._conn:
            if not self._node_exists(start_node_key) or not self._node_exists(end_node_key):
                return None

            edge_key = make_edge_key(rel_type, start_node_key, end_node_key)
            existing = self._conn.execute(
                "SELECT id, props_json FROM edges WHERE edge_key = ?",
                (edge_key,),
            ).fetchone()

            if existing is None:
                self._conn.execute(
                    """
INSERT INTO edges(edge_key, rel_type, start_node_key, end_node_key, props_json)
VALUES (?, ?, ?, ?, ?)
""",
                    (edge_key, rel_type, start_node_key, end_node_key, _json_dump(payload)),
                )
                row = self._conn.execute(
                    "SELECT id FROM edges WHERE edge_key = ?",
                    (edge_key,),
                ).fetchone()
                return str(row["id"])

            merged = _json_load(existing["props_json"])
            merged.update(payload)
            self._conn.execute(
                "UPDATE edges SET props_json = ? WHERE edge_key = ?",
                (_json_dump(merged), edge_key),
            )
            return str(existing["id"])

    def get_edge_by_id(self, edge_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM edges WHERE id = ?",
                (edge_id,),
            ).fetchone()
            if row is None:
                return None
            return self._decode_edge(row)

    def get_edges(
        self,
        start_keys: Optional[Sequence[str]] = None,
        end_keys: Optional[Sequence[str]] = None,
        rel_types: Optional[Sequence[str]] = None,
    ) -> List[Dict[str, Any]]:
        with self._lock:
            clauses: List[str] = ["1=1"]
            params: List[Any] = []

            if start_keys is not None:
                if not start_keys:
                    return []
                start_placeholders = ",".join("?" for _ in start_keys)
                clauses.append(f"start_node_key IN ({start_placeholders})")
                params.extend(start_keys)

            if end_keys is not None:
                if not end_keys:
                    return []
                end_placeholders = ",".join("?" for _ in end_keys)
                clauses.append(f"end_node_key IN ({end_placeholders})")
                params.extend(end_keys)

            if rel_types is not None:
                if not rel_types:
                    return []
                rel_placeholders = ",".join("?" for _ in rel_types)
                clauses.append(f"rel_type IN ({rel_placeholders})")
                params.extend(rel_types)

            sql = f"SELECT * FROM edges WHERE {' AND '.join(clauses)}"
            rows = self._conn.execute(sql, tuple(params)).fetchall()
            return [self._decode_edge(row) for row in rows]

    def list_nodes_by_label(self, label: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._lock:
            if limit is None:
                rows = self._conn.execute(
                    """
SELECT n.*
FROM nodes n
JOIN node_labels nl ON nl.node_key = n.node_key
WHERE nl.label = ?
""",
                    (label,),
                ).fetchall()
            else:
                rows = self._conn.execute(
                    """
SELECT n.*
FROM nodes n
JOIN node_labels nl ON nl.node_key = n.node_key
WHERE nl.label = ?
LIMIT ?
""",
                    (label, int(limit)),
                ).fetchall()
            return [self._decode_node(row) for row in rows]

    def list_labels(self) -> List[str]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT DISTINCT label FROM node_labels ORDER BY label",
            ).fetchall()
            return [row["label"] for row in rows]

    def list_relationship_types(self) -> List[str]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT DISTINCT rel_type FROM edges ORDER BY rel_type",
            ).fetchall()
            return [row["rel_type"] for row in rows]

    def count_nodes_by_label(self) -> Dict[str, int]:
        with self._lock:
            rows = self._conn.execute(
                """
SELECT nl.label AS label, COUNT(*) AS count
FROM node_labels nl
GROUP BY nl.label
ORDER BY count DESC
"""
            ).fetchall()
            return {row["label"]: int(row["count"]) for row in rows}

    def count_graph(self) -> Dict[str, int]:
        with self._lock:
            node_row = self._conn.execute("SELECT COUNT(*) AS c FROM nodes").fetchone()
            edge_row = self._conn.execute("SELECT COUNT(*) AS c FROM edges").fetchone()
            return {
                "node_count": int(node_row["c"] if node_row else 0),
                "rel_count": int(edge_row["c"] if edge_row else 0),
            }

    def update_node_property(self, node_id: str, key: str, value: Any) -> bool:
        with self._lock:
            node = self.get_node_by_id(node_id)
            if node is None:
                return False
            props = dict(node["props"])
            props[key] = value
        self.upsert_node(node["node_key"], node["labels"], props)
        return True

    def patch_node(self, node_id: str, patch: Dict[str, Any]) -> bool:
        with self._lock:
            node = self.get_node_by_id(node_id)
            if node is None:
                return False
            props = dict(node["props"])
            props.update(patch)
        self.upsert_node(node["node_key"], node["labels"], props)
        return True

    def update_edge_property(self, edge_id: str, key: str, value: Any) -> bool:
        with self._lock, self._conn:
            edge = self._conn.execute(
                "SELECT * FROM edges WHERE id = ?",
                (edge_id,),
            ).fetchone()
            if edge is None:
                return False
            props = _json_load(edge["props_json"])
            props[key] = value
            self._conn.execute(
                "UPDATE edges SET props_json = ? WHERE id = ?",
                (_json_dump(props), edge_id),
            )
            return True

    def create_node(self, labels: Sequence[str], props: Dict[str, Any]) -> str:
        node_key = f"manual:{uuid.uuid4().hex}"
        node = self.upsert_node(node_key=node_key, labels=list(labels), props=dict(props))
        return node["id"]

    def create_relationship(
        self,
        source_id: str,
        target_id: str,
        rel_type: str,
        props: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        source = self.get_node_by_id(source_id)
        target = self.get_node_by_id(target_id)
        if source is None or target is None:
            return None
        return self.upsert_edge(
            rel_type=rel_type,
            start_node_key=source["node_key"],
            end_node_key=target["node_key"],
            props=props or {},
        )

    def delete_node(self, node_id: str) -> bool:
        with self._lock, self._conn:
            existing = self._conn.execute(
                "SELECT 1 FROM nodes WHERE id = ?",
                (node_id,),
            ).fetchone()
            if existing is None:
                return False
            self._conn.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
            return True

    def delete_edge(self, edge_id: str) -> bool:
        with self._lock, self._conn:
            existing = self._conn.execute(
                "SELECT 1 FROM edges WHERE id = ?",
                (edge_id,),
            ).fetchone()
            if existing is None:
                return False
            self._conn.execute("DELETE FROM edges WHERE id = ?", (edge_id,))
            return True

    def search_nodes(self, label: str, prop_keys: Sequence[str], term: str, limit: int) -> List[Dict[str, Any]]:
        if not prop_keys or not term:
            return []
        lowered = term.lower()
        by_key: Dict[str, Dict[str, Any]] = {}

        with self._lock:
            for prop_key in prop_keys:
                rows = self._conn.execute(
                    """
SELECT DISTINCT n.*
FROM nodes n
JOIN node_labels nl ON nl.node_key = n.node_key
JOIN node_props p ON p.node_key = n.node_key
WHERE nl.label = ?
  AND p.prop_key = ?
  AND lower(p.prop_value) LIKE ?
LIMIT ?
""",
                    (label, prop_key, f"%{lowered}%", int(limit)),
                ).fetchall()
                for row in rows:
                    node = self._decode_node(row)
                    by_key[node["node_key"]] = node
                    if len(by_key) >= limit:
                        return list(by_key.values())[:limit]

        return list(by_key.values())[:limit]
