#!/usr/bin/env -S node --experimental-strip-types
/**
 * check-chamber-isolation.ts (3kye.4) — per-chamber kernel isolation gate.
 *
 * DR-049 / DR-081 D-SAK-1 (CTO ask b+c, CSO + CISO co-binding, RATIFIED AS
 * BINDING AND IMMUTABLE): the kernel is BICAMERAL — a runtime chamber
 * (schemas/v1/**) and an authoring chamber (schemas/authoring/**). The two
 * chambers share CODE, never a fused trust root or a fused evolution clock. A
 * compromise of one chamber must not implicate the other's attestations. This
 * gate is the machine-enforcement of three of the isolation invariants:
 *
 *   (A) INDEPENDENT $schemaVersion LANE PER CHAMBER (CTO ask b / CSO binding).
 *       Neither chamber's catalog index.json may carry a shared `schemaVersion`
 *       field. A future edit that fuses a single cross-chamber version lane (by
 *       adding `schemaVersion` to a chamber index) is exactly the regression
 *       this clause forbids — each chamber/contract carries its OWN version lane
 *       (e.g. authoring's per-file `$schemaVersion`, the per-contract semver in
 *       each CHANGELOG), never a kernel-wide one. We assert NO `schemaVersion`
 *       field exists in schemas/v1/index.json OR in any schemas/authoring/**\/
 *       index.json. [f-iec-chamber-1]
 *
 *   (B) NO PREDICATE-SIGNING FIELD IN THE AUTHORING CHAMBER (CTO ask c / CISO).
 *       The runtime chamber's catalog legitimately tags signed predicate bodies
 *       with `signing_mode` (rekor_production / sigstore_staging). Authoring
 *       conformance is a DETERMINISTIC LINT RESULT, never a signed attestation —
 *       so NO authoring index.json may carry a `signing_mode` (or any
 *       predicate-signing) field. The runtime chamber MAY. [f-iec-chamber-1]
 *
 *   (C) NO SHARED SIGNING TRUST ROOT (CTO ask c / CSO + GC + CISO). No authoring
 *       schema's `$id`, `$ref`, or `$comment` may resolve to a runtime predicate
 *       / signing trust root. This complements the predicate-namespace gate
 *       (check-predicate-namespace-isolation.ts), which forbids the
 *       `evals.intentsolutions.io` predicate HOST. Here we forbid the runtime
 *       PREDICATE-FAMILY schema-tree identifiers (`schemas/v1/` $ids and the
 *       in-toto predicate URIs minted there), so an authoring schema cannot
 *       quietly point its trust anchor at the runtime chamber even via a path or
 *       Rekor/sigstore reference that the host-only gate would miss.
 *
 * The two gates are deliberately distinct and both wired into `pnpm run check`:
 * the namespace gate guards the signed-predicate HOST; this gate guards the
 * version LANE, the signing-mode FIELD, and the cross-chamber trust-root
 * REFERENCE.
 *
 * Exit codes:
 *   0 — clean (all three isolation invariants hold)
 *   1 — violation(s) found (one line per finding on stderr)
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-chamber-isolation.ts
 *   node --experimental-strip-types scripts/check-chamber-isolation.ts <repoRoot>
 *
 * The optional <repoRoot> arg overrides the scan root (used by the test harness
 * to point at a fixture tree that mirrors the schemas/ layout). Default: the
 * repo root.
 * [f-iec-chamber-1]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

/** Runtime chamber catalog index (relative to the scan root). */
export const RUNTIME_INDEX = 'schemas/v1/index.json';

/** Authoring chamber family root — every version dir (v1, v2, future vN). */
export const AUTHORING_FAMILY = 'schemas/authoring';

/**
 * The field name that, if present in any chamber index, would fuse a shared
 * cross-chamber version lane — the exact regression CTO ask (b) / the CSO
 * binding forbid. Each chamber carries its own per-contract version lane; a
 * kernel-wide `schemaVersion` is never permitted in a chamber catalog.
 */
export const FORBIDDEN_VERSION_FIELD = 'schemaVersion';

/**
 * Predicate-signing field names that belong ONLY to the runtime chamber.
 * Authoring conformance is a deterministic lint, never a signed attestation, so
 * none of these may appear in an authoring catalog index.
 */
export const FORBIDDEN_AUTHORING_SIGNING_FIELDS = ['signing_mode', 'signingMode'] as const;

/**
 * Substrings that identify a RUNTIME predicate / signing trust root. An
 * authoring schema's `$id`/`$ref`/`$comment` must not resolve to any of these —
 * doing so would point an authoring trust anchor at the runtime chamber. The
 * host-only predicate-namespace gate covers `evals.intentsolutions.io`; this
 * list adds the runtime SCHEMA-TREE identifier (`schemas/v1/`) so a path or
 * tree-relative `$ref` into the runtime predicate family is caught too.
 * Matched case-insensitively as substrings.
 */
export const RUNTIME_TRUST_ROOT_MARKERS = ['evals.intentsolutions.io', '/schemas/v1/'] as const;

export interface IsolationViolation {
  readonly kind: 'version-lane' | 'authoring-signing' | 'trust-root';
  readonly file: string;
  readonly detail: string;
  readonly line?: number;
}

/** Recursively collect every `.json` file under `dir`. */
function jsonFilesUnder(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return []; // missing/inaccessible dir (ENOENT/EACCES) — nothing to scan
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...jsonFilesUnder(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/** Every `index.json` directly under an authoring version dir (v1, v2, …). */
function authoringIndexFiles(authoringRoot: string): string[] {
  let entries;
  try {
    entries = readdirSync(authoringRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(authoringRoot, entry.name, 'index.json');
    try {
      if (statSync(candidate).isFile()) out.push(candidate);
    } catch {
      /* no index.json in this version dir — skip */
    }
  }
  return out;
}

/** True if `obj` carries a top-level `field` key (own enumerable property). */
function hasTopLevelField(obj: unknown, field: string): boolean {
  return (
    typeof obj === 'object' && obj !== null && Object.prototype.hasOwnProperty.call(obj, field)
  );
}

/**
 * Run all three chamber-isolation checks against `repoRoot`. Returns one entry
 * per violation. Exported for the test harness.
 */
export function scanChamberIsolation(repoRoot: string): IsolationViolation[] {
  const violations: IsolationViolation[] = [];

  const runtimeIndex = join(repoRoot, RUNTIME_INDEX);
  const authoringRoot = join(repoRoot, AUTHORING_FAMILY);
  const authoringIndexes = authoringIndexFiles(authoringRoot);

  // (A) Independent $schemaVersion lane: no chamber index may carry a shared
  //     `schemaVersion` field. Check the runtime index + every authoring index.
  const versionLaneTargets = [runtimeIndex, ...authoringIndexes];
  for (const file of versionLaneTargets) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf-8'));
    } catch {
      continue; // missing/unparseable index — not this gate's concern
    }
    if (hasTopLevelField(parsed, FORBIDDEN_VERSION_FIELD)) {
      violations.push({
        kind: 'version-lane',
        file,
        detail: `chamber index carries a shared "${FORBIDDEN_VERSION_FIELD}" field — fuses a cross-chamber version lane (DR-049 D-SAK-1: each chamber keeps an INDEPENDENT $schemaVersion lane)`,
      });
    }
  }

  // (B) No predicate-signing field in the authoring chamber. Runtime MAY carry
  //     `signing_mode`; authoring (a deterministic lint, never a signed
  //     attestation) MAY NOT.
  for (const file of authoringIndexes) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf-8'));
    } catch {
      continue;
    }
    for (const field of FORBIDDEN_AUTHORING_SIGNING_FIELDS) {
      if (hasTopLevelField(parsed, field)) {
        violations.push({
          kind: 'authoring-signing',
          file,
          detail: `authoring index carries a predicate-signing field "${field}" — authoring conformance is a DETERMINISTIC LINT, never a signed attestation (DR-049 D-SAK-1 CISO binding)`,
        });
      }
    }
  }

  // (C) No shared signing trust root: no authoring schema $id/$ref/$comment may
  //     resolve to a runtime predicate / signing trust root.
  const markers = RUNTIME_TRUST_ROOT_MARKERS.map((m) => m.toLowerCase());
  for (const file of jsonFilesUnder(authoringRoot)) {
    const lines = readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      // Only the trust-anchor-bearing keys count: $id, $ref, $comment. Require
      // the token to be an actual JSON key (followed by a colon), not an
      // incidental substring elsewhere in the line — avoids false positives.
      const isAnchorLine = /"\$(id|ref|comment)"\s*:/.test(line);
      if (!isAnchorLine) return;
      for (const marker of markers) {
        if (lower.includes(marker)) {
          violations.push({
            kind: 'trust-root',
            file,
            line: index + 1,
            detail: `authoring schema anchor references a runtime trust root "${marker}" — chambers share CODE, never a fused trust root (DR-049 D-SAK-1)`,
          });
          break;
        }
      }
    });
  }

  return violations;
}

function rel(file: string, root: string): string {
  const relativePath = file.startsWith(root) ? relative(root, file) : file;
  // Normalize Windows backslashes so findings/test assertions are
  // cross-platform (e.g. schemas/authoring/v1/index.json on every OS).
  return relativePath.replace(/\\/g, '/');
}

function main(): void {
  const repoRoot = process.argv[2] ?? REPO_ROOT;

  let rootStat;
  try {
    rootStat = statSync(repoRoot);
  } catch {
    process.stderr.write(`chamber-isolation: scan root not found: ${repoRoot}\n`);
    process.exit(1);
  }
  if (!rootStat.isDirectory()) {
    process.stderr.write(`chamber-isolation: scan root is not a directory: ${repoRoot}\n`);
    process.exit(1);
  }

  const violations = scanChamberIsolation(repoRoot);
  if (violations.length === 0) {
    process.stdout.write(
      `chamber-isolation: OK — runtime (${RUNTIME_INDEX}) and authoring (${AUTHORING_FAMILY}/**) chambers are isolated: ` +
        `independent $schemaVersion lanes, no authoring predicate-signing field, no cross-chamber trust-root reference.\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `chamber-isolation: FAIL — per-chamber isolation (DR-049 D-SAK-1) violated. ` +
      `The runtime and authoring chambers must not share a version lane or a signing trust root:\n`,
  );
  for (const v of violations) {
    const where = v.line !== undefined ? `:${v.line}` : '';
    process.stderr.write(`  [${v.kind}] ${rel(v.file, repoRoot)}${where}  ${v.detail}\n`);
  }
  process.exit(1);
}

// Run only when invoked as a script (not when imported by the test harness).
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
