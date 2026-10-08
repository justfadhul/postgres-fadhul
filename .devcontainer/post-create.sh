#!/usr/bin/env bash
# Runs once when the codespace is created.
set -euo pipefail
bash .devcontainer/start-postgres.sh
# vscode has passwordless sudo to root only, so switch to postgres with runuser.
# The vscode user gets its own superuser role and a "labs" database, so psql works with no flags.
sudo runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vscode') THEN CREATE ROLE vscode LOGIN SUPERUSER; END IF;
END $$;
SQL
sudo runuser -u postgres -- createdb -O vscode labs 2>/dev/null || true
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; fi
echo "Codespace ready. Run: make check LAB=env-check"
echo "Remember to stop the codespace when you finish (free hours are limited)."
