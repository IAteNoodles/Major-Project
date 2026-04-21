# MIMIC Structured Data to Patient Knowledge Graph

Structured pipeline. No LLM. Converts MIMIC-IV style CSV/CSV.GZ tables into patient-centric property graph in Neo4j. Includes optimized React + FastAPI graph workbench.

## What this project builds

- `mimic_to_kg.py`: ETL pipeline from MIMIC-like tables -> Neo4j KG
- `backend/api.py`: FastAPI backend for patient graph query + CRUD edits
- `frontend/`: React app for graph visualization and editing
- `requirements.txt`: Python dependencies

Graph preserves row-level detail by storing source table and line for each imported record. Event tables become `:ClinicalEvent` nodes with table-specific labels.

## Environment

- OS: Arch Linux (or compatible Linux)
- Python virtual env: `venv`
- Node.js + npm (for React UI)
- Neo4j: local or remote instance with Bolt enabled

## Install

From project root (`Demo-Phase-1`):

```bash
./venv/bin/pip install -r requirements.txt
```

Frontend dependencies:

```bash
cd frontend
npm install
```

## Clone-and-run quick start

From repository root:

```bash
git clone https://github.com/IAteNoodles/Major_Project.git
cd Major_Project/Demo-Phase-1
./setup.sh
./run-dev.sh
```

Then open `http://127.0.0.1:5173`.

`setup.sh` creates `venv`, installs backend/frontend dependencies, and creates `.env` from `.env.example`.

`run-dev.sh` starts backend + frontend together, injects `VITE_API_BASE`, checks health endpoints, and stops both on Ctrl+C.

## Neo4j config

Create/update `.env`:

```env
NEO4J_URL=bolt://127.0.0.1:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j
```

Compatibility note: backend also accepts lowercase legacy keys (`neo4j_url`, `username`, `password`, `database`).

Optional CORS settings in `.env`:

```env
CORS_ALLOW_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
CORS_ALLOW_ORIGIN_REGEX=^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$
CORS_ALLOW_CREDENTIALS=true
```

If running Neo4j on Windows and app in WSL, use host gateway IP instead of `127.0.0.1`.

## Input data layout

Default root expected:

`physionet.org/files/mimic-iv-demo/2.2`

Must contain `hosp/` and `icu/` table files. Supports `.csv.gz` and `.csv`.

## Run ingestion

### 1) Dry run (safe check)

```bash
./venv/bin/python mimic_to_kg.py --dry-run --max-rows-per-table 200
```

### 2) Full ingest

```bash
./venv/bin/python mimic_to_kg.py --drop-existing
```

Useful flags:

- `--data-root <path>`: custom MIMIC-like root
- `--batch-size 300`: Neo4j UNWIND batch size (lower safer over WSL->Windows)
- `--tables admissions,patients,labevents`: ingest selected tables only
- `--max-rows-per-table 50000`: cap rows for testing
- `--skip-constraints`: skip indexes/constraints creation
- `--write-retries 6`: retry each write transaction
- `--write-retry-delay-seconds 1.0`: backoff base delay
- `--connection-timeout-seconds 30`: Neo4j connect timeout
- `--max-transaction-retry-seconds 120`: driver retry budget
- `--max-connection-pool-size 50`: pool size

## Run API + React UI

### Single command (recommended)

```bash
./run-dev.sh
```

Optional overrides:

```bash
BACKEND_PORT=18000 FRONTEND_PORT=15173 ./run-dev.sh
FRONTEND_DIR=frontend_new ./run-dev.sh
```

### Manual start (two terminals)

Start backend:

```bash
./venv/bin/uvicorn backend.api:app --host 0.0.0.0 --port 8000
```

Start frontend in second terminal:

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

Open `http://localhost:5173`.

UI features:

- pick patient by `subject_id`
- hardware-accelerated WebGL graph (`react-force-graph-3d`)
- edit node properties / patch node JSON
- edit relationship properties
- create node and relationship
- delete node/relationship
- hard cap: max 1000 nodes returned (prevents browser freeze)

## Graph model (high level)

Core entities:

- `Patient(subject_id)`
- `Admission(hadm_id)`
- `ICUStay(stay_id)`
- `Provider(provider_id)`
- `Caregiver(caregiver_id)`
- code dictionaries (`ICDDiagnosisCode`, `ICDProcedureCode`, `HCPCSCode`, `LabItem`, `ICUItem`)
- order/dispense entities (`POEOrder`, `PharmacyDispense`)

Event tables -> nodes:

- each row becomes `(:ClinicalEvent:<TableEventLabel> { ...all row properties... })`
- keeps `source_table`, `source_line`, and deterministic `row_uid`

Main edges:

- `Patient-[:HAS_ADMISSION]->Admission`
- `Admission-[:HAS_ICUSTAY]->ICUStay`
- `Patient/Admission/ICUStay-[:HAS_EVENT]->ClinicalEvent`
- `Provider-[:ORDERED_EVENT]->ClinicalEvent`
- `Caregiver-[:RECORDED_EVENT]->ClinicalEvent`
- typed links from events to dictionaries/order nodes (for example `USES_ICD_DIAGNOSIS`, `MEASURES_LAB_ITEM`, `FROM_POE_ORDER`)

Design goal: no information loss from structured rows. Keep event rows as first-class nodes with full properties.

## Notes for MIMIC-like datasets

Pipeline assumes schema similarity (same or close column names). If your dataset differs, update `ENTITY_SPECS` and `EVENT_SPECS` in `mimic_to_kg.py`.

## Quick troubleshooting

- `Connection refused 127.0.0.1:7687`: Neo4j not running / Bolt disabled
- `Unable to retrieve routing information`: use `bolt://` URI or ensure cluster routing enabled
- `Connection reset by peer` during ingest: lower `--batch-size` (`150` or `100`) and increase retries
- Empty UI patient list: ingest not run or wrong Neo4j database
