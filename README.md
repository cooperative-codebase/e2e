# Cooperative Codebase E2E Nightly

This public repository runs the nightly Playwright end-to-end smoke suite for
`se-frontend` on GitHub-hosted runners. The application repositories and test
credentials are fetched only at workflow runtime through repository secrets.

Scheduled runs at 10:00 UTC, merge runs and ordinary manual dispatches run the
full smoke suite. The active stack uses `SE_E2E_GUEST_CHECKOUT=0`; guest-enabled
coverage needs separate evidence and does not change production or Early Access
flags. CI requires existing Stripe test keys and rejects retry-only passes.
Required checkout mounts/fills the real Payment Element and uses test API
confirmation plus a signed synthetic webhook. External browser confirmation is optional.

`run_kind=pr` runs browse, auth and checkout. It requires a same-repository frontend
branch and exact `source_sha`, refuses a missing frontend branch, and checks out
that commit. Forgejo's required Build and Test job waits for the new run ID returned
by GitHub's dispatch API; failure, cancellation, missing result or timeout fails
the gate. PR concurrency remains separate from scheduled nightlies.

For a manual dispatch, the selected E2E workflow branch is also requested from
`se-frontend`, `se-backend`, and `se-integration-tests`. Each repository falls
back independently to `main` when that branch does not exist. Optional workflow
inputs can override any of the three branch names. Scheduled and merge-triggered
runs use `main` unless an explicit override is supplied.

Failed main runs with all application repositories on main submit an email through
the existing May First artifact transport using `scripts/e2e-notify-failure.sh`.
Aaron's recorded debug-soak recipient remains `aaron@cooperativecodebase.com`;
PR and ordinary feature-branch runs do not send alerts. Submission failure is visible;
successful `mail(1)` submission does not prove inbox receipt. No new credentials
or browser host is required.

For an authorized controlled delivery check, select `notification-soak` on the
reviewed workflow branch or main, with application branch overrides empty/main.
This explicit test exception allows delivery verification before main activation;
it preserves ordinary main-only alerts and reports the actual workflow branch.
It deliberately fails before private clones, browser tests or payments and
labels its email as a notification test. This expected failure is separate from
application stability evidence. Historical `run-log.md` rows retain two columns;
new rows include scope (`full-smoke`, `pr-subset` or `notification-soak`) and run ID.
The recording job serializes writes across otherwise independent run groups.

Pull requests also run the small notification/source-selection control tests.
That check uses fake mail and Git without secrets, private clones or application
dependencies; passing it does not establish real email delivery.

The workflow requires the `DEMO_SEED_PASSWORD` and `STRIPE_TEST_WEBHOOK_SECRET`
repository secrets in addition to the existing Forgejo, Stripe API, and May First
secrets. Their values are passed to the isolated test stack only at runtime.
