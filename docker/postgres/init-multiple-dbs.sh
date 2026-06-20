#!/bin/bash
# Creates one database per service so they can share a single Postgres instance for the e2e
# local target. Per-service schema files are mounted by docker-compose and run in order.
set -euo pipefail

create_db() {
  local db="$1"
  echo "creating database: $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE "$db";
EOSQL
}

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
  for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
    create_db "$db"
  done
fi
