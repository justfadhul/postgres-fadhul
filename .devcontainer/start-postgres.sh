#!/usr/bin/env bash
# Starts the PostgreSQL 18 cluster. Runs on every codespace start.
set -euo pipefail
if ! pg_lsclusters -h | grep -q '^18 \+main .* online'; then
  sudo pg_ctlcluster 18 main start
fi
pg_lsclusters
