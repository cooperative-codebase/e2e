#!/usr/bin/env bash
# POST workflow_dispatch for cooperative-codebase/e2e renovate-land.yml.
set -euo pipefail

reason="${1:-manual}"
slot_retry_count="${2:-0}"

: "${GH_DISPATCH_TOKEN:?GH_DISPATCH_TOKEN is required}"

if ! [[ "${slot_retry_count}" =~ ^[0-9]+$ ]]; then
  echo "Invalid slot_retry_count: ${slot_retry_count}" >&2
  exit 1
fi

payload="$(jq -nc --arg reason "$reason" --arg src "$slot_retry_count" \
  '{ref: "main", inputs: {reason: $reason, slot_retry_count: $src}}')"

curl --fail --silent --show-error \
  --request POST \
  --header "Accept: application/vnd.github+json" \
  --header "Authorization: Bearer ${GH_DISPATCH_TOKEN}" \
  --header "X-GitHub-Api-Version: 2022-11-28" \
  --header "Content-Type: application/json" \
  --data "${payload}" \
  "https://api.github.com/repos/cooperative-codebase/e2e/actions/workflows/renovate-land.yml/dispatches"

echo "Dispatched Renovate land on GitHub (reason=${reason}, slot_retry_count=${slot_retry_count})"