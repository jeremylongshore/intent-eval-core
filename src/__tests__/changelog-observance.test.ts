/**
 * changelog-observance gate tests (9k5h.12 / intent-eval-lab doc 045 § 6).
 *
 * One script under test, driven through the real CLI (the same entrypoint CI
 * runs), per the rubric-floor-guard test convention:
 *
 *   - scripts/check-changelog-observance.ts — the gate: a watched schema change
 *     (schemas/**\/*.schema.json or an authoring-layer file) requires a same-PR
 *     modification to its governing CHANGELOG whose added lines carry a
 *     machine-readable lineage reference
 *     (`lineage: <upstream-identity>@<upstream-version>`).
 *
 * Fixture-driven against throwaway git repos:
 *   1. no schema change → pass (including non-watched files under schemas/);
 *   2. schema change + governing changelog entry + lineage token → pass, for
 *      all three changelog routings (authoring/v1, authoring/v2, runtime→root);
 *   3. schema change WITHOUT the governing changelog → fail, naming the changed
 *      schema files + the missing changelog (a wrong-changelog edit does not
 *      satisfy the right one);
 *   4. changelog entry WITHOUT the lineage token → fail, naming the token;
 *   5. unresolvable base ref → environment error (exit 2);
 *   6. wiring — the gate is an npm script + a PR-triggered CI workflow with the
 *      full-history checkout the diff needs.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const SCRIPT = join(REPO_ROOT, 'scripts/check-changelog-observance.ts');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runGate(root: string, base: string): RunResult {
  const result = spawnSync(
    'node',
    ['--experimental-strip-types', SCRIPT, '--root', root, '--base', base],
    { cwd: root, encoding: 'utf-8' },
  );
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
  expect(result.status, `git ${args.join(' ')} failed:\n${result.stderr}`).toBe(0);
  return result.stdout;
}

function write(root: string, rel: string, content: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

const V1_CHANGELOG = 'schemas/authoring/v1/CHANGELOG.md';
const V2_CHANGELOG = 'schemas/authoring/v2/CHANGELOG.md';
const V1_OVERLAY = 'schemas/authoring/v1/is-overlay/skill-frontmatter.v1.json';
const V2_SCHEMA = 'schemas/authoring/v2/skill-frontmatter.schema.json';
const RUNTIME_SCHEMA = 'schemas/v1/gate-result.schema.json';

const fixtureRoots: string[] = [];

/** A throwaway repo-shaped git fixture with one base commit. */
function makeFixtureRepo(): { root: string; base: string } {
  const root = mkdtempSync(join(tmpdir(), 'changelog-observance-'));
  fixtureRoots.push(root);
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  git(root, ['config', 'user.name', 'fixture']);
  git(root, ['config', 'commit.gpgsign', 'false']);

  write(root, 'CHANGELOG.md', '# Changelog\n\n## [0.1.0]\n\n- base entry\n');
  write(root, V1_CHANGELOG, '# Authoring tier v1 changelogs\n\n- base entry\n');
  write(root, V1_OVERLAY, '{\n  "required": ["name"]\n}\n');
  write(root, V2_CHANGELOG, '# Authoring tier v2 changelogs\n\n- base entry\n');
  write(root, V2_SCHEMA, '{\n  "allOf": []\n}\n');
  write(root, RUNTIME_SCHEMA, '{\n  "type": "object"\n}\n');
  write(root, 'schemas/prose-anchors/6767-h.headings.json', '[]\n');
  write(root, 'notes.md', 'base\n');

  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'base']);
  const base = git(root, ['rev-parse', 'HEAD']).trim();
  return { root, base };
}

afterAll(() => {
  for (const root of fixtureRoots) rmSync(root, { recursive: true, force: true });
});

describe('changelog-observance (9k5h.12) — no watched schema change passes', () => {
  it('a PR touching no schema files is observant (exit 0)', () => {
    const { root, base } = makeFixtureRepo();
    appendFileSync(join(root, 'notes.md'), 'scripts-and-docs-only change\n');
    const { status, stdout } = runGate(root, base);
    expect(status, stdout).toBe(0);
    expect(stdout).toContain('no watched schema files changed');
  });

  it('a non-watched file under schemas/ (vendored heading inventory) is not gated', () => {
    const { root, base } = makeFixtureRepo();
    write(root, 'schemas/prose-anchors/6767-h.headings.json', '[{ "level": 2 }]\n');
    const { status, stdout } = runGate(root, base);
    expect(status, stdout).toBe(0);
    expect(stdout).toContain('no watched schema files changed');
  });
});

describe('changelog-observance (9k5h.12) — schema change WITH changelog entry + lineage passes', () => {
  it('authoring/v1 layer change + v1 CHANGELOG entry carrying a lineage token (exit 0)', () => {
    const { root, base } = makeFixtureRepo();
    write(root, V1_OVERLAY, '{\n  "required": ["name", "version"]\n}\n');
    appendFileSync(
      join(root, V1_CHANGELOG),
      '\n- overlay-required delta widened. lineage: agentskills.io@1.0\n',
    );
    const { status, stdout, stderr } = runGate(root, base);
    expect(status, stderr).toBe(0);
    expect(stdout).toContain('machine-readable lineage reference');
  });

  it('authoring/v2 change routes to the v2 CHANGELOG, not v1 (exit 0)', () => {
    const { root, base } = makeFixtureRepo();
    write(root, V2_SCHEMA, '{\n  "allOf": [{ "type": "object" }]\n}\n');
    appendFileSync(
      join(root, V2_CHANGELOG),
      '\n- strict fold tightened. lineage: dr-049@d-sak-1\n',
    );
    const { status, stderr } = runGate(root, base);
    expect(status, stderr).toBe(0);
  });

  it('runtime schemas/v1 change routes to the root CHANGELOG (exit 0)', () => {
    const { root, base } = makeFixtureRepo();
    write(root, RUNTIME_SCHEMA, '{\n  "type": "object",\n  "required": ["verdict"]\n}\n');
    appendFileSync(
      join(root, 'CHANGELOG.md'),
      '\n- gate-result predicate tightened. lineage: blueprint-b@7.0\n',
    );
    const { status, stderr } = runGate(root, base);
    expect(status, stderr).toBe(0);
  });

  it('the lineage token is case-insensitive (exit 0)', () => {
    const { root, base } = makeFixtureRepo();
    write(root, V1_OVERLAY, '{\n  "required": ["name", "tags"]\n}\n');
    appendFileSync(join(root, V1_CHANGELOG), '\n- widened. Lineage: AgentSkills.io@v1.0\n');
    const { status, stderr } = runGate(root, base);
    expect(status, stderr).toBe(0);
  });
});

describe('changelog-observance (9k5h.12) — schema change WITHOUT changelog fails (not vacuous)', () => {
  it('names the changed schema file and the missing governing changelog (exit 1)', () => {
    const { root, base } = makeFixtureRepo();
    write(root, V1_OVERLAY, '{\n  "required": ["name", "version"]\n}\n');
    const { status, stderr } = runGate(root, base);
    expect(status).toBe(1);
    expect(stderr).toContain(V1_OVERLAY);
    expect(stderr).toContain(`no modification to ${V1_CHANGELOG}`);
    // Neutral, actionable error copy (states the rule + the required token).
    expect(stderr).toContain('045 § 6');
    expect(stderr).toContain('lineage: <upstream-identity>@<upstream-version>');
  });

  it('editing the WRONG changelog does not satisfy the governing one (exit 1)', () => {
    const { root, base } = makeFixtureRepo();
    write(root, RUNTIME_SCHEMA, '{\n  "type": "object",\n  "required": ["verdict"]\n}\n');
    // Runtime schemas are governed by the ROOT changelog; an authoring/v1 entry is not it.
    appendFileSync(join(root, V1_CHANGELOG), '\n- misc. lineage: blueprint-b@7.0\n');
    const { status, stderr } = runGate(root, base);
    expect(status).toBe(1);
    expect(stderr).toContain(RUNTIME_SCHEMA);
    expect(stderr).toContain('no modification to CHANGELOG.md');
  });
});

describe('changelog-observance (9k5h.12) — changelog entry without a lineage token fails', () => {
  it('a same-PR changelog entry with no machine-readable lineage reference (exit 1)', () => {
    const { root, base } = makeFixtureRepo();
    write(root, V1_OVERLAY, '{\n  "required": ["name", "version"]\n}\n');
    appendFileSync(join(root, V1_CHANGELOG), '\n- widened the overlay, no provenance cited\n');
    const { status, stderr } = runGate(root, base);
    expect(status).toBe(1);
    expect(stderr).toContain(V1_OVERLAY);
    expect(stderr).toContain('no "lineage: <identity>@<version>" token');
  });

  it('an identity without a version does not satisfy the token (exit 1)', () => {
    const { root, base } = makeFixtureRepo();
    write(root, V1_OVERLAY, '{\n  "required": ["name", "version"]\n}\n');
    appendFileSync(join(root, V1_CHANGELOG), '\n- widened. lineage: agentskills.io\n');
    const { status, stderr } = runGate(root, base);
    expect(status).toBe(1);
    expect(stderr).toContain('no "lineage: <identity>@<version>" token');
  });
});

describe('changelog-observance (9k5h.12) — environment errors are distinct (exit 2)', () => {
  it('an unresolvable base ref exits 2 with a resolution hint', () => {
    const { root } = makeFixtureRepo();
    const { status, stderr } = runGate(root, 'origin/does-not-exist');
    expect(status).toBe(2);
    expect(stderr).toContain('cannot resolve base ref');
  });
});

describe('changelog-observance (9k5h.12) — wiring (the gate actually runs)', () => {
  it('is an npm script', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['check:changelog-observance']).toContain('check-changelog-observance.ts');
  });

  it('is a PR-triggered CI workflow with the full-history checkout the diff needs', () => {
    const workflow = readFileSync(
      join(REPO_ROOT, '.github/workflows/changelog-observance.yml'),
      'utf-8',
    );
    expect(workflow).toContain('pull_request');
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('check:changelog-observance');
  });
});
