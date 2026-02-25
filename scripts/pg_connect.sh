#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing .env file at ${ENV_FILE}" >&2
  exit 1
fi

# Export values from .env into the current shell.
set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-${DB_DATABASE:-}}"
DB_USER="${DB_USER:-${DB_USERNAME:-}}"

if [[ -n "${DATABASE_URL:-}" ]]; then
  CONN_STR="${DATABASE_URL}"
else
  if [[ -z "${DB_HOST:-}" || -z "${DB_NAME}" || -z "${DB_USER}" ]]; then
    echo "Set DATABASE_URL or DB_HOST, DB_PORT, DB_NAME (or DB_DATABASE), and DB_USER (or DB_USERNAME) in .env" >&2
    exit 1
  fi

  CONN_STR="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

if [[ -n "${DB_PASSWORD:-}" ]]; then
  export PGPASSWORD="${DB_PASSWORD}"
elif [[ -n "${DB_PASS:-}" ]]; then
  export PGPASSWORD="${DB_PASS}"
elif [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
  export PGPASSWORD="${POSTGRES_PASSWORD}"
fi

if [[ $# -gt 0 ]]; then
  psql "${CONN_STR}" -c "$1"
else
  psql "${CONN_STR}"
fi
