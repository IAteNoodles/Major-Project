#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
API_BASE_HOST="${API_BASE_HOST:-127.0.0.1}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"

VENV_UVICORN="${VENV_UVICORN:-$ROOT_DIR/venv/bin/uvicorn}"
FRONTEND_PATH="$ROOT_DIR/$FRONTEND_DIR"

if [[ ! -x "$VENV_UVICORN" ]]; then
  echo "Error: uvicorn not found at $VENV_UVICORN"
  echo "Install backend deps first: ./venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [[ ! -f "$FRONTEND_PATH/package.json" ]]; then
  echo "Error: $FRONTEND_DIR/package.json missing"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm not found in PATH"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node not found in PATH"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl not found in PATH"
  exit 1
fi

if [[ ! -d "$FRONTEND_PATH/node_modules" ]]; then
  echo "Installing frontend dependencies in $FRONTEND_DIR..."
  (
    cd "$FRONTEND_PATH"
    npm install
  )
fi

if ! (
  cd "$FRONTEND_PATH"
  node -e "require('rollup')"
) >/dev/null 2>&1; then
  echo "Repairing frontend optional dependencies..."
  (
    cd "$FRONTEND_PATH"
    npm install --no-save --no-package-lock
  )
fi

backend_pid=""
frontend_pid=""
cleaned_up=0
frontend_api_base="${VITE_API_BASE:-http://$API_BASE_HOST:$BACKEND_PORT}"

wait_for_http() {
  local url="$1"
  local service_name="$2"
  local retries="${3:-30}"
  local attempt=1

  while [[ "$attempt" -le "$retries" ]]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done

  echo "Error: $service_name failed health check at $url"
  return 1
}

cleanup() {
  if [[ "$cleaned_up" -eq 1 ]]; then
    return
  fi
  cleaned_up=1

  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi
  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
  fi

  wait "$backend_pid" 2>/dev/null || true
  wait "$frontend_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo "Starting backend on http://$BACKEND_HOST:$BACKEND_PORT"
"$VENV_UVICORN" backend.api:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
backend_pid=$!

echo "Starting frontend on http://$FRONTEND_HOST:$FRONTEND_PORT"
(
  cd "$FRONTEND_PATH"
  VITE_API_BASE="$frontend_api_base" npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
) &
frontend_pid=$!

wait_for_http "http://127.0.0.1:$BACKEND_PORT/api/health" "Backend API" 30
wait_for_http "http://127.0.0.1:$FRONTEND_PORT" "Frontend" 30

echo "Both services running."
echo "Frontend: http://127.0.0.1:$FRONTEND_PORT"
echo "Backend:  http://127.0.0.1:$BACKEND_PORT"
echo "VITE_API_BASE: $frontend_api_base"
echo "Press Ctrl+C to stop."

status=0
while true; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    wait "$backend_pid" || status=$?
    echo "Backend exited. Shutting down frontend."
    break
  fi
  if ! kill -0 "$frontend_pid" 2>/dev/null; then
    wait "$frontend_pid" || status=$?
    echo "Frontend exited. Shutting down backend."
    break
  fi
  sleep 1
done

cleanup
exit "$status"
