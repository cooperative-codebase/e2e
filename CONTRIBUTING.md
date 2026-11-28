# Contributing

Thank you for your interest in Cooperative Codebase projects. This guide applies to **all repositories** in the [cooperative-codebase](https://forgejo.cooperativecodebase.com/cooperative-codebase) organization on Forgejo. It describes how we expect contributions to look before you open a pull request.

## How to contribute

1. **Check existing work** — Search open issues and pull requests on [Forgejo](https://forgejo.cooperativecodebase.com/cooperative-codebase) so you do not duplicate effort.
2. **Discuss larger changes** — For new features, API changes, or cross-repo work, open or comment on an issue first. Maintainers can help scope the change and suggest branch names across related repos.
3. **Fork and branch** — Create a feature branch from the default branch (`main`). Do not commit directly to `main`.
4. **Keep changes focused** — One logical change per pull request when possible.
5. **Open a pull request** — Use a clear title and description: what changed, why, and how you tested it. Link related issues.

Repository-specific setup (tooling, test commands, environment variables) lives in each repo’s **README** — follow that for local development.

## Pull request size

We review every line. Smaller pull requests merge faster and are easier to verify.

| Size (lines changed in the PR diff) | Expectation |
| --- | --- |
| **≤ 500** | **Preferred** for most fixes, refactors, and small features. |
| **501–1500** | Acceptable for larger work (e.g. substantial new feature, coordinated test suite). Maintainers may still ask you to split the change. |
| **> 1500** | **Will be closed** — break the work into multiple issues and smaller pull requests. |

**Lines changed** means the total additions and deletions reported by the forge for the pull request (not a separate “logical LOC” count). Generated lockfile-only churn still counts toward the limit.

If you are unsure whether your change should be one PR or several, ask in the issue before you invest in a large branch.

## Dependency updates

**Do not open pull requests that only bump dependencies** (npm, Poetry, pip, GitHub Actions pins, etc.). Dependency maintenance is handled by **Renovate** on our infrastructure schedule. Human PRs that duplicate Renovate create review noise and merge conflicts.

Exception: if a dependency change is **required** to fix a bug or ship a feature in the same PR, include only what that feature needs and explain why in the description — do not mix unrelated upgrades.

## Use of AI and automated tools

We use modern tooling like anyone else, but **you** are responsible for what you submit.

- Every line in your pull request should be something you can **explain**, **debug**, and **maintain** without relying on the tool that produced the first draft.
- Do not submit large pasted outputs you have not read, trimmed, and aligned with this repository’s patterns (naming, structure, tests, docs).
- Do not add dead code, unused imports, misleading comments, placeholder error handling, or “TODO fix later” blocks just to make CI green.
- Match **existing** style and architecture in the repo; do not introduce a parallel pattern because a model suggested it.
- If you used an assistant for boilerplate, **verify** behavior with tests or manual checks described in your PR — same standard as a fully hand-written change.

Maintainers treat unexplained or inconsistent code like any other quality issue: request changes or close the PR.

## Code quality

- **Read the surrounding code** before editing; follow established conventions in that directory.
- **Minimize scope** — avoid drive-by refactors unrelated to the issue.
- **No secrets** — never commit tokens, passwords, `.env` files with real values, or private keys. Use each repo’s `.env.example` patterns.
- **Conventional commit messages** — e.g. `feat(scope): …`, `fix(scope): …`, `docs: …`, `test: …`.
- **Formatting and lint** — run the repo’s documented format/lint/test commands before pushing (see README and CI workflows).
- **Style** — match the repo’s indentation and naming (e.g. camelCase for variables and functions, PascalCase for components where that stack uses it). Prefer clear names over comments; document non-obvious behavior only.
- **Components and modules** — keep units focused on a single responsibility; avoid growing unrelated logic in the same change.

### Frontend repositories (user-facing UI)

The same bar applies in **every repository that ships user-facing web UI** — marketplace client, marketing sites, community apps, and similar — not only one stack. When your change touches pages, components, styles, or client navigation, follow these in addition to the general code quality rules above:

- **Mobile-first** — design and implement for small screens first; test multiple breakpoints before you open the PR. Prefer responsive layout over fixed dimensions; touch targets should be at least **44×44px** where interactive.
- **Accessibility** — aim for **WCAG 2.1 AA**: semantic markup, appropriate ARIA when needed, keyboard navigation, and at least **4.5:1** contrast for normal text unless the design system documents an exception.
- **Performance** — optimize images before adding them; lazy-load non-critical resources when the stack supports it; avoid unnecessary dependencies; use code splitting for larger client features when the project already does.

Backend-only, integration-test, or workflow-only repos can ignore this subsection unless the PR also changes UI in that repo.

## Testing

- **Bug fixes** should include a test that would have failed before the fix, when practical for that stack.
- **API or contract changes** in the marketplace should be reflected in **se-integration-tests** (contract and/or live tests) when behavior crosses frontend and backend.
- Describe in the PR what you ran locally (commands and outcome). If something could not be tested, say why.

## Review and merge

- At least one maintainer review is required before merge.
- Address review feedback with new commits on the same branch (or as agreed with reviewers).
- CI must be green unless a maintainer documents an exception.
- Merged pull requests **delete their head branch automatically** on the forge. If a pull request is **closed without merging**, delete the remote branch yourself when you will not continue that line of work — closed PRs do not remove the branch.

## Security and conduct

- Report security concerns privately to project maintainers; do not open public issues for exploitable details.
- Be respectful in issues and reviews. Harassment or bad-faith arguments are not tolerated.

## License

- **Source code:** [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`). Copyright (c) 2026 Cooperative Codebase, LLC.
- **Trademarks:** [TRADEMARK.md](TRADEMARK.md) — the license does not grant rights to use our product names or logos in a way that suggests official affiliation.
- **Contributions:** By submitting a pull request, you agree your contribution is licensed under the same terms. A formal contributor agreement may be added later.


## This repository (e2e)

- This repo is hosted on **GitHub** (`cooperative-codebase/e2e`); the same contribution standards apply. Open pull requests against **`main`**.
- Changes are usually GitHub Actions workflows and supporting scripts — run or describe the workflow you touched; no marketplace app code lives here.
- Application source remains on Forgejo; workflows clone partner repos via secrets — do not commit tokens or bot credentials.


## Questions

If anything in this guide is unclear, open a discussion issue in the relevant repository or ask in an existing issue thread before starting a large change.
