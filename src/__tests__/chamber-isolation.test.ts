/**
 * chamber-isolation (3kye.4) — the per-chamber kernel-isolation gate test.
 *
 * DR-049 / DR-081 D-SAK-1 (CTO ask b+c, CSO + CISO co-binding): the kernel is
 * BICAMERAL — a runtime chamber (schemas/v1/**) and an authoring chamber
 * (schemas/authoring/**) that share CODE but never a fused version lane or a
 * fused signing trust root. This gate machine-enforces three invariants:
 *   (A) independent $schemaVersion lane per chamber — no chamber index.json may
 *       carry a shared `schemaVersion` field;
 *   (B) no predicate-signing field in the authoring chamber — runtime MAY carry
 *       `signing_mode`, authoring (a deterministic lint) MAY NOT;
 *   (C) no shared signing trust root — no authoring schema $id/$ref/$comment may
 *       resolve to a runtime predicate / signing trust root.
 *
 * This test drives the real CLI (the same entrypoint CI runs), so it covers the
 * exit-code contract as well as the scan logic:
 *   1. against the REAL repo tree → exit 0 (the live invariant);
 *   2. against deliberately-failing fixtures (one per invariant) → exit 1
 *      (proves the gate is not vacuous), naming the offending file + kind;
 *   3. against a clean fixture → exit 0 (no false positives — and crucially the
 *      runtime chamber's own `signing_mode` is NOT flagged);
 *   4. the gate is wired as an npm script in the check chain + a CI step.
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/check-chamber-isolation.ts');
const FIXTURE_ROOT = join(REPO_ROOT, 'tests/chamber-isolation');

function runGate(arg?: string): { status: number; stdout: string; stderr: string } {
  const args = ['--experimental-strip-types', SCRIPT];
  if (arg !== undefined) args.push(arg);
  const result = spawnSync('node', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe('chamber-isolation (3kye.4)', () => {
  it('the REAL repo tree satisfies all three isolation invariants (exit 0)', () => {
    const { status, stdout } = runGate();
    expect(status, `gate failed:\n${stdout}`).toBe(0);
    expect(stdout).toContain('OK');
  });

  it('covers the WHOLE authoring family, including the v2 version dir [f-iec-chamber-1]', () => {
    // The default-run gate (what `pnpm run check` + CI invoke, no args) must
    // reach every authoring version dir's index — v2 lives under the scanned root.
    expect(statSync(join(REPO_ROOT, 'schemas/authoring/v1/index.json')).isFile()).toBe(true);
    expect(statSync(join(REPO_ROOT, 'schemas/authoring/v2/index.json')).isFile()).toBe(true);
    const { status, stdout } = runGate();
    expect(status).toBe(0);
    expect(stdout).toContain('schemas/authoring');
  });

  it('CATCHES a fused $schemaVersion lane on an AUTHORING index — exit 1 (not vacuous)', () => {
    const { status, stderr } = runGate(join(FIXTURE_ROOT, 'violation-version-lane'));
    expect(status).toBe(1);
    expect(stderr).toContain('version-lane');
    expect(stderr).toContain('schemaVersion');
    expect(stderr).toContain('schemas/authoring/v1/index.json');
  });

  it('CATCHES a fused $schemaVersion lane on the RUNTIME index too — exit 1', () => {
    const { status, stderr } = runGate(join(FIXTURE_ROOT, 'violation-runtime-version-lane'));
    expect(status).toBe(1);
    expect(stderr).toContain('version-lane');
    expect(stderr).toContain('schemas/v1/index.json');
  });

  it('CATCHES a predicate-signing field on an AUTHORING index — exit 1', () => {
    const { status, stderr } = runGate(join(FIXTURE_ROOT, 'violation-signing'));
    expect(status).toBe(1);
    expect(stderr).toContain('authoring-signing');
    expect(stderr).toContain('signing_mode');
    expect(stderr).toContain('schemas/authoring/v1/index.json');
  });

  it('CATCHES an authoring trust anchor sited in the runtime chamber — exit 1', () => {
    const { status, stderr } = runGate(join(FIXTURE_ROOT, 'violation-trust-root'));
    expect(status).toBe(1);
    expect(stderr).toContain('trust-root');
    expect(stderr).toContain('bad-trust-root.schema.json');
  });

  it('PASSES a clean fixture — exit 0, and does NOT flag the runtime signing_mode', () => {
    const { status, stderr } = runGate(join(FIXTURE_ROOT, 'clean'));
    expect(status, `clean fixture unexpectedly failed:\n${stderr}`).toBe(0);
  });

  it('is wired as an npm script in the check gate', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:chamber-isolation']).toContain('check-chamber-isolation.ts');
    expect(pkg.scripts['check']).toContain('check:chamber-isolation');
  });

  it('is wired as a CI step in ci.yml', () => {
    const ci = readFileSync(join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf-8');
    expect(ci).toContain('check:chamber-isolation');
  });
});
