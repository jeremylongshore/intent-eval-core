/**
 * predicate-namespace-isolation (3kye.5) — the gate test.
 *
 * Authoring conformance (schemas/authoring/v1/**) is a DETERMINISTIC LINT, never
 * a signed attestation. The signed-attestation surface (schemas/v1/**) is the
 * only place the `evals.intentsolutions.io` predicate namespace may appear
 * (ISEDC CISO binding — predicate URIs are scoped). So NO authoring schema may
 * reference that namespace, in any field, $comment, $id, or $ref.
 *
 * This test drives the real CLI (the same entrypoint CI runs), so it covers the
 * exit-code contract as well as the scan logic:
 *   1. against the REAL authoring schemas → exit 0 (the live invariant; this is
 *      the required-style check the CI gate wires in);
 *   2. against a deliberately-failing fixture → exit 1 (proves the gate is not
 *      vacuous) with the offending file named;
 *   3. against a clean fixture → exit 0 (proves no false positives);
 *   4. the gate is wired as an npm script + CI step (so it actually runs).
 */

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/check-predicate-namespace-isolation.ts');
const FIXTURE_ROOT = join(REPO_ROOT, 'tests/predicate-namespace-isolation');
const PREDICATE_NAMESPACE = 'evals.intentsolutions.io';

function runGate(arg?: string): { status: number; stdout: string; stderr: string } {
  const args = ['--experimental-strip-types', SCRIPT];
  if (arg !== undefined) args.push(arg);
  const result = spawnSync('node', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe('predicate-namespace-isolation (3kye.5)', () => {
  it('the real authoring schemas reference no predicate namespace (exit 0)', () => {
    const { status, stdout } = runGate();
    expect(status, `gate failed:\n${stdout}`).toBe(0);
    expect(stdout).toContain('OK');
  });

  it('CATCHES a deliberate violation — exit 1, names the file (not vacuous)', () => {
    const { status, stderr } = runGate(join(FIXTURE_ROOT, 'violation'));
    expect(status).toBe(1);
    expect(stderr.toLowerCase()).toContain(PREDICATE_NAMESPACE);
    expect(stderr).toContain('sample-authoring.schema.json');
  });

  it('PASSES a clean fixture — exit 0 (no false positives)', () => {
    const { status } = runGate(join(FIXTURE_ROOT, 'clean'));
    expect(status).toBe(0);
  });

  it('is wired as an npm script in the check gate', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:predicate-namespace']).toContain(
      'check-predicate-namespace-isolation.ts',
    );
    expect(pkg.scripts['check']).toContain('check:predicate-namespace');
  });

  it('is wired as a CI step in ci.yml', () => {
    const ci = readFileSync(join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf-8');
    expect(ci).toContain('check:predicate-namespace');
  });
});
