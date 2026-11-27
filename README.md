# Cooperative Codebase — offloaded CI (GitHub Actions)

This public repository runs selected workloads on GitHub-hosted runners. Application
source and bot credentials stay on Forgejo; repositories are cloned at workflow runtime
through GitHub secrets. Workflow logs intentionally avoid echoing Renovate or test output;
public status is summarized in `run-log.md` and `renovate-run-log.md`.

## Playwright E2E (`e2e-nightly.yml`)

The Playwright job uses `ubuntu-24.04` so `actions/setup-python` can install the
exact version in `se-backend/.python-version`. Python 3.13.5 has an Ubuntu 24.04
build, but no Ubuntu 26.04 build. Before upgrading the runner image, check that
the backend's pinned Python version is available for it in the
[setup-python version manifest](https://github.com/actions/python-versions/blob/main/versions-manifest.json).

Nightly and merge-triggered Playwright smoke for `se-frontend`. The test stack enables
guest checkout with `SE_E2E_GUEST_CHECKOUT=1` before public rollout. This does not change
production or Early Access flags. Guest confirmation/recovery cases are independent, CI
fails on missing guest/Stripe configuration, and a test that passes only on retry still
fails the run (`failOnFlakyTests`).

After the full enabled smoke suite, a fresh guest-disabled build verifies the signed-out
checkout gate. Both runs must pass.

For a manual dispatch, the selected E2E workflow branch is also requested from
`se-frontend`, `se-backend`, and `se-integration-tests`. Each repository falls back
independently to `main` when that branch does not exist. Scheduled and merge-triggered runs
use `main` unless an explicit override is supplied.

E2E requires `DEMO_SEED_PASSWORD`, `STRIPE_TEST_WEBHOOK_SECRET`, Forgejo clone, Stripe,
and May First artifact secrets. See Forgejo `infrastructure/forgejo/ORG_ACTIONS_SECRETS.md`.

### Failure email (`#603` / #416 A3)

On failed **main** runs (partner branches empty or `main`), the workflow pipes
`scripts/e2e-notify-failure.sh` to the existing May First artifact host so `mail(1)`
submits through the site formatter. Recipient: **`aaron@cooperativecodebase.com`** (debug
soak per #416).

**Controlled verification:** `workflow_dispatch` with `run_kind` = **`notification-soak`**
fails before Forgejo clones or Playwright; use an E2E workflow branch that includes the
notify hook. Leave partner branch inputs empty. Record run URL and log excerpt in
`se-frontend/docs/testing/E2E_PLAYWRIGHT_IMPLEMENTATION_DECISIONS.md`.

PR workflow `check-controls.yml` runs `test_e2e_notify.py` (stub `mail`, no delivery).

## Renovate batch land (`renovate-land.yml`)

Polls open **renovate-bot** PRs on Forgejo, merges when CI is green (same scripts as
`infrastructure` on May First formerly). Safety cron **45 2,8,14,20 UTC**; re-dispatches
via GitHub API when CI is pending. **`RENOVATE_TOKEN`** (merge + API). Blocked land / dispatch failures email via Proton SMTP
(`RENOVATE_LAND_SMTP_USER`, `RENOVATE_LAND_SMTP_PASSWORD` on GitHub — see Forgejo `ORG_ACTIONS_SECRETS.md`).

## Renovate maintain (`renovate-maintain.yml`)

Dependency maintenance for the four marketplace repositories using Renovate OSS config from
Forgejo `infrastructure` (`renovate/self-hosted-*.cjs`). Scheduled at **01:30, 07:30, 13:30,
19:30 UTC** (`updates` mode). Manual dispatch defaults to **preview**.

Uses `ubuntu-24.04` (same as E2E) so Renovate is not subject to May First **~1 GB** forever-job limits
(site **391805** OOM). Clones `infrastructure` with **`RENOVATE_TOKEN`** (same Forgejo
**renovate-bot** PAT as the updater). Optional: `RENOVATE_GITHUB_COM_TOKEN` for github.com
release metadata.