#!/usr/bin/env -S node --experimental-strip-types
/**
 * check-predicate-namespace-isolation.ts (3kye.5) — predicate-namespace isolation gate.
 *
 * The authoring family (schemas/authoring/v1/**) is a DETERMINISTIC LINT: it
 * answers "is this skill/plugin/agent/mcp/hook/marketplace artifact a valid
 * agent-native artifact?" with a pure, reproducible accept/reject. It is NEVER
 * a signed attestation. The signed-attestation surface is the runtime predicate
 * family under schemas/v1/**, whose predicate URIs live ONLY at the
 * `evals.intentsolutions.io` host (ISEDC CISO binding — predicate URIs are
 * scoped; not `labs.`, not authoring).
 *
 * Therefore NO authoring schema may reference the `evals.intentsolutions.io`
 * predicate namespace — in any field value, `$comment`, `$id`, `$ref`, or
 * anywhere else. A reference would conflate the deterministic-lint surface with
 * the signed-attestation surface (a category error the CISO binding forbids).
 * This gate fails the build if any authoring schema does.
 *
 * Exit codes:
 *   0 — clean (no authoring schema references the predicate namespace)
 *   1 — violation(s) found (one line per hit on stderr)
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-predicate-namespace-isolation.ts
 *   node --experimental-strip-types scripts/check-predicate-namespace-isolation.ts <dir>
 *
 * The optional <dir> arg overrides the scan root (used by the test harness to
 * point at a fixture tree). Default: schemas/authoring/v1 at the repo root.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

/**
 * The forbidden predicate namespace. Authoring conformance is a deterministic
 * lint, never a signed attestation, so the signed-predicate host must not appear
 * in any authoring schema. Matched case-insensitively as a substring so a hit in
 * a `$id`, `$ref`, `$comment`, or any field value is caught.
 */
export const PREDICATE_NAMESPACE = 'evals.intentsolutions.io';

export interface NamespaceViolation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Recursively collect every `.json` file under `dir`. */
function jsonFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...jsonFilesUnder(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan every authoring JSON schema under `root` for the predicate namespace.
 * Returns one violation per matching line. Exported for the test harness.
 */
export function scanForPredicateNamespace(root: string): NamespaceViolation[] {
  const violations: NamespaceViolation[] = [];
  const needle = PREDICATE_NAMESPACE.toLowerCase();
  for (const file of jsonFilesUnder(root)) {
    const lines = readFileSync(file, 'utf-8').split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(needle)) {
        violations.push({ file, line: index + 1, text: line.trim() });
      }
    });
  }
  return violations;
}

function main(): void {
  const root = process.argv[2] ?? join(REPO_ROOT, 'schemas/authoring/v1');

  let entryStat;
  try {
    entryStat = statSync(root);
  } catch {
    process.stderr.write(`predicate-namespace-isolation: scan root not found: ${root}\n`);
    process.exit(1);
  }
  if (!entryStat.isDirectory()) {
    process.stderr.write(`predicate-namespace-isolation: scan root is not a directory: ${root}\n`);
    process.exit(1);
  }

  const violations = scanForPredicateNamespace(root);
  if (violations.length === 0) {
    process.stdout.write(
      `predicate-namespace-isolation: OK — no authoring schema references ${PREDICATE_NAMESPACE}.\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `predicate-namespace-isolation: FAIL — authoring schemas must not reference the predicate ` +
      `namespace "${PREDICATE_NAMESPACE}" (authoring conformance is a deterministic lint, never a ` +
      `signed attestation):\n`,
  );
  for (const v of violations) {
    const rel = v.file.startsWith(REPO_ROOT) ? relative(REPO_ROOT, v.file) : v.file;
    process.stderr.write(`  ${rel}:${v.line}  ${v.text}\n`);
  }
  process.exit(1);
}

// Run only when invoked as a script (not when imported by the test harness).
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
