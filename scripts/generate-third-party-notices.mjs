#!/usr/bin/env node
/**
 * Build or write THIRD_PARTY_NOTICES.md from lockfile metadata.
 *
 * Usage:
 *   node scripts/generate-third-party-notices.mjs [repo-root]       # write file
 *   node scripts/generate-third-party-notices.mjs --check [repo-root] # CI: fail if stale
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const GENERATED_SECTION_HEADING = "## Runtime dependencies (generated)";

function normalizeLicense(raw) {
  if (raw == null) return "UNKNOWN";
  if (Array.isArray(raw)) return raw.join(" AND ");
  return String(raw).trim() || "UNKNOWN";
}

function collectNpmLock(lockPath) {
  const entries = [];
  const data = JSON.parse(readFileSync(lockPath, "utf8"));
  const packages = data.packages ?? {};
  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (!meta || pkgPath === "") continue;
    const name = meta.name ?? pkgPath.replace(/^node_modules\//, "");
    entries.push({
      name,
      version: meta.version ?? "",
      license: normalizeLicense(meta.license),
    });
  }
  return entries;
}

function collectPoetryLock(lockPath) {
  const entries = [];
  const text = readFileSync(lockPath, "utf8");
  const blocks = text.split(/\n\n(?=\[\[package\]\])/);
  for (const block of blocks) {
    if (!block.includes("[[package]]")) continue;
    const nameMatch = block.match(/^name = "(.+)"$/m);
    const versionMatch = block.match(/^version = "(.+)"$/m);
    const licenseMatch = block.match(/^license = (.+)$/m);
    if (!nameMatch) continue;
    let license = "UNKNOWN";
    if (licenseMatch) {
      let raw = licenseMatch[1].trim();
      if (raw.startsWith('"') && raw.endsWith('"')) license = raw.slice(1, -1);
      else if (raw.startsWith("[")) {
        try {
          license = JSON.parse(raw.replace(/'/g, '"')).join(" AND ");
        } catch {
          license = raw;
        }
      } else license = raw;
    }
    entries.push({
      name: nameMatch[1],
      version: versionMatch?.[1] ?? "",
      license,
    });
  }
  return entries;
}

function groupByLicense(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = e.license;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function collectLockfileEntries(root) {
  const all = [];
  const npmLock = join(root, "package-lock.json");
  const poetryLock = join(root, "poetry.lock");
  if (existsSync(npmLock)) all.push(...collectNpmLock(npmLock));
  if (existsSync(poetryLock)) all.push(...collectPoetryLock(poetryLock));
  return all;
}

export function hasLockfileForNotices(root) {
  return (
    existsSync(join(root, "package-lock.json")) || existsSync(join(root, "poetry.lock"))
  );
}

export function buildThirdPartyNoticesMarkdown(root) {
  const all = collectLockfileEntries(root);

  const header = `# Third-party notices

This repository is part of Cooperative Codebase open source and is licensed under
[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). Copyright (c) 2026
Cooperative Codebase, LLC. Trademarks are not granted by the license — see
[TRADEMARK.md](TRADEMARK.md).

**Our code is AGPL.** Third-party packages remain under their own licenses. This file
summarizes runtime dependencies from the lockfile(s) in this repository. It is not legal
advice.

## Licenses we do not accept

Do **not** add or upgrade to dependencies whose **declared** license is any of the following
(including combinations that include them):

- **SSPL** (Server Side Public License) and similar server-restrictive terms
- **Elastic License 2.0**, **BUSL / Business Source License**, **Fair Source** (use caps)
- **Commons Clause** (non-commercial add-ons on otherwise permissive licenses)
- **CC BY-NC**, **CC BY-ND** (for bundled libraries or assets)
- **Proprietary**, **UNLICENSED**, or custom terms that forbid redistribution or GPL/AGPL combination

**Usually acceptable** (with attribution in this file or generated list): MIT, ISC, BSD
variants, Apache-2.0, 0BSD, BlueOak-1.0.0, PSF-2.0, CC0, Unlicense.

**Copyleft dependencies** (LGPL-3.0-or-later, MPL-2.0, GPL family) may appear in the tree.
Keep their license notices, satisfy their compliance requirements, and prefer dashboard
review before major upgrades. CI runs \`scripts/check-dependency-licenses.mjs\` on pull requests
(including a check that this file matches the lockfile).

Renovate OSS does not filter by SPDX. Enforcement is the license check in CI plus human review
of Renovate pull requests.

## Regenerating the dependency list

From this repository root:

\`\`\`bash
node scripts/generate-third-party-notices.mjs
\`\`\`

Commit the updated file whenever \`package-lock.json\` or \`poetry.lock\` changes. CI fails if
the generated section is stale.

${GENERATED_SECTION_HEADING}

_This section is derived from lockfile metadata. Full license texts are not inlined here;
obtain them from each package’s repository or from [npm](https://www.npmjs.com/) /
[PyPI](https://pypi.org/) as applicable._

`;

  let body = "";
  if (all.length === 0) {
    body = "_No \`package-lock.json\` or \`poetry.lock\` present in this repository._\n";
  } else {
    for (const [license, pkgs] of groupByLicense(all)) {
      body += `### ${license}\n\n`;
      for (const p of pkgs) {
        body += `- ${p.name}${p.version ? `@${p.version}` : ""}\n`;
      }
      body += "\n";
    }
  }

  return header + body;
}

function main() {
  const args = process.argv.slice(2);
  const checkMode = args[0] === "--check";
  const rootArg = checkMode ? args[1] : args[0];
  const root = resolve(rootArg ?? ".");
  const outPath = join(root, "THIRD_PARTY_NOTICES.md");
  const expected = buildThirdPartyNoticesMarkdown(root);

  if (checkMode) {
    if (!existsSync(outPath)) {
      console.error(`THIRD_PARTY_NOTICES.md missing under ${root}`);
      console.error("Run: node scripts/generate-third-party-notices.mjs");
      process.exit(1);
    }
    const actual = readFileSync(outPath, "utf8");
    if (actual !== expected) {
      console.error("THIRD_PARTY_NOTICES.md is out of date with the lockfile.");
      console.error("Run: node scripts/generate-third-party-notices.mjs");
      process.exit(1);
    }
    console.log("THIRD_PARTY_NOTICES.md matches lockfile");
    return;
  }

  writeFileSync(outPath, expected);
  const count = collectLockfileEntries(root).length;
  console.log(`Wrote ${outPath} (${count} packages)`);
}

const entryArg = process.argv[1];
if (
  entryArg &&
  import.meta.url === pathToFileURL(resolve(entryArg)).href
) {
  main();
}