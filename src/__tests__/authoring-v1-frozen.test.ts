/**
 * authoring/v1 FROZEN guard (DR-049 / v2-fork PR).
 *
 * The v1 authoring family is BYTE-FROZEN at `@intentsolutions/core@0.4.1`: it
 * accepts every artifact it accepted at 0.4.1, forever, and the STRICT v2 fork is
 * the ONLY path for tightenings (copy-then-tighten, zero `$ref` into v1). This
 * test makes the freeze machine-enforced: it git-diffs every byte-frozen v1 path
 * against the `v0.4.1` tag and FAILS on any change.
 *
 * Frozen set (the exact paths the CTO settlement names):
 *   - schemas/authoring/v1/**                                  (every v1 schema)
 *   - src/validators/v1/authoring/skill-frontmatter.ts         (v1 Zod, frozen)
 *   - src/validators/v1/authoring/marketplace-tier.ts          (v1 shared Zod fold)
 *   - src/validators/v1/authoring/{plugin-manifest,agent-definition,mcp-config,
 *     hook-config,marketplace-catalog}.ts                      (codegen-generated
 *     v1 Zod for contracts #2-#6 — same freeze as contract #1) [f-iec-scripts-2]
 *
 * If the `v0.4.1` tag is unavailable (e.g. a shallow clone with no tags), the
 * test SKIPS rather than failing — CI fetches tags, so the guard is live there.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const FREEZE_TAG = 'v0.4.1';

/** Every byte-frozen v1 path (repo-relative). */
const FROZEN_PATHS: readonly string[] = [
  'schemas/authoring/v1/index.json',
  'schemas/authoring/v1/CHANGELOG.md',
  'schemas/authoring/v1/marketplace-tier.schema.json',
  'schemas/authoring/v1/skill-frontmatter.schema.json',
  'schemas/authoring/v1/plugin-manifest.schema.json',
  'schemas/authoring/v1/agent-definition.schema.json',
  'schemas/authoring/v1/mcp-config.schema.json',
  'schemas/authoring/v1/hook-config.schema.json',
  'schemas/authoring/v1/marketplace-catalog.schema.json',
  'schemas/authoring/v1/upstream-base/skill-frontmatter.v1.json',
  'schemas/authoring/v1/is-overlay/skill-frontmatter.v1.json',
  'src/validators/v1/authoring/skill-frontmatter.ts',
  'src/validators/v1/authoring/marketplace-tier.ts',
  'src/validators/v1/authoring/plugin-manifest.ts',
  'src/validators/v1/authoring/agent-definition.ts',
  'src/validators/v1/authoring/mcp-config.ts',
  'src/validators/v1/authoring/hook-config.ts',
  'src/validators/v1/authoring/marketplace-catalog.ts',
];

function git(args: string[]): { ok: boolean; stdout: string } {
  try {
    const stdout = execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
    return { ok: true, stdout };
  } catch {
    return { ok: false, stdout: '' };
  }
}

function tagAvailable(): boolean {
  return git(['rev-parse', '--verify', `${FREEZE_TAG}^{commit}`]).ok;
}

describe('authoring/v1 is BYTE-FROZEN at v0.4.1 (DR-049 v2-fork guard)', () => {
  const haveTag = tagAvailable();

  it.runIf(haveTag).each(FROZEN_PATHS)('frozen path is byte-identical to v0.4.1: %s', (path) => {
    const atTag = git(['show', `${FREEZE_TAG}:${path}`]);
    expect(atTag.ok, `${path} should exist at ${FREEZE_TAG}`).toBe(true);
    const live = readFileSync(join(REPO_ROOT, path), 'utf-8');
    expect(live, `${path} changed since ${FREEZE_TAG} — v1 is frozen`).toBe(atTag.stdout);
  });

  it.skipIf(haveTag)('skips when the v0.4.1 tag is unavailable (shallow clone)', () => {
    expect(haveTag).toBe(false);
  });

  // Completeness guard [f-iec-scripts-2]: every v1 authoring validator source
  // file on disk must be in FROZEN_PATHS, so a newly added (or previously
  // missed) contract validator cannot silently escape the byte-freeze.
  // Excluded by design: index.ts (barrel re-export composition, not validator
  // logic — every validator it re-exports is itself frozen), *.test.ts, and
  // the v2/ subtree (the STRICT fork is the legitimate change path).
  it('every v1 authoring validator source file is in the frozen set (completeness)', () => {
    const dir = join(REPO_ROOT, 'src/validators/v1/authoring');
    const validatorFiles = readdirSync(dir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith('.ts') &&
          !e.name.endsWith('.test.ts') &&
          e.name !== 'index.ts',
      )
      .map((e) => `src/validators/v1/authoring/${e.name}`);
    expect(validatorFiles.length).toBeGreaterThanOrEqual(7);
    for (const file of validatorFiles) {
      expect(FROZEN_PATHS, `${file} must be byte-frozen (DR-049 v1 freeze)`).toContain(file);
    }
  });
});
