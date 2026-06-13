/**
 * 6767-h coverage-map gate tests (033-PP-PLAN-skill-refiner-sak-amendment-v7
 * § 14.2.3). The three gates over schemas/authoring/v1/6767h-coverage-map.json,
 * each driven through its REAL CLI (the same entrypoint CI runs) against a
 * repo-shaped fixture tree, per the prose-anchor-validity.test.ts convention:
 *
 *   1. check-coverage-map-completeness.ts — every composed-schema field of every
 *      registered authoring contract has a coverage-map entry (no missing, no
 *      stale);
 *   2. check-coverage-map-prose-anchors.ts — every anthropic-spec-derived
 *      `6767h_section` resolves against the vendored heading inventory (EXTENDS
 *      PR #37);
 *   3. check-is-extension-rationale.ts — every is-only-extension entry carries a
 *      non-empty rationale + upstream_convergence_trigger.
 *
 * Covered per gate: happy path on the LIVE repo (exit 0, not vacuous), plus at
 * least one constructed-failure fixture (exit 1 naming the offending field), plus
 * the wiring assertion (npm script + in the `check` chain + in CI).
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const COMPLETENESS = join(REPO_ROOT, 'scripts/check-coverage-map-completeness.ts');
const PROSE_ANCHORS = join(REPO_ROOT, 'scripts/check-coverage-map-prose-anchors.ts');
const RATIONALE = join(REPO_ROOT, 'scripts/check-is-extension-rationale.ts');

const MAP_REL = 'schemas/authoring/v1/6767h-coverage-map.json';
const INVENTORY_REL = 'schemas/prose-anchors/6767-h.headings.json';
const BASE_REL = 'schemas/authoring/v1/upstream-base/skill-frontmatter.v1.json';
const OVERLAY_REL = 'schemas/authoring/v1/is-overlay/skill-frontmatter.v1.json';

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(script: string, args: string[] = []): RunResult {
  const result = spawnSync('node', ['--experimental-strip-types', script, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

interface CoverageMap {
  $schemaVersion: string;
  fields: Record<string, Record<string, unknown>>;
}

/**
 * Build a repo-shaped fixture tree carrying the real coverage map, the real two
 * skill-frontmatter layers, and the real vendored inventory. Tests then mutate
 * the COPY to construct failures without touching the live repo.
 */
function makeFixture(): { root: string; map: CoverageMap } {
  const root = mkdtempSync(join(tmpdir(), 'coverage-map-'));
  for (const rel of [MAP_REL, INVENTORY_REL, BASE_REL, OVERLAY_REL]) {
    mkdirSync(join(root, dirname(rel)), { recursive: true });
    cpSync(join(REPO_ROOT, rel), join(root, rel));
  }
  const map = JSON.parse(readFileSync(join(root, MAP_REL), 'utf-8')) as CoverageMap;
  return { root, map };
}

function writeMap(root: string, map: CoverageMap): void {
  writeFileSync(join(root, MAP_REL), `${JSON.stringify(map, null, 2)}\n`);
}

// ─── Gate #1 — coverage-map-completeness ────────────────────────────────────

describe('check-coverage-map-completeness (§ 14.2.3 #1)', () => {
  it('the LIVE repo passes — every composed skill-frontmatter field is mapped (exit 0)', () => {
    const { status, stdout, stderr } = run(COMPLETENESS);
    expect(status, stderr).toBe(0);
    expect(stdout).toContain('OK');
    expect(stdout).toContain('1 registered authoring contract'); // skill-frontmatter walking skeleton
  });

  it('FAILS (exit 1) when a composed field has no coverage-map entry — names it', () => {
    const { root, map } = makeFixture();
    delete map.fields['skill-frontmatter.version'];
    writeMap(root, map);
    const { status, stderr } = run(COMPLETENESS, ['--root', root]);
    expect(status).toBe(1);
    expect(stderr).toContain('MISSING entry: skill-frontmatter.version');
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS (exit 1) on a STALE entry — a mapped field the composed schema does not declare', () => {
    const { root, map } = makeFixture();
    map.fields['skill-frontmatter.not-a-real-field'] = {
      trace_kind: 'is-only-extension',
      '6767h_section': null,
      rationale: 'x',
      upstream_convergence_trigger: 'y',
    };
    writeMap(root, map);
    const { status, stderr } = run(COMPLETENESS, ['--root', root]);
    expect(status).toBe(1);
    expect(stderr).toContain('STALE entry: skill-frontmatter.not-a-real-field');
    rmSync(root, { recursive: true, force: true });
  });

  it('is wired — npm script, in the `check` chain, and in CI', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:coverage-map']).toContain('check-coverage-map-completeness.ts');
    expect(pkg.scripts['check']).toContain('check:coverage-map');
    const wf = readFileSync(join(REPO_ROOT, '.github/workflows/coverage-map-gates.yml'), 'utf-8');
    expect(wf).toContain('pnpm run check:coverage-map');
    expect(wf).toContain('pull_request');
    expect(wf).toContain('push');
  });
});

// ─── Gate #2 — coverage-map prose-anchor validity (extends PR #37) ───────────

describe('check-coverage-map-prose-anchors (§ 14.2.3 #2, extends PR #37)', () => {
  it('the LIVE repo passes — every anthropic-spec-derived section resolves (exit 0)', () => {
    const { status, stdout, stderr } = run(PROSE_ANCHORS);
    expect(status, stderr).toBe(0);
    expect(stdout).toContain('OK');
  });

  it('FAILS (exit 1) on a dangling 6767h_section (renumbered-away) — names the field', () => {
    const { root, map } = makeFixture();
    map.fields['skill-frontmatter.name']!['6767h_section'] = '9.9';
    writeMap(root, map);
    const { status, stderr } = run(PROSE_ANCHORS, ['--root', root]);
    expect(status).toBe(1);
    expect(stderr).toContain('skill-frontmatter.name');
    expect(stderr).toContain('§9.9');
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS (exit 1) when an anthropic-spec-derived entry has a null 6767h_section', () => {
    const { root, map } = makeFixture();
    map.fields['skill-frontmatter.description']!['6767h_section'] = null;
    writeMap(root, map);
    const { status, stderr } = run(PROSE_ANCHORS, ['--root', root]);
    expect(status).toBe(1);
    expect(stderr).toContain('skill-frontmatter.description');
    expect(stderr).toContain('null/empty');
    rmSync(root, { recursive: true, force: true });
  });

  it('REUSES PR #37 machinery — imports loadInventory + resolves from check-prose-anchors', () => {
    const src = readFileSync(join(REPO_ROOT, 'scripts/check-coverage-map-prose-anchors.ts'), 'utf-8');
    expect(src).toContain("from './check-prose-anchors.ts'");
    expect(src).toContain('loadInventory');
    expect(src).toContain('resolves');
  });

  it('is wired — npm script, in the `check` chain, and in CI', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:coverage-map-prose-anchors']).toContain(
      'check-coverage-map-prose-anchors.ts',
    );
    expect(pkg.scripts['check']).toContain('check:coverage-map-prose-anchors');
    const wf = readFileSync(join(REPO_ROOT, '.github/workflows/coverage-map-gates.yml'), 'utf-8');
    expect(wf).toContain('pnpm run check:coverage-map-prose-anchors');
  });
});

// ─── Gate #3 — is-extension-rationale ───────────────────────────────────────

describe('check-is-extension-rationale (§ 14.2.3 #3)', () => {
  it('the LIVE repo passes — every is-only-extension carries rationale + trigger (exit 0)', () => {
    const { status, stdout, stderr } = run(RATIONALE);
    expect(status, stderr).toBe(0);
    expect(stdout).toContain('OK');
  });

  it('FAILS (exit 1) when an is-only-extension lacks rationale — names the field + key', () => {
    const { root, map } = makeFixture();
    delete map.fields['skill-frontmatter.tags']!['rationale'];
    writeMap(root, map);
    const { status, stderr } = run(RATIONALE, ['--root', root]);
    expect(status).toBe(1);
    expect(stderr).toContain('skill-frontmatter.tags');
    expect(stderr).toContain('rationale');
    rmSync(root, { recursive: true, force: true });
  });

  it('FAILS (exit 1) when upstream_convergence_trigger is empty/whitespace', () => {
    const { root, map } = makeFixture();
    map.fields['skill-frontmatter.author']!['upstream_convergence_trigger'] = '   ';
    writeMap(root, map);
    const { status, stderr } = run(RATIONALE, ['--root', root]);
    expect(status).toBe(1);
    expect(stderr).toContain('skill-frontmatter.author');
    expect(stderr).toContain('upstream_convergence_trigger');
    rmSync(root, { recursive: true, force: true });
  });

  it('is wired — npm script, in the `check` chain, and in CI', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:is-extension-rationale']).toContain(
      'check-is-extension-rationale.ts',
    );
    expect(pkg.scripts['check']).toContain('check:is-extension-rationale');
    const wf = readFileSync(join(REPO_ROOT, '.github/workflows/coverage-map-gates.yml'), 'utf-8');
    expect(wf).toContain('pnpm run check:is-extension-rationale');
  });
});
