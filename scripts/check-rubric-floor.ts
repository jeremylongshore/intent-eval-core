#!/usr/bin/env -S node --experimental-strip-types
/**
 * check-rubric-floor.ts (3kye.6 / DR-049) — the anti-realignment guard.
 *
 * The IS marketplace rubric SITS ON TOP of the permissive upstream floor and is
 * intentionally STRICT (SCHEMA_CHANGELOG NON-NEGOTIABLE #3; the 2026-04-28
 * "realign to Anthropic's floor" debacle). This guard makes that strictness
 * tamper-evident: it FAILS if a required field is removed/weakened from any
 * contract's marketplace (is-overlay) required set, OR the UNIVERSAL-IMMUTABLE
 * securityChecks fold is weakened — UNLESS an explicit ADR marker authorizes it.
 *
 * It compares the LIVE schemas against a frozen FLOOR baseline embedded below.
 * The check is one-directional: ADDING required fields / reserved words /
 * hardening patterns is always fine (the rubric is add-only). Only a REDUCTION
 * (a removed required field, a dropped reserved word, a weakened security
 * pattern) trips the guard.
 *
 * ── Self-pin (3kye.6) ──
 *
 * This file is hash-pinned in `.harness-hash` (via `.harness-hash-extra-patterns`).
 * `audit-harness verify` fails on any byte change to it without a fresh
 * `audit-harness init`. So the floor cannot be weakened in the same PR that
 * weakens this guard — re-pinning is a separate, reviewable engineer action.
 *
 * ── ADR escape hatch ──
 *
 * A legitimate floor reduction is authorized by adding an ADR marker line of the
 * form `RUBRIC-FLOOR-ADR: <reason>` to FORBIDDEN.md (or ALLOWLIST.md). With a
 * marker present the guard downgrades a reduction to an informational note
 * instead of a failure — so the reduction is always accompanied by a recorded,
 * reviewed rationale rather than slipping through silently.
 *
 * Exit codes:
 *   0 — floor intact (or a reduction is ADR-authorized)
 *   1 — floor weakened with no ADR marker (neutral error copy)
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-rubric-floor.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

/** The ADR marker that authorizes a deliberate floor reduction. */
export const ADR_MARKER = 'RUBRIC-FLOOR-ADR:';

/**
 * The FROZEN FLOOR baseline. Each contract's marketplace (is-overlay) required
 * set must remain a SUPERSET of its entry here; the securityChecks fold must
 * keep every reserved word and security pattern. Adding to any of these is fine;
 * removing from them without an ADR marker is the violation this guard catches.
 *
 * This is intentionally a self-contained literal (not derived from the live
 * schemas) — it is the immovable baseline the live schemas are measured against.
 */
export const RUBRIC_FLOOR = {
  /** Per-contract marketplace (is-overlay) required-field floor. */
  overlayRequired: {
    'skill-frontmatter': ['allowed-tools', 'version', 'author', 'license', 'compatibility', 'tags'],
    'plugin-manifest': [
      'version',
      'description',
      'author',
      'homepage',
      'license',
      'keywords',
      'commands',
    ],
    'agent-definition': ['tools', 'model', 'color', 'version', 'author', 'tags'],
    'mcp-config': ['description', 'version', 'enabled'],
    'hook-config': ['description', 'enabled', 'timeout', 'blocking'],
    'marketplace-catalog': ['version', 'description', 'license', 'homepage', 'keywords'],
  },
  /** securityChecks fold floor (UNIVERSAL-IMMUTABLE). */
  securityChecks: {
    reservedNames: ['skill', 'claude', 'anthropic', 'mcp', 'plugin', 'agent'],
    /** Patterns the fold must keep (substring-checked against the live fold JSON). */
    requiredPatterns: ['[<>]', '<[^>]+>|\\$\\{'],
  },
} as const;

interface Reduction {
  readonly surface: string;
  readonly detail: string;
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

/**
 * Collect every floor reduction (a baseline entry the live schema no longer
 * carries), reading authoring schemas under `<root>/schemas/authoring/v1`. The
 * `root` arg defaults to the repo root; the test harness points it at a fixture
 * tree to exercise the detection path.
 */
export function collectReductions(root: string = REPO_ROOT): Reduction[] {
  const authoringDir = join(root, 'schemas/authoring/v1');
  const reductions: Reduction[] = [];

  // 1) Per-contract marketplace required-set floor.
  for (const [contract, floor] of Object.entries(RUBRIC_FLOOR.overlayRequired)) {
    const overlay = loadJson(join(authoringDir, 'is-overlay', `${contract}.v1.json`));
    const live = new Set((overlay['required'] as string[] | undefined) ?? []);
    for (const field of floor) {
      if (!live.has(field)) {
        reductions.push({
          surface: `is-overlay/${contract}`,
          detail: `required field "${field}" removed from the marketplace required set`,
        });
      }
    }
  }

  // 2) securityChecks fold floor.
  const tier = loadJson(join(authoringDir, 'marketplace-tier.schema.json'));
  const defs = (tier['$defs'] ?? {}) as Record<string, unknown>;
  const securityFold = JSON.stringify(defs['securityChecks'] ?? {});
  for (const word of RUBRIC_FLOOR.securityChecks.reservedNames) {
    if (!securityFold.includes(`"${word}"`)) {
      reductions.push({
        surface: 'securityChecks',
        detail: `reserved word "${word}" removed from the securityChecks fold`,
      });
    }
  }
  for (const pattern of RUBRIC_FLOOR.securityChecks.requiredPatterns) {
    if (!securityFold.includes(JSON.stringify(pattern).slice(1, -1))) {
      reductions.push({
        surface: 'securityChecks',
        detail: `security pattern ${JSON.stringify(pattern)} removed/weakened in the securityChecks fold`,
      });
    }
  }

  return reductions;
}

/** Whether an ADR marker authorizing a reduction is present in the boundary docs under `root`. */
export function adrMarkerPresent(root: string = REPO_ROOT): boolean {
  for (const file of ['FORBIDDEN.md', 'ALLOWLIST.md']) {
    const path = join(root, file);
    if (existsSync(path) && readFileSync(path, 'utf-8').includes(ADR_MARKER)) {
      return true;
    }
  }
  return false;
}

function main(): void {
  // Optional `--root <dir>` override (used by the test harness against fixtures).
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag !== -1 ? (process.argv[rootFlag + 1] ?? REPO_ROOT) : REPO_ROOT;
  const reductions = collectReductions(root);

  if (reductions.length === 0) {
    process.stdout.write(
      'rubric-floor: OK — the marketplace required floor and securityChecks fold are intact.\n',
    );
    process.exit(0);
  }

  if (adrMarkerPresent(root)) {
    process.stdout.write(
      `rubric-floor: ${reductions.length} floor reduction(s) detected, authorized by an ${ADR_MARKER} marker:\n`,
    );
    for (const r of reductions) {
      process.stdout.write(`  ${r.surface}: ${r.detail}\n`);
    }
    process.exit(0);
  }

  // Neutral error copy — states the rule and the resolution, no blame language.
  process.stderr.write(
    'rubric-floor: the marketplace required floor or securityChecks fold was reduced ' +
      'without an authorizing ADR marker. The IS marketplace rubric is add-only by design. ' +
      `To authorize a deliberate reduction, add a line beginning "${ADR_MARKER}" to ` +
      'FORBIDDEN.md or ALLOWLIST.md recording the rationale. Detected reduction(s):\n',
  );
  for (const r of reductions) {
    process.stderr.write(`  ${r.surface}: ${r.detail}\n`);
  }
  process.exit(1);
}

// Run only when invoked as a script (not when imported by the test harness).
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
