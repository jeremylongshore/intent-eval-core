/**
 * kernel-rubric-floor-guard (3kye.6 / DR-049) — the anti-realignment guard test.
 *
 * The IS marketplace rubric is add-only by design (SCHEMA_CHANGELOG
 * NON-NEGOTIABLE #3; the 2026-04-28 "realign to Anthropic's floor" debacle).
 * `scripts/check-rubric-floor.ts` makes that tamper-evident: it FAILS if a
 * required field is removed from any contract's marketplace required set, or the
 * securityChecks fold is weakened, without an ADR marker.
 *
 * This test drives the real CLI (the same entrypoint CI runs):
 *   1. against the LIVE schemas → exit 0 (the floor is intact today);
 *   2. against a fixture tree with a required field REMOVED → exit 1 (not
 *      vacuous), naming the reduced surface;
 *   3. the SAME reduction + an ADR marker → exit 0 (the escape hatch works);
 *   4. the guard is self-pinned in .harness-hash (cannot be weakened in the same
 *      PR that weakens the floor);
 *   5. the guard is wired as an npm script + a CI step (the gate actually runs).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/check-rubric-floor.ts');

function runGate(root?: string): { status: number; stdout: string; stderr: string } {
  const args = ['--experimental-strip-types', SCRIPT];
  if (root !== undefined) args.push('--root', root);
  const result = spawnSync('node', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe('kernel-rubric-floor-guard (3kye.6) — live floor is intact', () => {
  it('the live schemas satisfy the frozen floor (exit 0)', () => {
    const { status, stdout } = runGate();
    expect(status, `guard failed:\n${stdout}`).toBe(0);
    expect(stdout).toContain('intact');
  });
});

describe('kernel-rubric-floor-guard (3kye.6) — detects a reduction (not vacuous)', () => {
  let fixtureRoot: string;

  beforeAll(() => {
    // Build a throwaway repo-shaped tree: copy the authoring schemas, then weaken
    // the floor by removing a required field from one contract's overlay.
    fixtureRoot = mkdtempSync(join(tmpdir(), 'rubric-floor-'));
    cpSync(join(REPO_ROOT, 'schemas'), join(fixtureRoot, 'schemas'), { recursive: true });
    const overlayPath = join(fixtureRoot, 'schemas/authoring/v1/is-overlay/mcp-config.v1.json');
    const overlay = JSON.parse(readFileSync(overlayPath, 'utf-8')) as { required: string[] };
    overlay.required = overlay.required.filter((f) => f !== 'enabled');
    writeFileSync(overlayPath, `${JSON.stringify(overlay, null, 2)}\n`);
  });

  afterAll(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it('a removed required field fails the gate (exit 1) and names the surface', () => {
    const { status, stderr } = runGate(fixtureRoot);
    expect(status).toBe(1);
    expect(stderr).toContain('is-overlay/mcp-config');
    expect(stderr).toContain('enabled');
    // Neutral, actionable error copy (states the rule + the resolution).
    expect(stderr).toContain('add-only by design');
    expect(stderr).toContain('RUBRIC-FLOOR-ADR:');
  });

  it('the same reduction PLUS an ADR marker passes (exit 0 — escape hatch works)', () => {
    appendFileSync(
      join(fixtureRoot, 'ALLOWLIST.md'),
      '\nRUBRIC-FLOOR-ADR: deliberate test reduction, reviewed.\n',
    );
    const { status, stdout } = runGate(fixtureRoot);
    expect(status).toBe(0);
    expect(stdout).toContain('authorized by an RUBRIC-FLOOR-ADR:');
  });
});

describe('kernel-rubric-floor-guard (3kye.6) — self-pin + wiring', () => {
  it('the guard file is hash-pinned in .harness-hash (self-pin)', () => {
    const manifest = readFileSync(join(REPO_ROOT, '.harness-hash'), 'utf-8');
    expect(manifest).toContain('scripts/check-rubric-floor.ts');
  });

  it('the guard is declared in .harness-hash-extra-patterns', () => {
    const patterns = readFileSync(join(REPO_ROOT, '.harness-hash-extra-patterns'), 'utf-8');
    expect(patterns).toContain('scripts/check-rubric-floor.ts');
  });

  it('the guard is wired as an npm script and into the check gate', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:rubric-floor']).toContain('check-rubric-floor.ts');
    expect(pkg.scripts['check']).toContain('check:rubric-floor');
  });

  it('the guard is wired as a CI step in ci.yml', () => {
    const ci = readFileSync(join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf-8');
    expect(ci).toContain('check:rubric-floor');
  });
});
