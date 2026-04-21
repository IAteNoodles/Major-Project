#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
FRONTEND_PATH="$ROOT_DIR/$FRONTEND_DIR"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Error: Python not found: $PYTHON_BIN"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm not found in PATH"
  exit 1
fi

if [[ ! -f "$ROOT_DIR/requirements.txt" ]]; then
  echo "Error: requirements.txt missing in $ROOT_DIR"
  exit 1
fi

if [[ ! -f "$FRONTEND_PATH/package.json" ]]; then
  echo "Error: package.json missing in $FRONTEND_PATH"
  exit 1
fi

if [[ ! -d "$ROOT_DIR/venv" ]]; then
  echo "Creating virtual environment..."
  "$PYTHON_BIN" -m venv "$ROOT_DIR/venv"
fi

echo "Installing backend dependencies..."
"$ROOT_DIR/venv/bin/python" -m pip install --upgrade pip
"$ROOT_DIR/venv/bin/pip" install -r "$ROOT_DIR/requirements.txt"

echo "Installing frontend dependencies ($FRONTEND_DIR)..."
(
  cd "$FRONTEND_PATH"
  npm install
)

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  if [[ -f "$ROOT_DIR/.env.example" ]]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo "Created .env from .env.example"
    echo "Update NEO4J_PASSWORD in .env before running backend."
  else
    echo "Warning: .env.example missing; create .env manually."
  fi
fi

echo "Setup complete."
echo "Run: ./run-dev.sh"
