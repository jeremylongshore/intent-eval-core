#!/usr/bin/env -S node --experimental-strip-types
/**
 * check-changelog-observance.ts (9k5h.12 / doc 045 § 6) — the changelog-observance gate.
 *
 * "Changelog observance is mandatory and is the cheapest guard against a silent
 * schema swap: the kernel CHANGELOG (`schemas/authoring/v1/CHANGELOG.md`) is
 * canonical. A schema change without a matching changelog entry + a lineage-log
 * record fails CI." — intent-eval-lab 045-RR-LAND § 6.
 *
 * What the gate checks, per PR (diff against the merge-base with `--base`):
 *
 *   1. Every changed WATCHED SCHEMA FILE under `schemas/` (any `*.schema.json`,
 *      or an authoring-layer file: `upstream-base/*.json`, `is-overlay/*.json`,
 *      an authoring `index.json`) requires a same-PR modification to its
 *      GOVERNING CHANGELOG:
 *        - `schemas/authoring/v1/**` → `schemas/authoring/v1/CHANGELOG.md`
 *        - `schemas/authoring/vN/**` → `schemas/authoring/vN/CHANGELOG.md`
 *          (falling back to the root `CHANGELOG.md` if that file does not exist)
 *        - everything else under `schemas/` (the runtime `schemas/v1` chamber)
 *          → the root `CHANGELOG.md`
 *
 *   2. The ADDED lines of each required changelog must carry a MACHINE-READABLE
 *      LINEAGE REFERENCE. Doc 045 § 4 (Kleppmann) keys the lineage log on
 *      (upstream-identity, upstream-version); the append-only lineage log itself
 *      is beaded-not-built (045 § 7), so until it lands this gate requires the
 *      entry to cite the upstream identity/version it tracks as a token of the
 *      form:
 *
 *        lineage: <upstream-identity>@<upstream-version>
 *
 *      e.g. `lineage: agentskills.io@1.0`,
 *           `lineage: code.claude.com/docs/en/plugins-reference@2026-06-09`,
 *           `lineage: dr-049@d-sak-1` for IS-authored overlay/composition
 *           changes (the governing decision record IS the upstream there).
 *
 * The check is diff-scoped: pre-existing changelog entries are not retro-graded;
 * only the lines a PR adds must carry the token.
 *
 * Exit codes:
 *   0 — observant (no watched schema changes, or every change is matched)
 *   1 — at least one schema change without its changelog entry / lineage token
 *   2 — environment error (base ref unresolvable, not a git repo)
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-changelog-observance.ts \
 *     [--base <ref>] [--root <dir>]
 *
 *   --base defaults to `origin/main`; CI passes the PR base ref. The diff is
 *   taken from `git merge-base <base> HEAD` to the working tree, so the gate
 *   behaves identically on a PR merge ref and on a local feature branch.
 *
 * Invocations:
 *   - CI: .github/workflows/changelog-observance.yml (pull_request)
 *   - Manual: `pnpm run check:changelog-observance`
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/** Machine-readable lineage reference: `lineage: <identity>@<version>`. */
export const LINEAGE_TOKEN_RE = /\blineage:\s*[^\s@]+@\S+/i;

/** The changelog governing the authoring family `schemas/authoring/<v>/`. */
const AUTHORING_DIR_RE = /^schemas\/authoring\/(v\d+)\//;

const ROOT_CHANGELOG = 'CHANGELOG.md';

/**
 * Is this changed path a watched schema file — one whose change demands a
 * changelog entry? Watched: any `*.schema.json` under `schemas/`, plus the authoring
 * LAYER files (upstream-base + is-overlay captures and the authoring contract
 * registry `index.json`, whose lifecycle promotions are governance changes).
 */
export function isWatchedSchemaFile(path: string): boolean {
  if (!path.startsWith('schemas/')) return false;
  if (path.endsWith('.schema.json')) return true;
  const authoring = AUTHORING_DIR_RE.exec(path);
  if (authoring === null) return false;
  const rest = path.slice(authoring[0].length);
  if (/^(upstream-base|is-overlay)\/[^/]+\.json$/.test(rest)) return true;
  return rest === 'index.json';
}

/**
 * The governing changelog for a watched schema file. `exists` is injectable so
 * the mapping is testable without a filesystem.
 */
export function governingChangelogFor(
  path: string,
  exists: (p: string) => boolean = (p) => existsSync(p),
): string {
  const authoring = AUTHORING_DIR_RE.exec(path);
  if (authoring !== null) {
    const familyChangelog = `schemas/authoring/${authoring[1]}/CHANGELOG.md`;
    return exists(familyChangelog) ? familyChangelog : ROOT_CHANGELOG;
  }
  return ROOT_CHANGELOG;
}

export interface ObservanceFailure {
  changelog: string;
  schemaFiles: string[];
  reason: 'changelog-not-modified' | 'lineage-token-missing';
}

export interface ObservanceResult {
  watchedChanges: string[];
  failures: ObservanceFailure[];
}

/**
 * Pure evaluation: given the PR's changed files and a reader for the ADDED
 * lines of a changelog in this diff, decide observance.
 */
export function evaluateObservance(
  changedFiles: string[],
  addedLines: (changelog: string) => string[],
  exists: (p: string) => boolean = (p) => existsSync(p),
): ObservanceResult {
  const watchedChanges = changedFiles.filter(isWatchedSchemaFile);
  const changedSet = new Set(changedFiles);

  const bySchemaChangelog = new Map<string, string[]>();
  for (const file of watchedChanges) {
    const changelog = governingChangelogFor(file, exists);
    const group = bySchemaChangelog.get(changelog) ?? [];
    group.push(file);
    bySchemaChangelog.set(changelog, group);
  }

  const failures: ObservanceFailure[] = [];
  for (const [changelog, schemaFiles] of bySchemaChangelog) {
    if (!changedSet.has(changelog)) {
      failures.push({ changelog, schemaFiles, reason: 'changelog-not-modified' });
      continue;
    }
    if (!addedLines(changelog).some((line) => LINEAGE_TOKEN_RE.test(line))) {
      failures.push({ changelog, schemaFiles, reason: 'lineage-token-missing' });
    }
  }
  return { watchedChanges, failures };
}

// ─── git plumbing ─────────────────────────────────────────────────────────

function git(root: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function resolveMergeBase(root: string, base: string): string | undefined {
  const mergeBase = git(root, ['merge-base', base, 'HEAD']);
  if (mergeBase.status === 0) return mergeBase.stdout.trim();
  // A detached/just-committed fixture may have base == HEAD's parent only;
  // fall back to resolving the base ref directly.
  const direct = git(root, ['rev-parse', '--verify', `${base}^{commit}`]);
  return direct.status === 0 ? direct.stdout.trim() : undefined;
}

/** Changed paths from the merge-base to the working tree (committed + staged + unstaged). */
function changedFilesSince(root: string, mergeBase: string): string[] {
  const diff = git(root, ['diff', '--name-only', mergeBase]);
  return diff.stdout.split('\n').filter((line) => line.length > 0);
}

/** The ADDED lines of one file in the merge-base → working-tree diff. */
function addedLinesSince(root: string, mergeBase: string, file: string): string[] {
  const diff = git(root, ['diff', '--unified=0', mergeBase, '--', file]);
  return diff.stdout
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv;
  const baseFlag = argv.indexOf('--base');
  const base = baseFlag !== -1 ? (argv[baseFlag + 1] ?? 'origin/main') : 'origin/main';
  const rootFlag = argv.indexOf('--root');
  const root = rootFlag !== -1 ? (argv[rootFlag + 1] ?? process.cwd()) : process.cwd();

  const mergeBase = resolveMergeBase(root, base);
  if (mergeBase === undefined) {
    process.stderr.write(
      `changelog-observance: cannot resolve base ref "${base}" in ${root}. ` +
        'Pass --base <ref> (CI passes the PR base; locally fetch origin/main first).\n',
    );
    process.exit(2);
  }

  const changedFiles = changedFilesSince(root, mergeBase);
  const { watchedChanges, failures } = evaluateObservance(
    changedFiles,
    (changelog) => addedLinesSince(root, mergeBase, changelog),
    (p) => existsSync(join(root, p)),
  );

  if (watchedChanges.length === 0) {
    process.stdout.write(
      `changelog-observance: OK — no watched schema files changed vs ${base} ` +
        `(${changedFiles.length} changed file(s) inspected).\n`,
    );
    process.exit(0);
  }

  if (failures.length === 0) {
    process.stdout.write(
      `changelog-observance: OK — ${watchedChanges.length} schema change(s) each carry ` +
        'a governing changelog entry with a machine-readable lineage reference.\n',
    );
    process.exit(0);
  }

  // Neutral error copy — states the rule (045 § 6) and the resolution path.
  process.stderr.write(
    'changelog-observance: schema changes landed without their governing changelog ' +
      'entry. Changelog observance is mandatory (intent-eval-lab doc 045 § 6): a schema ' +
      'change requires a same-PR entry in its governing CHANGELOG carrying a ' +
      'machine-readable lineage reference of the form ' +
      '"lineage: <upstream-identity>@<upstream-version>".\n',
  );
  for (const failure of failures) {
    const what =
      failure.reason === 'changelog-not-modified'
        ? `missing artifact: no modification to ${failure.changelog} in this PR`
        : `missing artifact: ${failure.changelog} was modified, but its added lines carry ` +
          'no "lineage: <identity>@<version>" token';
    process.stderr.write(`  changed schema file(s) governed by ${failure.changelog}:\n`);
    for (const schemaFile of failure.schemaFiles) {
      process.stderr.write(`    - ${schemaFile}\n`);
    }
    process.stderr.write(`  ${what}\n`);
  }
  process.exit(1);
}

// Run only when invoked as a script (not when imported by the test harness).
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
