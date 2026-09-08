# Cooperative Codebase E2E Nightly

This public repository runs the nightly Playwright end-to-end smoke suite for
`se-frontend` on GitHub-hosted runners. The application repositories and test
credentials are fetched only at workflow runtime through repository secrets.

The test stack enables guest checkout with `SE_E2E_GUEST_CHECKOUT=1` before public rollout. This does not change production or Early Access flags. Guest confirmation/recovery cases are independent, CI fails on missing guest/Stripe configuration, and a test that passes only on retry still fails the run (`failOnFlakyTests`).

After the full enabled smoke suite, a fresh guest-disabled build verifies the signed-out checkout gate. Both runs must pass.
