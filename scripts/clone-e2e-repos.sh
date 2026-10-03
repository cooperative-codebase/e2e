#!/usr/bin/env bash
set -euo pipefail
: "${FORGEJO_E2E_TOKEN:?FORGEJO_E2E_TOKEN secret is required}"

repo_url() {
  local repo="$1"
  printf 'https://oauth2:%s@forgejo.cooperativecodebase.com/cooperative-codebase/%s.git' \
    "${FORGEJO_E2E_TOKEN}" "${repo}"
}

resolve_branch() {
  local repo="$1" requested="$2" url status
  if [[ -z "${requested}" || "${requested}" == "main" ]]; then
    printf 'main\n'
    return
  fi

  url="$(repo_url "${repo}")"
  set +e
  git -c credential.helper= ls-remote --exit-code --heads \
    "${url}" "refs/heads/${requested}" >/dev/null 2>&1
  status=$?
  set -e

  case "${status}" in
    0)
      printf '%s\n' "${requested}"
      ;;
    2)
      echo "::notice title=Partner branch lookup::Branch ${requested} not found on ${repo}; using main." >&2
      printf 'main\n'
      ;;
    *)
      echo "::error title=Partner branch lookup::Could not resolve ${repo}/${requested}; git ls-remote exited ${status}." >&2
      return "${status}"
      ;;
  esac
}

default_partner_branch="${E2E_WORKFLOW_BRANCH}"
if [[ "${GITHUB_EVENT_NAME}" == "schedule" || "${RUN_KIND}" == "merge" ]]; then
  default_partner_branch="main"
fi

requested_frontend="${FRONTEND_BRANCH_INPUT:-${default_partner_branch}}"
requested_backend="${BACKEND_BRANCH_INPUT:-${default_partner_branch}}"
requested_integration="${INTEGRATION_TESTS_BRANCH_INPUT:-${default_partner_branch}}"
if [[ "${RUN_KIND}" == "pr" ]]; then
  [[ "${SOURCE_REPOSITORY}" == "cooperative-codebase/se-frontend" ]] || { echo '::error::PR gate requires the frontend source repository.'; exit 1; }
  [[ "${SOURCE_SHA}" =~ ^[0-9a-f]{40}$ ]] || { echo '::error::PR gate requires an exact source SHA.'; exit 1; }
  [[ -n "${FRONTEND_BRANCH_INPUT}" ]] || { echo '::error::PR gate requires a frontend branch.'; exit 1; }
fi
frontend_ref="$(resolve_branch se-frontend "${requested_frontend}")"
backend_ref="$(resolve_branch se-backend "${requested_backend}")"
integration_ref="$(resolve_branch se-integration-tests "${requested_integration}")"
if [[ "${RUN_KIND}" == "pr" && "${frontend_ref}" != "${requested_frontend}" ]]; then
  echo '::error::Frontend PR branch was not found; main cannot substitute for the requested source.'
  exit 1
fi

echo "Resolved Forgejo branches: frontend=${frontend_ref} backend=${backend_ref} integration-tests=${integration_ref}"

clone_repo() {
  local repo="$1" ref="$2"
  git -c credential.helper= clone --depth 1 --branch "${ref}" \
    "$(repo_url "${repo}")" \
    "${repo}"
}
clone_repo se-frontend "${frontend_ref}"
clone_repo se-backend "${backend_ref}"
clone_repo se-integration-tests "${integration_ref}"
if [[ "${RUN_KIND}" == "pr" ]]; then
  git -C se-frontend fetch --depth 1 origin "${SOURCE_SHA}"
  git -C se-frontend checkout --detach "${SOURCE_SHA}"
  [[ "$(git -C se-frontend rev-parse HEAD)" == "${SOURCE_SHA}" ]] || exit 1
fi
for repo in se-frontend se-backend se-integration-tests; do
  printf 'Resolved source: %s %s\n' "${repo}" "$(git -C "${repo}" rev-parse HEAD)"
done

