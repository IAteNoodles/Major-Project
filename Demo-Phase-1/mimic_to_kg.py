#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple

from dotenv import load_dotenv
from neo4j import Driver, GraphDatabase


@dataclass(frozen=True)
class EntitySpec:
    relative_path: str
    label: str
    key_fields: Tuple[str, ...]

    @property
    def table_name(self) -> str:
        return table_name_from_path(self.relative_path)


@dataclass(frozen=True)
class LinkSpec:
    target_label: str
    rel_type: str
    key_map: Tuple[Tuple[str, str], ...]


@dataclass(frozen=True)
class EventSpec:
    relative_path: str
    label: str
    key_fields: Tuple[str, ...]
    link_patient: bool = True
    link_admission: bool = True
    link_stay: bool = False
    caregiver_field: Optional[str] = None
    provider_field: Optional[str] = None
    links: Tuple[LinkSpec, ...] = ()

    @property
    def table_name(self) -> str:
        return table_name_from_path(self.relative_path)


ENTITY_SPECS: Tuple[EntitySpec, ...] = (
    EntitySpec("hosp/patients.csv.gz", "Patient", ("subject_id",)),
    EntitySpec("hosp/admissions.csv.gz", "Admission", ("hadm_id",)),
    EntitySpec("icu/icustays.csv.gz", "ICUStay", ("stay_id",)),
    EntitySpec("hosp/provider.csv.gz", "Provider", ("provider_id",)),
    EntitySpec("icu/caregiver.csv.gz", "Caregiver", ("caregiver_id",)),
    EntitySpec("hosp/d_icd_diagnoses.csv.gz", "ICDDiagnosisCode", ("icd_code", "icd_version")),
    EntitySpec("hosp/d_icd_procedures.csv.gz", "ICDProcedureCode", ("icd_code", "icd_version")),
    EntitySpec("hosp/d_hcpcs.csv.gz", "HCPCSCode", ("code",)),
    EntitySpec("hosp/d_labitems.csv.gz", "LabItem", ("itemid",)),
    EntitySpec("icu/d_items.csv.gz", "ICUItem", ("itemid",)),
    EntitySpec("hosp/poe.csv.gz", "POEOrder", ("poe_id", "poe_seq")),
    EntitySpec("hosp/pharmacy.csv.gz", "PharmacyDispense", ("pharmacy_id",)),
)


EVENT_SPECS: Tuple[EventSpec, ...] = (
    EventSpec(
        "hosp/diagnoses_icd.csv.gz",
        "DiagnosisEvent",
        ("subject_id", "hadm_id", "seq_num", "icd_code", "icd_version"),
        links=(
            LinkSpec(
                target_label="ICDDiagnosisCode",
                rel_type="USES_ICD_DIAGNOSIS",
                key_map=(("icd_code", "icd_code"), ("icd_version", "icd_version")),
            ),
        ),
    ),
    EventSpec(
        "hosp/procedures_icd.csv.gz",
        "ProcedureCodeEvent",
        ("subject_id", "hadm_id", "seq_num", "chartdate", "icd_code", "icd_version"),
        links=(
            LinkSpec(
                target_label="ICDProcedureCode",
                rel_type="USES_ICD_PROCEDURE",
                key_map=(("icd_code", "icd_code"), ("icd_version", "icd_version")),
            ),
        ),
    ),
    EventSpec(
        "hosp/hcpcsevents.csv.gz",
        "HCPCSEvent",
        ("subject_id", "hadm_id", "chartdate", "hcpcs_cd", "seq_num"),
        links=(
            LinkSpec(
                target_label="HCPCSCode",
                rel_type="USES_HCPCS",
                key_map=(("hcpcs_cd", "code"),),
            ),
        ),
    ),
    EventSpec(
        "hosp/labevents.csv.gz",
        "LabEvent",
        ("labevent_id",),
        provider_field="order_provider_id",
        links=(
            LinkSpec(
                target_label="LabItem",
                rel_type="MEASURES_LAB_ITEM",
                key_map=(("itemid", "itemid"),),
            ),
        ),
    ),
    EventSpec(
        "hosp/microbiologyevents.csv.gz",
        "MicrobiologyEvent",
        ("microevent_id",),
        provider_field="order_provider_id",
        links=(
            LinkSpec(
                target_label="LabItem",
                rel_type="HAS_SPECIMEN_ITEM",
                key_map=(("spec_itemid", "itemid"),),
            ),
            LinkSpec(
                target_label="LabItem",
                rel_type="HAS_TEST_ITEM",
                key_map=(("test_itemid", "itemid"),),
            ),
        ),
    ),
    EventSpec(
        "hosp/drgcodes.csv.gz",
        "DRGEvent",
        ("subject_id", "hadm_id", "drg_type", "drg_code"),
    ),
    EventSpec(
        "hosp/omr.csv.gz",
        "OMREvent",
        ("subject_id", "chartdate", "seq_num", "result_name"),
        link_admission=False,
    ),
    EventSpec(
        "hosp/services.csv.gz",
        "ServiceEvent",
        ("subject_id", "hadm_id", "transfertime", "curr_service"),
    ),
    EventSpec(
        "hosp/transfers.csv.gz",
        "TransferEvent",
        ("transfer_id",),
    ),
    EventSpec(
        "hosp/prescriptions.csv.gz",
        "PrescriptionEvent",
        ("subject_id", "hadm_id", "pharmacy_id", "poe_id", "poe_seq", "starttime"),
        provider_field="order_provider_id",
        links=(
            LinkSpec(
                target_label="POEOrder",
                rel_type="FROM_POE_ORDER",
                key_map=(("poe_id", "poe_id"), ("poe_seq", "poe_seq")),
            ),
            LinkSpec(
                target_label="PharmacyDispense",
                rel_type="FROM_PHARMACY_DISPENSE",
                key_map=(("pharmacy_id", "pharmacy_id"),),
            ),
        ),
    ),
    EventSpec(
        "hosp/emar.csv.gz",
        "EMAREvent",
        ("emar_id", "emar_seq"),
        provider_field="enter_provider_id",
        links=(
            LinkSpec(
                target_label="PharmacyDispense",
                rel_type="FROM_PHARMACY_DISPENSE",
                key_map=(("pharmacy_id", "pharmacy_id"),),
            ),
        ),
    ),
    EventSpec(
        "hosp/emar_detail.csv.gz",
        "EMARDetailEvent",
        ("emar_id", "emar_seq", "parent_field_ordinal"),
        link_admission=False,
        links=(
            LinkSpec(
                target_label="EMAREvent",
                rel_type="DETAIL_OF",
                key_map=(("emar_id", "emar_id"), ("emar_seq", "emar_seq")),
            ),
            LinkSpec(
                target_label="PharmacyDispense",
                rel_type="FROM_PHARMACY_DISPENSE",
                key_map=(("pharmacy_id", "pharmacy_id"),),
            ),
        ),
    ),
    EventSpec(
        "hosp/poe_detail.csv.gz",
        "POEDetailEvent",
        ("poe_id", "poe_seq", "field_name", "field_value"),
        link_admission=False,
        links=(
            LinkSpec(
                target_label="POEOrder",
                rel_type="DETAIL_OF",
                key_map=(("poe_id", "poe_id"), ("poe_seq", "poe_seq")),
            ),
        ),
    ),
    EventSpec(
        "icu/chartevents.csv.gz",
        "ChartEvent",
        ("subject_id", "hadm_id", "stay_id", "charttime", "storetime", "itemid", "caregiver_id"),
        link_stay=True,
        caregiver_field="caregiver_id",
        links=(
            LinkSpec(
                target_label="ICUItem",
                rel_type="MEASURES_ICU_ITEM",
                key_map=(("itemid", "itemid"),),
            ),
        ),
    ),
    EventSpec(
        "icu/datetimeevents.csv.gz",
        "DateTimeEvent",
        ("subject_id", "hadm_id", "stay_id", "charttime", "storetime", "itemid", "caregiver_id"),
        link_stay=True,
        caregiver_field="caregiver_id",
        links=(
            LinkSpec(
                target_label="ICUItem",
                rel_type="MEASURES_ICU_ITEM",
                key_map=(("itemid", "itemid"),),
            ),
        ),
    ),
    EventSpec(
        "icu/inputevents.csv.gz",
        "InputEvent",
        ("subject_id", "hadm_id", "stay_id", "starttime", "endtime", "itemid", "orderid"),
        link_stay=True,
        caregiver_field="caregiver_id",
        links=(
            LinkSpec(
                target_label="ICUItem",
                rel_type="USES_ICU_ITEM",
                key_map=(("itemid", "itemid"),),
            ),
        ),
    ),
    EventSpec(
        "icu/outputevents.csv.gz",
        "OutputEvent",
        ("subject_id", "hadm_id", "stay_id", "charttime", "itemid", "caregiver_id"),
        link_stay=True,
        caregiver_field="caregiver_id",
        links=(
            LinkSpec(
                target_label="ICUItem",
                rel_type="USES_ICU_ITEM",
                key_map=(("itemid", "itemid"),),
            ),
        ),
    ),
    EventSpec(
        "icu/procedureevents.csv.gz",
        "ICUProcedureEvent",
        ("subject_id", "hadm_id", "stay_id", "starttime", "endtime", "itemid", "orderid"),
        link_stay=True,
        caregiver_field="caregiver_id",
        links=(
            LinkSpec(
                target_label="ICUItem",
                rel_type="USES_ICU_ITEM",
                key_map=(("itemid", "itemid"),),
            ),
        ),
    ),
    EventSpec(
        "icu/ingredientevents.csv.gz",
        "IngredientEvent",
        ("subject_id", "hadm_id", "stay_id", "starttime", "endtime", "itemid", "orderid"),
        link_stay=True,
        caregiver_field="caregiver_id",
        links=(
            LinkSpec(
                target_label="ICUItem",
                rel_type="USES_ICU_ITEM",
                key_map=(("itemid", "itemid"),),
            ),
        ),
    ),
)


def table_name_from_path(relative_path: str) -> str:
    name = Path(relative_path).name
    if name.endswith(".csv.gz"):
        return name[:-7]
    if name.endswith(".csv"):
        return name[:-4]
    return name


def normalize_row(raw_row: Dict[str, Optional[str]]) -> Dict[str, Optional[str]]:
    clean: Dict[str, Optional[str]] = {}
    for key, value in raw_row.items():
        if key is None:
            continue
        if value is None or value == "":
            clean[key] = None
        else:
            clean[key] = value
    return clean


def row_to_props(row: Dict[str, Optional[str]], table_name: str, line_no: int) -> Dict[str, Any]:
    props: Dict[str, Any] = {key: value for key, value in row.items() if value is not None}
    props["source_table"] = table_name
    props["source_line"] = line_no
    return props


def build_event_uid(
    table_name: str,
    row: Dict[str, Optional[str]],
    line_no: int,
    key_fields: Sequence[str],
) -> str:
    has_all_keys = bool(key_fields) and all(row.get(field) is not None for field in key_fields)
    if has_all_keys:
        payload = "|".join(str(row[field]) for field in key_fields)
    else:
        payload = json.dumps(row, sort_keys=True, ensure_ascii=True)
    digest = hashlib.sha1(payload.encode("utf-8")).hexdigest()[:16]
    return f"{table_name}:{digest}:{line_no}"


def iter_csv_rows(file_path: Path, max_rows: Optional[int] = None) -> Iterator[Tuple[int, Dict[str, Optional[str]]]]:
    opener = gzip.open if file_path.suffix == ".gz" else open
    with opener(file_path, "rt", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for index, raw_row in enumerate(reader, start=2):
            if max_rows is not None and index - 1 > max_rows:
                break
            yield index, normalize_row(raw_row)


class MimicKGBuilder:
    def __init__(
        self,
        data_root: Path,
        driver: Optional[Driver],
        database: str,
        batch_size: int,
        max_rows_per_table: Optional[int],
        write_retries: int,
        write_retry_delay_seconds: float,
        dry_run: bool,
    ) -> None:
        self.data_root = data_root
        self.driver = driver
        self.database = database
        self.batch_size = batch_size
        self.max_rows_per_table = max_rows_per_table
        self.write_retries = write_retries
        self.write_retry_delay_seconds = write_retry_delay_seconds
        self.dry_run = dry_run
        self.import_stats: Dict[str, Dict[str, Any]] = {}

    def run(self, selected_tables: Optional[set[str]], drop_existing: bool, skip_constraints: bool) -> None:
        logging.info("Data root: %s", self.data_root)
        if not self.data_root.exists():
            raise FileNotFoundError(f"Data root not found: {self.data_root}")

        if not self.dry_run:
            if drop_existing:
                self._clear_database()
            if not skip_constraints:
                self._create_constraints()

        for spec in ENTITY_SPECS:
            if selected_tables and spec.table_name not in selected_tables:
                continue
            self._ingest_entity_table(spec)

        if not self.dry_run:
            self._create_core_relationships()

        for spec in EVENT_SPECS:
            if selected_tables and spec.table_name not in selected_tables:
                continue
            self._ingest_event_table(spec)

        self._log_summary()

    def _resolve_table_path(self, relative_path: str) -> Optional[Path]:
        primary = self.data_root / relative_path
        if primary.exists():
            return primary

        if relative_path.endswith(".csv.gz"):
            fallback = self.data_root / relative_path[:-3]
            if fallback.exists():
                return fallback

        if relative_path.endswith(".csv"):
            fallback = self.data_root / f"{relative_path}.gz"
            if fallback.exists():
                return fallback

        return None

    def _create_constraints(self) -> None:
        queries = (
            "CREATE CONSTRAINT patient_subject_id IF NOT EXISTS FOR (n:Patient) REQUIRE n.subject_id IS UNIQUE",
            "CREATE CONSTRAINT admission_hadm_id IF NOT EXISTS FOR (n:Admission) REQUIRE n.hadm_id IS UNIQUE",
            "CREATE CONSTRAINT icustay_stay_id IF NOT EXISTS FOR (n:ICUStay) REQUIRE n.stay_id IS UNIQUE",
            "CREATE CONSTRAINT provider_id IF NOT EXISTS FOR (n:Provider) REQUIRE n.provider_id IS UNIQUE",
            "CREATE CONSTRAINT caregiver_id IF NOT EXISTS FOR (n:Caregiver) REQUIRE n.caregiver_id IS UNIQUE",
            "CREATE CONSTRAINT icd_diag_code IF NOT EXISTS FOR (n:ICDDiagnosisCode) REQUIRE (n.icd_code, n.icd_version) IS UNIQUE",
            "CREATE CONSTRAINT icd_proc_code IF NOT EXISTS FOR (n:ICDProcedureCode) REQUIRE (n.icd_code, n.icd_version) IS UNIQUE",
            "CREATE CONSTRAINT hcpcs_code IF NOT EXISTS FOR (n:HCPCSCode) REQUIRE n.code IS UNIQUE",
            "CREATE CONSTRAINT labitem_id IF NOT EXISTS FOR (n:LabItem) REQUIRE n.itemid IS UNIQUE",
            "CREATE CONSTRAINT icuitem_id IF NOT EXISTS FOR (n:ICUItem) REQUIRE n.itemid IS UNIQUE",
            "CREATE CONSTRAINT poe_order IF NOT EXISTS FOR (n:POEOrder) REQUIRE (n.poe_id, n.poe_seq) IS UNIQUE",
            "CREATE CONSTRAINT pharmacy_dispense IF NOT EXISTS FOR (n:PharmacyDispense) REQUIRE n.pharmacy_id IS UNIQUE",
            "CREATE CONSTRAINT event_row_uid IF NOT EXISTS FOR (n:ClinicalEvent) REQUIRE n.row_uid IS UNIQUE",
            "CREATE INDEX event_source_table IF NOT EXISTS FOR (n:ClinicalEvent) ON (n.source_table)",
        )
        for query in queries:
            self._write(query, {})

    def _clear_database(self) -> None:
        logging.warning("Dropping existing graph data")
        self._write("MATCH (n) DETACH DELETE n", {})

    def _write(self, query: str, params: Dict[str, Any]) -> None:
        if self.dry_run:
            return
        if self.driver is None:
            raise RuntimeError("Driver unavailable for write")
        attempts = self.write_retries + 1
        for attempt in range(1, attempts + 1):
            try:
                with self.driver.session(database=self.database) as session:
                    session.execute_write(lambda tx: tx.run(query, **params).consume())
                return
            except Exception as exc:
                if attempt >= attempts:
                    raise
                sleep_seconds = self.write_retry_delay_seconds * attempt
                logging.warning(
                    "Write failed (%s). Retry %s/%s in %.1fs",
                    type(exc).__name__,
                    attempt,
                    self.write_retries,
                    sleep_seconds,
                )
                time.sleep(sleep_seconds)

    def _read_single(self, query: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if self.driver is None:
            return {}
        with self.driver.session(database=self.database) as session:
            record = session.execute_read(lambda tx: tx.run(query, **params).single())
            if record is None:
                return {}
            return dict(record.items())

    def _ingest_entity_table(self, spec: EntitySpec) -> None:
        file_path = self._resolve_table_path(spec.relative_path)
        if file_path is None:
            logging.warning("Missing table, skip entity ingest: %s", spec.relative_path)
            return

        logging.info("Ingest entity table: %s", spec.table_name)
        ingested = 0
        skipped = 0
        batch: List[Dict[str, Any]] = []

        for line_no, row in iter_csv_rows(file_path, self.max_rows_per_table):
            if any(row.get(key) is None for key in spec.key_fields):
                skipped += 1
                continue

            keys = {key: row[key] for key in spec.key_fields}
            props = row_to_props(row, spec.table_name, line_no)
            batch.append({"keys": keys, "props": props})
            ingested += 1

            if len(batch) >= self.batch_size:
                self._flush_entity_batch(spec.label, spec.key_fields, batch)
                batch = []

        if batch:
            self._flush_entity_batch(spec.label, spec.key_fields, batch)

        self.import_stats[spec.table_name] = {
            "kind": "entity",
            "rows": ingested,
            "skipped": skipped,
            "file": str(file_path),
        }

    def _flush_entity_batch(
        self,
        label: str,
        key_fields: Sequence[str],
        rows: List[Dict[str, Any]],
    ) -> None:
        if not rows:
            return
        key_map = ", ".join(f"{key}: row.keys.{key}" for key in key_fields)
        query = f"""
UNWIND $rows AS row
MERGE (n:{label} {{{key_map}}})
SET n += row.props
"""
        self._write(query, {"rows": rows})

    def _create_core_relationships(self) -> None:
        logging.info("Creating core relationships")
        queries = (
            """
MATCH (a:Admission)
WHERE a.subject_id IS NOT NULL
MATCH (p:Patient {subject_id: a.subject_id})
MERGE (p)-[r:HAS_ADMISSION]->(a)
SET r.admittime = a.admittime,
    r.dischtime = a.dischtime,
    r.deathtime = a.deathtime
""",
            """
MATCH (s:ICUStay)
WHERE s.hadm_id IS NOT NULL
MATCH (a:Admission {hadm_id: s.hadm_id})
MERGE (a)-[:HAS_ICUSTAY]->(s)
""",
            """
MATCH (s:ICUStay)
WHERE s.subject_id IS NOT NULL
MATCH (p:Patient {subject_id: s.subject_id})
MERGE (p)-[:HAS_ICUSTAY]->(s)
""",
            """
MATCH (o:POEOrder)
WHERE o.subject_id IS NOT NULL
MATCH (p:Patient {subject_id: o.subject_id})
MERGE (p)-[:HAS_ORDER]->(o)
""",
            """
MATCH (o:POEOrder)
WHERE o.hadm_id IS NOT NULL
MATCH (a:Admission {hadm_id: o.hadm_id})
MERGE (a)-[:HAS_ORDER]->(o)
""",
            """
MATCH (o:POEOrder)
WHERE o.order_provider_id IS NOT NULL
MATCH (pr:Provider {provider_id: o.order_provider_id})
MERGE (pr)-[:PLACED_ORDER]->(o)
""",
            """
MATCH (d:PharmacyDispense)
WHERE d.subject_id IS NOT NULL
MATCH (p:Patient {subject_id: d.subject_id})
MERGE (p)-[:HAS_PHARMACY_ORDER]->(d)
""",
            """
MATCH (d:PharmacyDispense)
WHERE d.hadm_id IS NOT NULL
MATCH (a:Admission {hadm_id: d.hadm_id})
MERGE (a)-[:HAS_PHARMACY_ORDER]->(d)
""",
            """
MATCH (d:PharmacyDispense)
WHERE d.poe_id IS NOT NULL
MATCH (o:POEOrder {poe_id: d.poe_id})
MERGE (d)-[:DISPENSES_FOR_ORDER]->(o)
""",
        )
        for query in queries:
            self._write(query, {})

    def _ingest_event_table(self, spec: EventSpec) -> None:
        file_path = self._resolve_table_path(spec.relative_path)
        if file_path is None:
            logging.warning("Missing table, skip event ingest: %s", spec.relative_path)
            return

        logging.info("Ingest event table: %s", spec.table_name)
        ingested = 0
        skipped = 0
        event_rows: List[Dict[str, Any]] = []
        patient_rows: List[Dict[str, Any]] = []
        admission_rows: List[Dict[str, Any]] = []
        stay_rows: List[Dict[str, Any]] = []
        caregiver_rows: List[Dict[str, Any]] = []
        provider_rows: List[Dict[str, Any]] = []
        link_rows: List[List[Dict[str, Any]]] = [[] for _ in spec.links]

        for line_no, row in iter_csv_rows(file_path, self.max_rows_per_table):
            row_uid = build_event_uid(spec.table_name, row, line_no, spec.key_fields)
            props = row_to_props(row, spec.table_name, line_no)
            props["row_uid"] = row_uid
            event_rows.append({"row_uid": row_uid, "props": props})
            ingested += 1

            subject_id = row.get("subject_id")
            hadm_id = row.get("hadm_id")
            stay_id = row.get("stay_id")

            if spec.link_patient and subject_id is not None:
                patient_rows.append({"row_uid": row_uid, "subject_id": subject_id})
            if spec.link_admission and hadm_id is not None:
                admission_rows.append({"row_uid": row_uid, "hadm_id": hadm_id})
            if spec.link_stay and stay_id is not None:
                stay_rows.append({"row_uid": row_uid, "stay_id": stay_id})

            if spec.caregiver_field:
                caregiver_id = row.get(spec.caregiver_field)
                if caregiver_id is not None:
                    caregiver_rows.append({"row_uid": row_uid, "caregiver_id": caregiver_id})

            if spec.provider_field:
                provider_id = row.get(spec.provider_field)
                if provider_id is not None:
                    provider_rows.append({"row_uid": row_uid, "provider_id": provider_id})

            for link_index, link_spec in enumerate(spec.links):
                target_payload: Dict[str, Any] = {}
                complete = True
                for row_field, target_field in link_spec.key_map:
                    value = row.get(row_field)
                    if value is None:
                        complete = False
                        break
                    target_payload[target_field] = value

                if complete:
                    link_rows[link_index].append({"row_uid": row_uid, "target": target_payload})
                else:
                    skipped += 1

            if len(event_rows) >= self.batch_size:
                self._flush_event_batches(
                    spec,
                    event_rows,
                    patient_rows,
                    admission_rows,
                    stay_rows,
                    caregiver_rows,
                    provider_rows,
                    link_rows,
                )
                event_rows = []
                patient_rows = []
                admission_rows = []
                stay_rows = []
                caregiver_rows = []
                provider_rows = []
                link_rows = [[] for _ in spec.links]

        if event_rows:
            self._flush_event_batches(
                spec,
                event_rows,
                patient_rows,
                admission_rows,
                stay_rows,
                caregiver_rows,
                provider_rows,
                link_rows,
            )

        self.import_stats[spec.table_name] = {
            "kind": "event",
            "rows": ingested,
            "skipped_link_rows": skipped,
            "file": str(file_path),
        }

    def _flush_event_batches(
        self,
        spec: EventSpec,
        event_rows: List[Dict[str, Any]],
        patient_rows: List[Dict[str, Any]],
        admission_rows: List[Dict[str, Any]],
        stay_rows: List[Dict[str, Any]],
        caregiver_rows: List[Dict[str, Any]],
        provider_rows: List[Dict[str, Any]],
        link_rows: List[List[Dict[str, Any]]],
    ) -> None:
        self._merge_event_nodes(spec.label, event_rows)

        if patient_rows:
            self._merge_parent_links(
                source_label="Patient",
                source_key="subject_id",
                rel_type="HAS_EVENT",
                rows=patient_rows,
                row_field="subject_id",
            )
        if admission_rows:
            self._merge_parent_links(
                source_label="Admission",
                source_key="hadm_id",
                rel_type="HAS_EVENT",
                rows=admission_rows,
                row_field="hadm_id",
            )
        if stay_rows:
            self._merge_parent_links(
                source_label="ICUStay",
                source_key="stay_id",
                rel_type="HAS_EVENT",
                rows=stay_rows,
                row_field="stay_id",
            )
        if caregiver_rows:
            self._merge_parent_links(
                source_label="Caregiver",
                source_key="caregiver_id",
                rel_type="RECORDED_EVENT",
                rows=caregiver_rows,
                row_field="caregiver_id",
            )
        if provider_rows:
            self._merge_parent_links(
                source_label="Provider",
                source_key="provider_id",
                rel_type="ORDERED_EVENT",
                rows=provider_rows,
                row_field="provider_id",
            )

        for link_spec, rows in zip(spec.links, link_rows):
            if rows:
                self._merge_event_target_links(link_spec, rows)

    def _merge_event_nodes(self, event_label: str, rows: List[Dict[str, Any]]) -> None:
        if not rows:
            return
        query = f"""
UNWIND $rows AS row
MERGE (e:ClinicalEvent:{event_label} {{row_uid: row.row_uid}})
SET e += row.props
"""
        self._write(query, {"rows": rows})

    def _merge_parent_links(
        self,
        source_label: str,
        source_key: str,
        rel_type: str,
        rows: List[Dict[str, Any]],
        row_field: str,
    ) -> None:
        query = f"""
UNWIND $rows AS row
MATCH (s:{source_label} {{{source_key}: row.{row_field}}})
MATCH (e:ClinicalEvent {{row_uid: row.row_uid}})
MERGE (s)-[:{rel_type}]->(e)
"""
        self._write(query, {"rows": rows})

    def _merge_event_target_links(self, link_spec: LinkSpec, rows: List[Dict[str, Any]]) -> None:
        target_match = ", ".join(
            f"{target_key}: row.target.{target_key}" for _, target_key in link_spec.key_map
        )
        query = f"""
UNWIND $rows AS row
MATCH (e:ClinicalEvent {{row_uid: row.row_uid}})
MATCH (t:{link_spec.target_label} {{{target_match}}})
MERGE (e)-[:{link_spec.rel_type}]->(t)
"""
        self._write(query, {"rows": rows})

    def _log_summary(self) -> None:
        total_rows = 0
        logging.info("Import summary")
        for table_name, stats in sorted(self.import_stats.items()):
            rows = int(stats.get("rows", 0))
            total_rows += rows
            if stats["kind"] == "entity":
                logging.info(
                    "  %-24s kind=%s rows=%s skipped=%s",
                    table_name,
                    stats["kind"],
                    rows,
                    stats.get("skipped", 0),
                )
            else:
                logging.info(
                    "  %-24s kind=%s rows=%s skipped_link_rows=%s",
                    table_name,
                    stats["kind"],
                    rows,
                    stats.get("skipped_link_rows", 0),
                )

        logging.info("Total rows processed: %s", total_rows)

        if not self.dry_run:
            counts = self._read_single(
                """
MATCH (n) WITH count(n) AS node_count
MATCH ()-[r]->() WITH node_count, count(r) AS rel_count
RETURN node_count, rel_count
""",
                {},
            )
            if counts:
                logging.info(
                    "Graph size: nodes=%s relationships=%s",
                    counts.get("node_count", 0),
                    counts.get("rel_count", 0),
                )


def parse_table_filter(table_values: Optional[str]) -> Optional[set[str]]:
    if not table_values:
        return None
    names = [chunk.strip() for chunk in table_values.split(",") if chunk.strip()]
    return set(names) if names else None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert MIMIC-IV like structured data into Neo4j KG")
    parser.add_argument(
        "--data-root",
        default="physionet.org/files/mimic-iv-demo/2.2",
        help="Root folder containing hosp/ and icu/ tables",
    )
    parser.add_argument("--env-file", default=".env", help="Path to env file with Neo4j credentials")
    parser.add_argument("--neo4j-uri", default=None, help="Neo4j URI, overrides env")
    parser.add_argument("--neo4j-user", default=None, help="Neo4j username, overrides env")
    parser.add_argument("--neo4j-password", default=None, help="Neo4j password, overrides env")
    parser.add_argument("--neo4j-database", default=None, help="Neo4j database name, overrides env")
    parser.add_argument("--batch-size", type=int, default=300, help="Batch size for UNWIND writes")
    parser.add_argument(
        "--write-retries",
        type=int,
        default=6,
        help="Retry attempts per write transaction",
    )
    parser.add_argument(
        "--write-retry-delay-seconds",
        type=float,
        default=1.0,
        help="Base sleep before transaction retry",
    )
    parser.add_argument(
        "--connection-timeout-seconds",
        type=float,
        default=30.0,
        help="Neo4j connection timeout seconds",
    )
    parser.add_argument(
        "--max-connection-lifetime-seconds",
        type=float,
        default=180.0,
        help="Neo4j pooled connection lifetime seconds",
    )
    parser.add_argument(
        "--max-transaction-retry-seconds",
        type=float,
        default=120.0,
        help="Neo4j driver transaction retry budget seconds",
    )
    parser.add_argument(
        "--max-connection-pool-size",
        type=int,
        default=50,
        help="Neo4j driver connection pool size",
    )
    parser.add_argument(
        "--max-rows-per-table",
        type=int,
        default=None,
        help="Optional safety limit per table (useful for testing)",
    )
    parser.add_argument(
        "--tables",
        default=None,
        help="Comma-separated table names (without extension) to ingest",
    )
    parser.add_argument("--drop-existing", action="store_true", help="Delete existing graph before ingest")
    parser.add_argument("--skip-constraints", action="store_true", help="Skip creating constraints and indexes")
    parser.add_argument("--dry-run", action="store_true", help="Read files and log counts without writing")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")
    return parser.parse_args()


def resolve_connection_config(args: argparse.Namespace) -> Tuple[str, str, Optional[str], str]:
    load_dotenv(args.env_file)
    uri = args.neo4j_uri or os.getenv("NEO4J_URL") or os.getenv("neo4j_url") or "bolt://127.0.0.1:7687"
    user = args.neo4j_user or os.getenv("NEO4J_USERNAME") or os.getenv("username") or "neo4j"
    password = args.neo4j_password or os.getenv("NEO4J_PASSWORD") or os.getenv("password")
    database = args.neo4j_database or os.getenv("NEO4J_DATABASE") or os.getenv("database") or "neo4j"
    return uri, user, password, database


def connect_driver(
    uri: str,
    user: str,
    password: str,
    connection_timeout_seconds: float,
    max_connection_lifetime_seconds: float,
    max_transaction_retry_seconds: float,
    max_connection_pool_size: int,
) -> Driver:
    driver_kwargs = {
        "connection_timeout": connection_timeout_seconds,
        "max_connection_lifetime": max_connection_lifetime_seconds,
        "max_transaction_retry_time": max_transaction_retry_seconds,
        "max_connection_pool_size": max_connection_pool_size,
        "keep_alive": True,
    }
    driver = GraphDatabase.driver(uri, auth=(user, password), **driver_kwargs)
    try:
        driver.verify_connectivity()
        return driver
    except Exception as exc:
        driver.close()
        if uri.startswith("neo4j://"):
            fallback_uri = "bolt://" + uri[len("neo4j://") :]
            logging.warning("Primary URI failed (%s). Retry with %s", exc, fallback_uri)
            fallback_driver = GraphDatabase.driver(fallback_uri, auth=(user, password), **driver_kwargs)
            fallback_driver.verify_connectivity()
            return fallback_driver
        raise


def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    selected_tables = parse_table_filter(args.tables)
    data_root = Path(args.data_root).resolve()

    driver: Optional[Driver] = None
    database_name = args.neo4j_database or os.getenv("NEO4J_DATABASE") or os.getenv("database") or "neo4j"
    if not args.dry_run:
        uri, user, password, database_name = resolve_connection_config(args)
        if not password:
            raise ValueError("Neo4j password missing. Set it in .env or pass --neo4j-password")
        driver = connect_driver(
            uri=uri,
            user=user,
            password=password,
            connection_timeout_seconds=args.connection_timeout_seconds,
            max_connection_lifetime_seconds=args.max_connection_lifetime_seconds,
            max_transaction_retry_seconds=args.max_transaction_retry_seconds,
            max_connection_pool_size=args.max_connection_pool_size,
        )
        logging.info("Connected to Neo4j at %s (database=%s)", uri, database_name)

    try:
        builder = MimicKGBuilder(
            data_root=data_root,
            driver=driver,
            database=database_name,
            batch_size=args.batch_size,
            max_rows_per_table=args.max_rows_per_table,
            write_retries=args.write_retries,
            write_retry_delay_seconds=args.write_retry_delay_seconds,
            dry_run=args.dry_run,
        )
        builder.run(
            selected_tables=selected_tables,
            drop_existing=args.drop_existing,
            skip_constraints=args.skip_constraints,
        )
    finally:
        if driver is not None:
            driver.close()


if __name__ == "__main__":
    main()
