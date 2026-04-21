# Demo-Phase-1 Current State

Last updated: 2026-04-21

## Scope

This document captures the current implementation state of `Demo-Phase-1`, including architecture, run workflow, data flow, and known limitations.

## What exists today

- ETL pipeline (`mimic_to_kg.py`) that transforms MIMIC-IV style CSV/CSV.GZ tables into a patient-centric Neo4j knowledge graph.
- FastAPI backend (`backend/api.py`) that exposes graph query and edit endpoints for the UI.
- Two frontend directories:
  - `frontend/` (active React UI)
  - `frontend_new/` (alternate/newer UI work area)
- Developer scripts:
  - `setup.sh` to bootstrap environment and dependencies
  - `run-dev.sh` to run backend + frontend together with health checks

## Runtime stack

- Python virtual environment (`venv`) with dependencies from `requirements.txt`.
- FastAPI + Uvicorn backend.
- React + Node.js frontend.
- Neo4j database over Bolt (`NEO4J_URL`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`).

## Data and graph model status

- Expected input root: `physionet.org/files/mimic-iv-demo/2.2`.
- Supports `.csv` and `.csv.gz` table files from `hosp/` and `icu/`.
- Ingestion design preserves row-level provenance via source table/line fields.
- Core graph entities include Patient, Admission, ICUStay, Provider, Caregiver, dictionaries, and event-linked clinical nodes.
- Event rows are modeled as first-class `:ClinicalEvent` nodes with typed relationships.

## Current user-facing capabilities

- Select patient by `subject_id`.
- Visualize graph with WebGL rendering.
- Edit node and relationship properties.
- Create and delete nodes/relationships.
- Enforced graph size cap in UI to avoid browser overload.

## Current operational workflow

1. Run `./setup.sh` once.
2. Configure `.env` from `.env.example` with Neo4j credentials.
3. Optionally validate with dry run:
   - `./venv/bin/python mimic_to_kg.py --dry-run --max-rows-per-table 200`
4. Run full ingest as needed.
5. Start full app with `./run-dev.sh`.

## Known constraints and risks

- Local environment dependent: requires working Neo4j instance and compatible local ports.
- Large ingest jobs may require lower batch sizes and retry tuning.
- Frontend split across `frontend/` and `frontend_new/` indicates active transition state.
- Data schema assumptions are tied to MIMIC-like column structure; custom datasets may require updates in ETL specs.

## Suggested next milestones

1. Decide and document canonical frontend (`frontend` vs `frontend_new`).
2. Add automated smoke tests for backend health and core graph APIs.
3. Add ingestion validation report (row counts, skipped rows, error summary).
4. Add baseline deployment profile (single-command local + containerized option).
