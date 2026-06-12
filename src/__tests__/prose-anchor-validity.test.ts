/**
 * prose-anchor-validity gate tests (033-PP-PLAN v7 § 14.16).
 *
 * Two scripts under test, driven through the real CLIs (the same entrypoints
 * CI runs), per the rubric-floor-guard test convention:
 *
 *   - scripts/parse-spec-headings.ts — the deterministic § 14.16.1
 *     section-heading parser (markdown-it pinned exact, heading tokens only);
 *   - scripts/check-prose-anchors.ts — the gate: every 6767-h section cited in
 *     a schema $comment must resolve in the vendored heading inventory.
 *
 * Covered:
 *   1. parser fixture — numeric + named + appendix headings, code-fence `#`
 *      lines NOT misread as headings, line numbers, determinism;
 *   2. happy path — the live repo passes (exit 0);
 *   3. dangling anchor — a fixture tree citing a nonexistent section fails
 *      (exit 1) naming the file + anchor (the gate is not vacuous);
 *   4. named-anchor resolution — pins the generator/checker slug parity;
 *   5. wiring — the gate is an npm script, in the `check` chain, in CI, and
 *      markdown-it is pinned EXACT per § 14.16.1.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const PARSER = join(REPO_ROOT, 'scripts/parse-spec-headings.ts');
const CHECKER = join(REPO_ROOT, 'scripts/check-prose-anchors.ts');
const INVENTORY_REL = 'schemas/prose-anchors/6767-h.headings.json';

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

interface Heading {
  level: number;
  text: string;
  line: number;
  numeric_id: string | null;
  anchors: string[];
}

interface Inventory {
  source: string;
  source_sha256: string;
  generated_at: string;
  parser: string;
  headings: Heading[];
}

/** Fixture spec exercising every heading form § 14.16.1 names. */
const FIXTURE_SPEC = `# Fixture Master Spec

## Executive Summary

Prose.

## 1) Canonical Directory Structure

### 1.1 Plugin Root Anatomy

\`\`\`text
# this fenced line is NOT a heading
## neither is this one
\`\`\`

## 3) Skill Definition

### 3.1 YAML Frontmatter (Required)

## Skill Frontmatter

Named section, no number.

## Appendix A: Canonical References
`;

describe('parse-spec-headings (§ 14.16.1 parser)', () => {
  let fixtureDir: string;
  let inventory: Inventory;

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), 'prose-parser-'));
    writeFileSync(join(fixtureDir, 'spec.md'), FIXTURE_SPEC);
    const out = join(fixtureDir, 'headings.json');
    const { status, stderr } = run(PARSER, [join(fixtureDir, 'spec.md'), '--out', out]);
    expect(status, stderr).toBe(0);
    inventory = JSON.parse(readFileSync(out, 'utf-8')) as Inventory;
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('parses heading tokens only — fenced-code # lines are not headings', () => {
    expect(inventory.headings).toHaveLength(8);
    expect(inventory.headings.map((h) => h.text)).not.toContain(
      '# this fenced line is NOT a heading',
    );
  });

  it('extracts the numerical hierarchy (1, 1.1, 3, 3.1) with levels + 1-based lines', () => {
    const byId = new Map(inventory.headings.map((h) => [h.numeric_id, h]));
    expect(byId.get('1')?.level).toBe(2);
    expect(byId.get('1.1')?.level).toBe(3);
    expect(byId.get('3.1')?.text).toBe('3.1 YAML Frontmatter (Required)');
    expect(inventory.headings[0]?.line).toBe(1);
    expect(byId.get('1')?.line).toBe(7);
  });

  it('named sections carry slug anchors (§Skill-Frontmatter form) + appendix shorthand', () => {
    const named = inventory.headings.find((h) => h.text === 'Skill Frontmatter');
    expect(named?.numeric_id).toBeNull();
    expect(named?.anchors).toContain('skill-frontmatter');
    const appendix = inventory.headings.find((h) => h.text.startsWith('Appendix A'));
    expect(appendix?.anchors).toContain('appendix-a');
  });

  it('numbered sections are ALSO citable by name (numeric-marker-stripped slug)', () => {
    const skillDef = inventory.headings.find((h) => h.numeric_id === '3');
    expect(skillDef?.anchors).toContain('skill-definition');
    expect(skillDef?.anchors).toContain('3');
  });

  it('records the source sha256 + pinned parser identity for audit', () => {
    expect(inventory.source_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(inventory.parser).toBe('markdown-it@14.1.0');
  });

  it('without --out the inventory JSON goes to stdout (regression: positional arg kept)', () => {
    const { status, stdout } = run(PARSER, [join(fixtureDir, 'spec.md')]);
    expect(status).toBe(0);
    const piped = JSON.parse(stdout) as Inventory;
    expect(piped.headings).toStrictEqual(inventory.headings);
  });

  it('is deterministic — same input parses to byte-identical headings (§ 14.16.1)', () => {
    const out2 = join(fixtureDir, 'headings-2.json');
    const { status } = run(PARSER, [join(fixtureDir, 'spec.md'), '--out', out2]);
    expect(status).toBe(0);
    const second = JSON.parse(readFileSync(out2, 'utf-8')) as Inventory;
    expect(second.headings).toStrictEqual(inventory.headings);
    expect(second.source_sha256).toBe(inventory.source_sha256);
  });
});

describe('check-prose-anchors — live repo (happy path)', () => {
  it('every 6767-h citation in schemas/ resolves against the vendored inventory (exit 0)', () => {
    const { status, stdout, stderr } = run(CHECKER);
    expect(status, stderr).toBe(0);
    expect(stdout).toContain('OK');
  });

  it('the vendored inventory exists and projects the real 6767-h master spec', () => {
    const inventory = JSON.parse(
      readFileSync(join(REPO_ROOT, INVENTORY_REL), 'utf-8'),
    ) as Inventory;
    expect(inventory.source).toBe('6767-h-SPEC-DR-STND-claude-code-extensions-master.md');
    expect(inventory.headings.length).toBeGreaterThan(0);
    // The known live citation (is-overlay $comment cites 6767-h §3.1) must resolve.
    expect(inventory.headings.some((h) => h.numeric_id === '3.1')).toBe(true);
  });
});

describe('check-prose-anchors — detects dangling anchors (not vacuous)', () => {
  let fixtureRoot: string;

  /** Build a repo-shaped fixture tree with an inventory generated from FIXTURE_SPEC. */
  beforeAll(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'prose-anchors-'));
    mkdirSync(join(fixtureRoot, 'schemas/prose-anchors'), { recursive: true });
    const specPath = join(fixtureRoot, 'spec.md');
    writeFileSync(specPath, FIXTURE_SPEC);
    const { status } = run(PARSER, [
      specPath,
      '--out',
      join(fixtureRoot, 'schemas/prose-anchors/6767-h.headings.json'),
    ]);
    expect(status).toBe(0);
  });

  afterAll(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  function writeSchema(name: string, comment: string): void {
    writeFileSync(
      join(fixtureRoot, 'schemas', name),
      `${JSON.stringify({ $comment: comment, type: 'object' }, null, 2)}\n`,
    );
  }

  it('valid numeric + named + appendix + full-filename citations all resolve (exit 0)', () => {
    writeSchema(
      'good.schema.json',
      'Per 6767-h §3.1 (frontmatter) and 6767-h §Skill-Frontmatter; see also ' +
        '6767-h §Appendix-A and 6767-h-SPEC-DR-STND-claude-code-extensions-master.md §1.1.',
    );
    const { status, stdout, stderr } = run(CHECKER, ['--root', fixtureRoot]);
    expect(status, stderr).toBe(0);
    expect(stdout).toContain('4 6767-h citation(s)');
  });

  it('a citation of a nonexistent section fails (exit 1) naming the file + anchor', () => {
    writeSchema('bad.schema.json', 'Cites a renumbered-away section: 6767-h §9.9.');
    const { status, stderr } = run(CHECKER, ['--root', fixtureRoot]);
    expect(status).toBe(1);
    expect(stderr).toContain('schemas/bad.schema.json');
    expect(stderr).toContain('§9.9');
    expect(stderr).toContain('codegen:prose-anchors'); // points at the regeneration path
    rmSync(join(fixtureRoot, 'schemas/bad.schema.json'));
  });

  it('a dangling NAMED anchor is also caught (slug path, nested $comment)', () => {
    writeSchema('bad-named.schema.json', 'See 6767-h §No-Such-Section for details.');
    const { status, stderr } = run(CHECKER, ['--root', fixtureRoot]);
    expect(status).toBe(1);
    expect(stderr).toContain('§No-Such-Section');
    rmSync(join(fixtureRoot, 'schemas/bad-named.schema.json'));
  });

  it('walks NESTED $comment fields (properties deep in the schema body)', () => {
    writeFileSync(
      join(fixtureRoot, 'schemas/nested.schema.json'),
      `${JSON.stringify(
        {
          type: 'object',
          properties: {
            field: { type: 'string', $comment: 'Deep citation of 6767-h §404.404.' },
          },
        },
        null,
        2,
      )}\n`,
    );
    const { status, stderr } = run(CHECKER, ['--root', fixtureRoot]);
    expect(status).toBe(1);
    expect(stderr).toContain('§404.404');
    rmSync(join(fixtureRoot, 'schemas/nested.schema.json'));
  });

  it('a missing inventory is itself a failure (exit 1) with the regeneration command', () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'prose-empty-'));
    mkdirSync(join(emptyRoot, 'schemas'), { recursive: true });
    const { status, stderr } = run(CHECKER, ['--root', emptyRoot]);
    expect(status).toBe(1);
    expect(stderr).toContain('missing inventory');
    rmSync(emptyRoot, { recursive: true, force: true });
  });
});

describe('prose-anchor gate wiring (§ 14.16 — the gate actually runs)', () => {
  interface Pkg {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
  }
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as Pkg;

  it('check:prose-anchors is an npm script and part of the `check` gate chain', () => {
    expect(pkg.scripts['check:prose-anchors']).toContain('check-prose-anchors.ts');
    expect(pkg.scripts['check']).toContain('check:prose-anchors');
  });

  it('markdown-it is pinned EXACT (§ 14.16.1 pinned-parser discipline)', () => {
    const pin = pkg.devDependencies['markdown-it'];
    expect(pin).toBeDefined();
    expect(pin).toMatch(/^\d+\.\d+\.\d+$/); // no ^/~ range — exact
  });

  it('the CI workflow runs the gate on PRs + pushes to main', () => {
    const workflow = readFileSync(
      join(REPO_ROOT, '.github/workflows/prose-anchor-validity.yml'),
      'utf-8',
    );
    expect(workflow).toContain('pnpm run check:prose-anchors');
    expect(workflow).toContain('pull_request');
    expect(workflow).toContain('push');
  });
});
