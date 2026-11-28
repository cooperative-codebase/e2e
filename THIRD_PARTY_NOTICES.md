# Third-party notices

This repository is licensed under [GNU Affero General Public License v3.0](LICENSE)
(AGPL-3.0-only). Copyright (c) 2026 Cooperative Codebase, LLC. See [TRADEMARK.md](TRADEMARK.md).

## Licenses we do not accept

Do **not** add workflow tooling or committed dependencies whose declared license includes:
**SSPL**, **Elastic License 2.0**, **BUSL**, **Commons Clause**, **CC BY-NC** / **CC BY-ND**,
**proprietary**, or **UNLICENSED** terms incompatible with AGPL redistribution.

## This repository

GitHub Actions workflows and shell scripts may use runner-provided tools (Node, `gh`, Forgejo API
clients). There is no application `package-lock.json` in this repo. If you add one, also add
`scripts/check-dependency-licenses.mjs` and run `node scripts/generate-third-party-notices.mjs` after
lockfile changes.