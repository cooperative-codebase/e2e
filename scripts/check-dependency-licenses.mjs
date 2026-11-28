#!/usr/bin/env node
/**
 * Fail CI when lockfiles contain licenses incompatible with AGPL-3.0-only distribution.
 * SPDX matching is heuristic (registry metadata). See THIRD_PARTY_NOTICES.md.
 *
 * Usage: node scripts/check-dependency-licenses.mjs [repo-root]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildThirdPartyNoticesMarkdown,
  hasLockfileForNotices,
} from "./generate-third-party-notices.mjs";

const root = resolve(process.argv[2] ?? ".");

/** Substrings that indicate a blocked license (case-insensitive). */
const BLOCKED = [
  "sspl",
  "server side public",
  "elastic-2.0",
  "elastic license 2",
  "elastic license v2",
  "busl",
  "business source license",
  "commons-clause",
  "cc-by-nc",
  "cc-by-nd",
  "cc by-nc",
  "cc by-nd",
  "fair source",
  "good not evil",
  "proprietary",
  "commercial license",
];

/** Warn but do not fail (LGPL/MPL need notice; review on major version bumps). */
const REVIEW = ["lgpl", "mpl-", "gpl-2.0", "gpl-3.0", "agpl"];

function normalizeLicense(raw) {
  if (raw == null) return "";
  if (Array.isArray(raw)) return raw.map(normalizeLicense).join(" AND ");
  return String(raw).trim();
}

function isBlocked(licenseStr) {
  const lower = licenseStr.toLowerCase();
  if (!lower || lower === "mit" || lower === "isc") return false;
  if (lower === "unlicensed") return true;
  return BLOCKED.some((frag) => lower.includes(frag));
}

function needsReview(licenseStr) {
  const lower = licenseStr.toLowerCase();
  return REVIEW.some((frag) => lower.includes(frag));
}

function collectNpmLock(lockPath) {
  const entries = [];
  const data = JSON.parse(readFileSync(lockPath, "utf8"));
  const packages = data.packages ?? {};
  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (!meta || pkgPath === "") continue;
    const name = meta.name ?? pkgPath.replace(/^node_modules\//, "");
    const license = normalizeLicense(meta.license);
    if (!license) continue;
    entries.push({ name, version: meta.version ?? "", license, source: lockPath });
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
    if (!nameMatch || !licenseMatch) continue;
    let license = licenseMatch[1].trim();
    if (license.startsWith('"') && license.endsWith('"')) {
      license = license.slice(1, -1);
    } else if (license.startsWith("[")) {
      try {
        license = JSON.parse(license.replace(/'/g, '"')).join(" AND ");
      } catch {
        license = license;
      }
    }
    entries.push({
      name: nameMatch[1],
      version: versionMatch?.[1] ?? "",
      license: normalizeLicense(license),
      source: lockPath,
    });
  }
  return entries;
}

function collectRepo() {
  const all = [];
  const npmLock = join(root, "package-lock.json");
  const poetryLock = join(root, "poetry.lock");
  if (existsSync(npmLock)) all.push(...collectNpmLock(npmLock));
  if (existsSync(poetryLock)) all.push(...collectPoetryLock(poetryLock));
  return all;
}

const entries = collectRepo();
if (entries.length === 0) {
  console.log(`check-dependency-licenses: no package-lock.json or poetry.lock under ${root} — skip`);
  process.exit(0);
}

const blocked = [];
const review = [];
for (const e of entries) {
  if (isBlocked(e.license)) blocked.push(e);
  else if (needsReview(e.license)) review.push(e);
}

if (review.length) {
  console.warn(
    `check-dependency-licenses: ${review.length} package(s) use copyleft/notice licenses (LGPL/MPL/GPL — allowed with compliance; see THIRD_PARTY_NOTICES.md):`,
  );
  for (const r of review.slice(0, 20)) {
    console.warn(`  ${r.name}@${r.version} (${r.license})`);
  }
  if (review.length > 20) console.warn(`  … and ${review.length - 20} more`);
}

if (blocked.length) {
  console.error(
    "check-dependency-licenses: blocked license(s) found — incompatible with AGPL-3.0-only policy:",
  );
  for (const b of blocked) {
    console.error(`  ${b.name}@${b.version} (${b.license}) in ${b.source}`);
  }
  console.error("See THIRD_PARTY_NOTICES.md and do not merge until removed or replaced.");
  process.exit(1);
}

console.log(`check-dependency-licenses: OK (${entries.length} packages checked)`);

const generateScript = join(root, "scripts/generate-third-party-notices.mjs");
if (existsSync(generateScript) && hasLockfileForNotices(root)) {
  const noticesPath = join(root, "THIRD_PARTY_NOTICES.md");
  if (!existsSync(noticesPath)) {
    console.error("THIRD_PARTY_NOTICES.md is missing but a lockfile is present.");
    console.error("Run: node scripts/generate-third-party-notices.mjs");
    process.exit(1);
  }
  const expected = buildThirdPartyNoticesMarkdown(root);
  const actual = readFileSync(noticesPath, "utf8");
  if (actual !== expected) {
    console.error("THIRD_PARTY_NOTICES.md is out of date with the lockfile.");
    console.error("Run: node scripts/generate-third-party-notices.mjs");
    process.exit(1);
  }
  console.log("THIRD_PARTY_NOTICES.md matches lockfile");
}