#!/usr/bin/env -S node --experimental-strip-types
/**
 * check-is-extension-rationale.ts — § 14.2.3 gate #3 (is-extension-rationale).
 *
 * "for `trace_kind: "is-only-extension"` entries, both `rationale` AND
 *  `upstream_convergence_trigger` are non-empty."
 * (033-PP-PLAN-skill-refiner-sak-amendment-v7 § 14.2.3).
 *
 * An IS-only extension has NO 6767-h prose anchor by design — so the coverage
 * map demands it carry, in lieu of an anchor, (a) a `category`, (b) a non-empty
 * `rationale` for why it is not in 6767-h, and (c) a non-empty
 * `upstream_convergence_trigger` (the condition under which the field MOVES to
 * upstream-base). This gate makes the rationale + trigger MANDATORY so a new
 * IS-only extension and its justification arrive in the same PR (§ 14.2.3: "the
 * rationale CI gate ensures both arrive in the same PR").
 *
 * Deterministic, offline, no LLM. Scripts do not cross-import.
 *
 * Exit codes:
 *   0 — every is-only-extension entry has non-empty rationale + upstream_convergence_trigger
 *   1 — at least one entry missing either (neutral copy names each + the missing key)
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-is-extension-rationale.ts [--root <dir>]
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

export const COVERAGE_MAP_PATH = 'schemas/authoring/v1/6767h-coverage-map.json';

interface CoverageMapEntry {
  readonly trace_kind: string;
  readonly rationale?: unknown;
  readonly upstream_convergence_trigger?: unknown;
}
interface CoverageMap {
  readonly fields: Record<string, CoverageMapEntry>;
}

/** The keys an is-only-extension entry must carry as non-empty strings. */
export const REQUIRED_KEYS = ['rationale', 'upstream_convergence_trigger'] as const;

export interface RationaleViolation {
  readonly field: string;
  readonly missingKey: (typeof REQUIRED_KEYS)[number];
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Every is-only-extension entry missing a non-empty rationale or trigger. */
export function findRationaleViolations(root: string = REPO_ROOT): {
  checked: number;
  violations: RationaleViolation[];
} {
  const map = JSON.parse(
    readFileSync(join(root, COVERAGE_MAP_PATH), 'utf-8'),
  ) as CoverageMap;

  const violations: RationaleViolation[] = [];
  let checked = 0;
  for (const [field, entry] of Object.entries(map.fields)) {
    if (entry.trace_kind !== 'is-only-extension') continue;
    checked += 1;
    for (const key of REQUIRED_KEYS) {
      if (!nonEmptyString(entry[key])) violations.push({ field, missingKey: key });
    }
  }
  return { checked, violations };
}

function main(): void {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag !== -1 ? (process.argv[rootFlag + 1] ?? REPO_ROOT) : REPO_ROOT;

  if (!existsSync(join(root, COVERAGE_MAP_PATH))) {
    process.stderr.write(
      `is-extension-rationale: missing coverage map at ${COVERAGE_MAP_PATH}.\n`,
    );
    process.exit(1);
  }

  const { checked, violations } = findRationaleViolations(root);

  if (violations.length === 0) {
    process.stdout.write(
      `is-extension-rationale: OK — all ${checked} is-only-extension entry(ies) carry a ` +
        'non-empty rationale AND upstream_convergence_trigger.\n',
    );
    process.exit(0);
  }

  process.stderr.write(
    `is-extension-rationale: ${violations.length} field(s) (033-PP-PLAN v7 § 14.2.3 ` +
      'gate #3) are is-only-extension but lack a non-empty rationale and/or ' +
      'upstream_convergence_trigger. Every IS-only extension must justify why it has no ' +
      '6767-h anchor (rationale) AND state when it would converge upstream ' +
      '(upstream_convergence_trigger). Offending field(s):\n',
  );
  for (const v of violations) {
    process.stderr.write(`  ${v.field}: missing or empty "${v.missingKey}"\n`);
  }
  process.exit(1);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
