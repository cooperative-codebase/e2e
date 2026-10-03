#!/usr/bin/env bash
# Email a failed main browser run through the existing May First mail transport.
set -euo pipefail

if [[ "${GITHUB_REF_NAME:-}" != "main" ]]; then
  echo "Skipping E2E failure email: branch is ${GITHUB_REF_NAME:-unknown}, not main"
  exit 0
fi

ALERT_EMAIL="${ALERT_EMAIL:-aaron@cooperativecodebase.com}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-cooperative-codebase/e2e}/actions/runs/${GITHUB_RUN_ID:-local}"
REPORT_DIR="${SE_E2E_REPORT_DIR:-}"

SUBJECT="[E2E nightly] Playwright smoke failed (${GITHUB_RUN_ID:-local})"
SUMMARY='Playwright E2E smoke failed on the se-frontend nightly workflow.'
if [[ "${E2E_NOTIFICATION_SOAK:-0}" == "1" ]]; then
  SUBJECT="[E2E notification test] Controlled failure (${GITHUB_RUN_ID:-local})"
  SUMMARY='Controlled failure notification exercise. No application browser tests or payments were run.'
fi
BODY="$(cat <<EOF
${SUMMARY}

Run: ${RUN_URL}
Branch: ${GITHUB_REF_NAME:-unknown}
Workflow commit: ${GITHUB_SHA:-unknown}

Reports (when present on May First):
  ${REPORT_DIR:-See the workflow failure-artifact step.}

Re-run: workflow_dispatch on cooperative-codebase/e2e e2e-nightly.yml
Docs: se-frontend/docs/testing/E2E_PLAYWRIGHT_IMPLEMENTATION_DECISIONS.md
EOF
)"

if command -v mail >/dev/null 2>&1; then
  printf '%s\n' "${BODY}" | mail -s "${SUBJECT}" "${ALERT_EMAIL}"
  echo "E2E failure alert submitted to ${ALERT_EMAIL}"
else
  echo "mail(1) unavailable — alert body:"
  printf '%s\n' "${BODY}"
  exit 1
fi
