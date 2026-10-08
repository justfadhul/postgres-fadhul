#!/bin/bash
# Cloud (web/mobile) sessions only: install npm dependencies so `npm run check`
# and the local Chromium e2e tests work straight away. Local terminals skip it.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# npm install (not npm ci) reuses node_modules cached from the last session.
npm install --no-audit --no-fund --loglevel=error

# Cloud containers ship a Chromium under PLAYWRIGHT_BROWSERS_PATH; playwright.config.ts
# finds it automatically, so no browser download is needed here.
