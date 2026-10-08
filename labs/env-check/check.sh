#!/usr/bin/env bash
# Confirms the codespace has the tools the labs need. No completion code yet:
# the completion-code framework arrives in Milestone 3.
set -uo pipefail
fail=0
need() {
  local name=$1; shift
  if out=$("$@" 2>&1); then printf '  ok    %-12s %s\n' "$name" "$(echo "$out" | head -1)"
  else printf '  FAIL  %-12s %s\n' "$name" "$(echo "$out" | head -1)"; fail=1; fi
}
echo "Lab environment check"
need node node --version
need go go version
need docker docker version --format '{{.Server.Version}}'
need psql psql --version
need server psql -d labs -tAc "SELECT 'server ' || current_setting('server_version')"
need sqlite3 sqlite3 --version
major=$(psql -d labs -tAc "SELECT current_setting('server_version_num')::int / 10000" 2>/dev/null || echo 0)
if [ "$major" != "18" ]; then echo "  FAIL  expected PostgreSQL 18 server, found major version $major"; fail=1; fi
if [ $fail -eq 0 ]; then echo "All tools present."; else echo "Some tools are missing; see above."; fi
exit $fail
