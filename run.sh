#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PY="${SCRIPT_DIR}/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "No venv at .venv — create it first:" >&2
  echo "  python3 -m venv .venv && .venv/bin/pip install -e ." >&2
  exit 1
fi

exec "$PY" -m mission_control "$@"
