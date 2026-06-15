/**
 * skill-frontmatter v2 (STRICT profile) — the fork test (DR-049 / CCP-shadow parity).
 *
 * Proves the STRICT v2 contract that closes the 4 CCP-shadow frontmatter gaps:
 *   - MONOTONIC-ADDITIVE — v2 rejects a strict SUPERSET of what v1 rejects: every
 *     v1-rejected input is also v2-rejected, AND the 4 new v2-only violation
 *     classes (bare Bash, description > 1024, `$(`/backtick in description,
 *     reserved-name substring) are v1-ACCEPTED but v2-REJECTED (proving they are
 *     genuinely new tightenings, not pre-existing v1 rules).
 *   - ajv ↔ Zod fold agreement for v2 on its fixtures (the D8 backstop) — all 4
 *     v2 rules are STRUCTURALLY enforced (no Zod-only carve-out for scoped-Bash).
 *   - correctness: a v2-compliant skill is accepted; each of the 4 violations is
 *     rejected.
 *   - v2 upstream-base equals v1 upstream-base MODULO `$id` (the upstream
 *     projection is identical; only the IS overlay + folds tighten).
 *   - v2 has ZERO `$ref` into the v1 family (copy-then-tighten).
 *   - lifecycle is SHIPPED-INTERNAL (not canonical yet).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SkillFrontmatterV2Schema,
  DeprecationRegistrySchemaV2,
  SecurityChecksSchemaV2,
  DisclosureMarkersSchemaV2,
  UniversalFoldsSchemaV2,
} from '../validators/v1/authoring/v2/index.js';
import {
  makeRequiredFieldsSchema,
  attach,
  deprecationRegistryIssues,
  disclosureMarkersIssues,
} from '../validators/v1/authoring/v2/marketplace-tier.js';
import { SkillFrontmatterSchema as SkillFrontmatterV1Schema } from '../validators/v1/authoring/skill-frontmatter.js';

interface ValidateFn {
  (data: unknown): boolean;
  errors: { instancePath: string; message?: string }[] | null;
}
interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key?: string): void;
  getSchema(ref: string): ValidateFn | undefined;
  addKeyword(def: { keyword: string }): AjvInstance;
}

const Ajv2020 = (Ajv2020Module as unknown as { default: new (opts: object) => AjvInstance })
  .default;
const addFormats = (addFormatsModule as unknown as { default: (ajv: AjvInstance) => void }).default;

const __dirname = dirname(fileURLToPath(import.meta.url));
const V2_DIR = join(__dirname, '../../schemas/authoring/v2');
const V1_DIR = join(__dirname, '../../schemas/authoring/v1');
const V2_FIXTURE_DIR = join(__dirname, '../../tests/authoring/v2/fixtures/skill-frontmatter');
const V1_FIXTURE_DIR = join(__dirname, '../../tests/authoring/v1/fixtures/skill-frontmatter');
const V2_BASE = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v2';
const V2_COMPOSITION_ID = `${V2_BASE}/skill-frontmatter.schema.json`;
const V2_UPSTREAM_BASE_ID = `${V2_BASE}/upstream-base/skill-frontmatter.v1.json`;

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}
function listJson(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.json'));
}
function fixture(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(join(dir, file), 'utf-8'));
}

function makeV2Validator(): ValidateFn {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajv);
  // Benign vendor annotations — register as no-op keywords so strict mode tolerates them.
  ajv.addKeyword({ keyword: 'x-mutually-exclusive-fields' });
  ajv.addKeyword({ keyword: 'x-scoped-tool' });
  ajv.addSchema(loadJson(join(V2_DIR, 'marketplace-tier.schema.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'upstream-base/skill-frontmatter.v1.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'is-overlay/skill-frontmatter.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'skill-frontmatter.schema.json')));
  return ajv.getSchema(V2_COMPOSITION_ID)!;
}

let validateV2: ValidateFn;

beforeAll(() => {
  validateV2 = makeV2Validator();
});

const V2_VALID = {
  name: 'my-skill',
  description: 'A valid description.',
  'allowed-tools': ['Read', 'Bash(git:*)'],
  version: '1.0.0',
  author: 'Jeremy Longshore',
  license: 'Apache-2.0',
  compatibility: 'claude-code',
  tags: ['x'],
};

/** The 4 v2-only violation classes (each is v1-ACCEPTED but v2-REJECTED). */
const V2_ONLY_VIOLATIONS: readonly [string, Record<string, unknown>][] = [
  ['bare unscoped Bash (array)', { 'allowed-tools': ['Read', 'Bash'] }],
  ['bare unscoped Bash (string)', { 'allowed-tools': 'Read, Bash' }],
  ['description over the 1024 cap', { description: 'x'.repeat(1025) }],
  ['shell substitution `$(` in description', { description: 'Run $(whoami) now.' }],
  ['shell substitution backtick in description', { description: 'Run `whoami` now.' }],
  ['reserved-name substring claude', { name: 'claude-reflect' }],
  ['reserved-name substring anthropic', { name: 'my-anthropic-tool' }],
];

describe('skill-frontmatter v2 — composition is pure (zero authored fields, zero v1 $ref)', () => {
  it('the published v2 schema is exactly an allOf of the three v2 layers', () => {
    const s = loadJson(join(V2_DIR, 'skill-frontmatter.schema.json'));
    expect(s['$id']).toBe(V2_COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(V2_UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(`${V2_BASE}/marketplace-tier.schema.json#/$defs/universalFolds`);
    expect(allOf[2]?.$ref).toBe(`${V2_BASE}/is-overlay/skill-frontmatter.v2.json`);
  });

  it('NO v2 schema file contains a $ref into the v1 family (copy-then-tighten)', () => {
    for (const file of [
      'skill-frontmatter.schema.json',
      'marketplace-tier.schema.json',
      'upstream-base/skill-frontmatter.v1.json',
      'is-overlay/skill-frontmatter.v2.json',
      'index.json',
    ]) {
      const raw = readFileSync(join(V2_DIR, file), 'utf-8');
      expect(raw, `${file} must not reference authoring/v1`).not.toContain('/authoring/v1/');
    }
  });

  it('is registered in v2 index.json as SHIPPED-INTERNAL (not canonical yet)', () => {
    const idx = loadJson(join(V2_DIR, 'index.json'));
    const entry = (idx['schemas'] as Record<string, { kind: string; lifecycle: string }>)[
      'skill-frontmatter'
    ];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });

  it('never references labs.intentsolutions.io (CISO binding DR-004 + DR-010)', () => {
    for (const file of ['skill-frontmatter.schema.json', 'marketplace-tier.schema.json']) {
      expect(JSON.stringify(loadJson(join(V2_DIR, file)))).not.toContain('labs.intentsolutions.io');
    }
  });
});

describe('skill-frontmatter v2 — v2 base == v1 base modulo $id', () => {
  it('the v2 upstream-base equals the v1 upstream-base except for the $id /v1/ → /v2/ rewrite', () => {
    const v1 = loadJson(join(V1_DIR, 'upstream-base/skill-frontmatter.v1.json'));
    const v2 = loadJson(join(V2_DIR, 'upstream-base/skill-frontmatter.v1.json'));
    const normalize = (o: Record<string, unknown>): Record<string, unknown> => ({
      ...o,
      $id: '<normalized>',
    });
    expect(normalize(v2)).toEqual(normalize(v1));
    expect(v2['$id']).toContain('/authoring/v2/');
    expect(v1['$id']).toContain('/authoring/v1/');
  });
});

describe('skill-frontmatter v2 — accepts v2-compliant skills', () => {
  it('accepts every v2 positive fixture (ajv + Zod agree)', () => {
    for (const file of listJson(join(V2_FIXTURE_DIR, 'positive'))) {
      const obj = fixture(join(V2_FIXTURE_DIR, 'positive'), file);
      expect(validateV2(obj), `positive/${file} (ajv) should accept`).toBe(true);
      expect(
        SkillFrontmatterV2Schema.safeParse(obj).success,
        `positive/${file} (Zod) should accept`,
      ).toBe(true);
    }
  });

  it('accepts the canonical v2-valid artifact', () => {
    expect(validateV2(V2_VALID)).toBe(true);
    expect(SkillFrontmatterV2Schema.safeParse(V2_VALID).success).toBe(true);
  });
});

describe('skill-frontmatter v2 — rejects every negative fixture (ajv + Zod agree)', () => {
  it('rejects every v2 negative fixture', () => {
    for (const file of listJson(join(V2_FIXTURE_DIR, 'negative'))) {
      const obj = fixture(join(V2_FIXTURE_DIR, 'negative'), file);
      expect(validateV2(obj), `negative/${file} (ajv) should reject`).toBe(false);
      expect(
        SkillFrontmatterV2Schema.safeParse(obj).success,
        `negative/${file} (Zod) should reject`,
      ).toBe(false);
    }
  });
});

describe('skill-frontmatter v2 — ajv ↔ Zod fold agreement (D8 backstop)', () => {
  it('ajv and Zod return the same verdict on all v2 fixtures', () => {
    for (const cls of ['positive', 'negative'] as const) {
      for (const file of listJson(join(V2_FIXTURE_DIR, cls))) {
        const obj = fixture(join(V2_FIXTURE_DIR, cls), file);
        const ajvVerdict = validateV2(obj);
        const zodVerdict = SkillFrontmatterV2Schema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });

  it.each([
    // scoped-Bash: bare reject, scoped accept, Bashful accept (token-boundary)
    ['scoped Bash array accepted', { 'allowed-tools': ['Read', 'Bash(git:*)'] }, true],
    ['scoped Bash string accepted', { 'allowed-tools': 'Read, Bash(npm:*)' }, true],
    ['bare Bash array rejected', { 'allowed-tools': ['Read', 'Bash'] }, false],
    ['bare Bash string rejected', { 'allowed-tools': 'Read, Bash' }, false],
    ['sole bare Bash rejected', { 'allowed-tools': 'Bash' }, false],
    ['Bashful is not bare Bash', { 'allowed-tools': 'Read, Bashful' }, true],
    ['empty array allowed-tools accepted', { 'allowed-tools': [] as unknown }, true],
    ['empty string allowed-tools accepted', { 'allowed-tools': '' }, true],
    // shell substitution widen
    ['$( in description rejected', { description: 'Run $(whoami).' }, false],
    ['backtick in description rejected', { description: 'Run `whoami`.' }, false],
    ['${ in description rejected (carried v1)', { description: 'Use ${VAR}.' }, false],
    // description cap 1024
    ['description 1024 accepted', { description: 'x'.repeat(1024) }, true],
    ['description 1025 rejected', { description: 'x'.repeat(1025) }, false],
    // reserved-name substring
    ['claude substring name rejected', { name: 'claude-reflect' }, false],
    ['anthropic substring name rejected', { name: 'my-anthropic-x' }, false],
    ['mcp not substring-hardened (accepted)', { name: 'mcp-helper' }, true],
    ['exact reserved skill rejected (carried v1)', { name: 'skill' }, false],
    // carried v1 checks
    ['non-semver version rejected', { version: '1.2' }, false],
    ['non-array tags rejected', { tags: 'a' }, false],
    ['over-length compatibility rejected', { compatibility: 'x'.repeat(501) }, false],
    ['over-long name rejected', { name: 'a'.repeat(65) }, false],
  ])('agree on: %s', (_label, patch, expected) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateV2(artifact)).toBe(expected);
    expect(SkillFrontmatterV2Schema.safeParse(artifact).success).toBe(expected);
  });
});

describe('skill-frontmatter v2 — MONOTONIC-ADDITIVE over frozen v1', () => {
  it('every v1 NEGATIVE fixture is also rejected by v2 (v2 ⊇ v1 rejections)', () => {
    for (const file of listJson(join(V1_FIXTURE_DIR, 'negative'))) {
      const obj = fixture(join(V1_FIXTURE_DIR, 'negative'), file);
      // v1 rejects it (the v1 Zod is the reference for v1's reject set)
      expect(SkillFrontmatterV1Schema.safeParse(obj).success, `v1 should reject ${file}`).toBe(
        false,
      );
      // v2 must ALSO reject it (monotonic-additive)
      expect(validateV2(obj), `v2 must also reject v1-negative ${file}`).toBe(false);
      expect(
        SkillFrontmatterV2Schema.safeParse(obj).success,
        `v2 Zod must also reject v1-negative ${file}`,
      ).toBe(false);
    }
  });

  it('every v1 POSITIVE/EDGE fixture that v2 still accepts proves v2 is a NARROWING, not a re-floor', () => {
    // v2 accepts a v1-positive UNLESS it trips one of the 4 new rules. The v1
    // corpus authors clean scoped tools + short clean descriptions + clean names,
    // so they remain accepted under v2 — the narrowing only bites the 4 new cases.
    let accepted = 0;
    for (const cls of ['positive', 'edge'] as const) {
      for (const file of listJson(join(V1_FIXTURE_DIR, cls))) {
        const obj = fixture(join(V1_FIXTURE_DIR, cls), file);
        expect(SkillFrontmatterV1Schema.safeParse(obj).success, `v1 accepts ${cls}/${file}`).toBe(
          true,
        );
        if (validateV2(obj)) {
          accepted += 1;
          // any v1-positive that v2 still accepts must agree across ajv/Zod
          expect(SkillFrontmatterV2Schema.safeParse(obj).success).toBe(true);
        }
      }
    }
    // At least the bulk of the clean v1 corpus survives v2 (sanity that v2 is not
    // rejecting everything — it is a narrowing of exactly 4 rules).
    expect(accepted).toBeGreaterThan(0);
  });

  it('the 4 new v2 violation classes are v1-ACCEPTED but v2-REJECTED (genuinely new tightenings)', () => {
    for (const [label, patch] of V2_ONLY_VIOLATIONS) {
      const artifact = { ...V2_VALID, ...patch };
      expect(SkillFrontmatterV1Schema.safeParse(artifact).success, `v1 accepts: ${label}`).toBe(
        true,
      );
      expect(validateV2(artifact), `v2 rejects (ajv): ${label}`).toBe(false);
      expect(
        SkillFrontmatterV2Schema.safeParse(artifact).success,
        `v2 rejects (Zod): ${label}`,
      ).toBe(false);
    }
  });

  it('the v2 required floor is unchanged from v1 (NARROW, not a re-floor)', () => {
    const v1Overlay = loadJson(join(V1_DIR, 'is-overlay/skill-frontmatter.v1.json'));
    const v2Overlay = loadJson(join(V2_DIR, 'is-overlay/skill-frontmatter.v2.json'));
    expect((v2Overlay['required'] as string[]).sort()).toEqual(
      (v1Overlay['required'] as string[]).sort(),
    );
  });
});

describe('skill-frontmatter v2 — Zod surface completeness (ajv ↔ Zod agree on every branch)', () => {
  // Exercise the full v2 Zod validator surface (base type errors, overlay type
  // errors, the optional IS extras, and the carried universal folds) against ajv,
  // so the generated v2 validator's every branch is reachable + agreeing.
  it.each([
    // base-layer type errors
    ['non-string name', { name: 42 }, false],
    ['non-string description', { description: 42 }, false],
    ['non-string license', { license: 1 }, false],
    ['non-string compatibility', { compatibility: 7 }, false],
    ['non-object metadata', { metadata: ['not', 'an', 'object'] }, false],
    ['valid object metadata', { metadata: { 'intent-solutions': { x: '1' } } }, true],
    // overlay-layer type errors
    ['non-string author', { author: 5 }, false],
    ['non-string version (number)', { version: 1 }, false],
    ['non-array tags (string)', { tags: 'a' }, false],
    ['prerelease semver accepted', { version: '1.2.3-beta.1' }, true],
    // allowed-tools malformed (not string/array)
    ['number allowed-tools rejected', { 'allowed-tools': 42 }, false],
    ['null allowed-tools rejected', { 'allowed-tools': null }, false],
    [
      'array-with-non-string allowed-tools rejected',
      { 'allowed-tools': ['Read', 7] as unknown },
      false,
    ],
    // optional IS extras — valid + error branches (exercise requiredEnvVarIssues + visibility loop)
    ['valid requires_env', { requires_env: ['API_KEY'] }, true],
    ['non-string requires_env element rejected', { requires_env: [1] as unknown }, false],
    [
      'valid required_environment_variables',
      { required_environment_variables: [{ name: 'API_KEY', prompt: 'Your key' }] },
      true,
    ],
    [
      'lowercase env-var name rejected',
      { required_environment_variables: [{ name: 'api_key', prompt: 'x' }] },
      false,
    ],
    [
      'env-var missing prompt rejected',
      { required_environment_variables: [{ name: 'API_KEY' }] },
      false,
    ],
    [
      'non-array required_environment_variables rejected',
      { required_environment_variables: 'nope' },
      false,
    ],
    [
      'non-object env-var entry rejected',
      { required_environment_variables: [42] as unknown },
      false,
    ],
    // carried universal folds
    ['deprecated compatible-with rejected', { 'compatible-with': 'x' }, false],
    ['deprecated when_to_use rejected', { when_to_use: 'x' }, false],
    ['XML in name rejected (carried)', { name: 'a<b' }, false],
    ['XML in description rejected (carried)', { description: 'has <tag>' }, false],
  ])('agree on branch: %s', (_label, patch, expected) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateV2(artifact), `ajv: ${_label}`).toBe(expected);
    expect(SkillFrontmatterV2Schema.safeParse(artifact).success, `zod: ${_label}`).toBe(expected);
  });

  it('the mutual-exclusion carve-out fires (requires_env ∩ fallback_for_env, Zod-only — kyh9)', () => {
    const artifact = {
      ...V2_VALID,
      requires_env: ['API_KEY', 'SHARED'],
      fallback_for_env: ['SHARED'],
    };
    // Zod enforces the per-variable disjointness (the documented carve-out).
    expect(SkillFrontmatterV2Schema.safeParse(artifact).success).toBe(false);
    // ajv does NOT (it is not JSON-Schema-expressible) — the carve-out asymmetry,
    // identical to v1; the type-only validity holds for ajv.
    expect(validateV2(artifact)).toBe(true);
  });
});

describe('skill-frontmatter v2 — non-empty (minLength 1) fold-agreement (ajv ↔ Zod)', () => {
  // The STRICT v2 schemas enforce minLength:1 on `description` (upstream-base) and
  // `author`/`license`/`compatibility` (is-overlay). Before the v2 Zod mirrored
  // those floors, ajv REJECTED an empty string on each field while the generated
  // Zod ACCEPTED it — an ajv ↔ Zod fold-agreement gap (the D8 backstop). These
  // cases pin the agreement: BOTH validators must reject an empty string on each
  // of the four floored fields. (They FAIL on the pre-fix v2 Zod, PASS on the
  // fixed one.) The frozen v1 family deliberately does NOT carry this floor — see
  // authoring-v1-frozen.test.ts; tightening v1 is forbidden.
  it.each([
    ['empty description', { description: '' }],
    ['empty author', { author: '' }],
    ['empty license', { license: '' }],
    ['empty compatibility', { compatibility: '' }],
  ])('both ajv and v2 Zod reject %s', (_label, patch) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateV2(artifact), `ajv must reject ${_label}`).toBe(false);
    expect(
      SkillFrontmatterV2Schema.safeParse(artifact).success,
      `v2 Zod must reject ${_label}`,
    ).toBe(false);
  });

  it('a single-character value on each floored field is accepted (floor is exactly minLength 1)', () => {
    // Sanity that the floor is non-empty (>= 1), not an over-tightening (>= 2).
    for (const field of ['description', 'author', 'license', 'compatibility'] as const) {
      const artifact = { ...V2_VALID, [field]: 'x' };
      expect(validateV2(artifact), `ajv accepts 1-char ${field}`).toBe(true);
      expect(
        SkillFrontmatterV2Schema.safeParse(artifact).success,
        `v2 Zod accepts 1-char ${field}`,
      ).toBe(true);
    }
  });

  it('the empty-string floor is a v2-only tightening (v1 ACCEPTS, v2 REJECTS)', () => {
    // Proves these are genuinely NEW v2 tightenings (the frozen v1 contract accepts
    // an empty string on each field — its hand-authored Zod never floored them),
    // not pre-existing rules. Mirrors the V2_ONLY_VIOLATIONS monotonic-additive
    // proof for the four floored fields.
    for (const field of ['description', 'author', 'license', 'compatibility'] as const) {
      const artifact = { ...V2_VALID, [field]: '' };
      expect(
        SkillFrontmatterV1Schema.safeParse(artifact).success,
        `v1 accepts empty ${field}`,
      ).toBe(true);
      expect(validateV2(artifact), `v2 ajv rejects empty ${field}`).toBe(false);
      expect(
        SkillFrontmatterV2Schema.safeParse(artifact).success,
        `v2 Zod rejects empty ${field}`,
      ).toBe(false);
    }
  });
});

describe('skill-frontmatter v2 — fold-schema + helper exports', () => {
  it('the exported v2 fold schemas each accept a clean artifact and reject their own violation', () => {
    const clean = { name: 'ok-skill', description: 'A clean description.' };
    expect(DeprecationRegistrySchemaV2.safeParse(clean).success).toBe(true);
    expect(DeprecationRegistrySchemaV2.safeParse({ 'compatible-with': 'x' }).success).toBe(false);
    expect(SecurityChecksSchemaV2.safeParse(clean).success).toBe(true);
    // v2-only substring reserved name trips the v2 securityChecks fold
    expect(SecurityChecksSchemaV2.safeParse({ name: 'claude-reflect' }).success).toBe(false);
    // v2-only widened shell-substitution trips the fold
    expect(SecurityChecksSchemaV2.safeParse({ description: 'run $(x)' }).success).toBe(false);
    expect(DisclosureMarkersSchemaV2.safeParse(clean).success).toBe(true);
    // v2 cap is 1024
    expect(DisclosureMarkersSchemaV2.safeParse({ description: 'x'.repeat(1025) }).success).toBe(
      false,
    );
    expect(DisclosureMarkersSchemaV2.safeParse({ description: 'x'.repeat(1024) }).success).toBe(
      true,
    );
    expect(UniversalFoldsSchemaV2.safeParse(clean).success).toBe(true);
    expect(UniversalFoldsSchemaV2.safeParse({ description: 'x'.repeat(1025) }).success).toBe(false);
  });

  it('makeRequiredFieldsSchema + attach build a working required-fields validator', () => {
    const schema = makeRequiredFieldsSchema(['name', 'description']);
    expect(schema.safeParse({ name: 'x', description: 'y' }).success).toBe(true);
    expect(schema.safeParse({ name: 'x' }).success).toBe(false);
    // attach wraps a pure checker into a Zod refinement
    const custom = attach((a) => ('flag' in a ? [] : [{ message: 'no flag', path: ['flag'] }]));
    expect(custom.safeParse({ flag: true }).success).toBe(true);
    expect(custom.safeParse({}).success).toBe(false);
  });

  it('the pure fold checkers are non-string-safe (no false positives on non-string values)', () => {
    // deprecationRegistryIssues returns no issues for a clean artifact
    expect(deprecationRegistryIssues({ name: 'x' })).toEqual([]);
    // disclosureMarkersIssues ignores a non-string description (type is the base's job)
    expect(disclosureMarkersIssues({ description: 123 })).toEqual([]);
    expect(disclosureMarkersIssues({ description: 'x'.repeat(1025) }).length).toBe(1);
  });
});
