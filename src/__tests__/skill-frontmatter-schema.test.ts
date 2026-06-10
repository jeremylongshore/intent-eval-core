/**
 * skill-frontmatter contract #1 — the walking-skeleton test (DR-044 D7).
 *
 * Proves the three-artifact base+overlay composition:
 *   - the published schema is a PURE allOf of [upstream-base, universalFolds, is-overlay]
 *   - the JSON Schema (ajv) and the hand-authored Zod mirror AGREE fold-for-fold
 *     (the D8 fold-agreement backstop that grandfathers contract #1)
 *   - correctness against the 40-fixture corpus (22 valid accepted; 18 negative rejected)
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on the
 *     upstream base — the 2026-04-28-debacle guard (required fields never silently demoted)
 *   - the effective-required manifest = base ∪ overlay = the IS 8-field set
 *   - registered in index.json + exported from the validators barrel
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SkillFrontmatterSchema,
  SKILL_FRONTMATTER_BASE_REQUIRED,
  SKILL_FRONTMATTER_OVERLAY_REQUIRED,
  SKILL_FRONTMATTER_REQUIRED_FIELDS,
} from '../validators/v1/authoring/skill-frontmatter.js';

interface ValidateFn {
  (data: unknown): boolean;
  errors: { instancePath: string; message?: string }[] | null;
}
interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key?: string): void;
  getSchema(ref: string): ValidateFn | undefined;
}

const Ajv2020 = (Ajv2020Module as unknown as { default: new (opts: object) => AjvInstance })
  .default;
const addFormats = (addFormatsModule as unknown as { default: (ajv: AjvInstance) => void }).default;

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTHORING_DIR = join(__dirname, '../../schemas/authoring/v1');
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v1/fixtures/skill-frontmatter');
const BASE = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${BASE}/skill-frontmatter.schema.json`;
const UPSTREAM_BASE_ID = `${BASE}/upstream-base/skill-frontmatter.v1.json`;

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}
function listJson(cls: string): string[] {
  return readdirSync(join(FIXTURE_DIR, cls)).filter((f) => f.endsWith('.json'));
}
function fixture(cls: string, file: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, cls, file), 'utf-8'));
}

let validateComposition: ValidateFn;
let validateBase: ValidateFn;

beforeAll(() => {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajv);
  // Register every layer so the composition's $refs resolve.
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'upstream-base/skill-frontmatter.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'is-overlay/skill-frontmatter.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'skill-frontmatter.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
});

describe('skill-frontmatter — composition is pure (zero authored fields)', () => {
  it('the published schema is exactly an allOf of the three layers', () => {
    const s = loadJson(join(AUTHORING_DIR, 'skill-frontmatter.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(`${BASE}/marketplace-tier.schema.json#/$defs/universalFolds`);
    expect(allOf[2]?.$ref).toBe(`${BASE}/is-overlay/skill-frontmatter.v1.json`);
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(AUTHORING_DIR, 'skill-frontmatter.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in index.json as contract #1', () => {
    const idx = loadJson(join(AUTHORING_DIR, 'index.json'));
    const entry = (idx['schemas'] as Record<string, { kind: string; contractIndex: number }>)[
      'skill-frontmatter'
    ];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(1);
  });
});

describe('skill-frontmatter — correctness against the 40-fixture corpus', () => {
  it('accepts every valid skill (22/22 — 0 false-rejects)', () => {
    for (const cls of ['positive', 'edge'] as const) {
      for (const file of listJson(cls)) {
        expect(validateComposition(fixture(cls, file)), `${cls}/${file} should be accepted`).toBe(
          true,
        );
      }
    }
  });

  it('rejects every negative (18/18 — 0 false-accepts; per-contract closes the deferred gap)', () => {
    for (const file of listJson('negative')) {
      expect(validateComposition(fixture('negative', file)), `negative/${file} should reject`).toBe(
        false,
      );
    }
  });
});

describe('skill-frontmatter — ajv ↔ Zod fold agreement (D8 backstop)', () => {
  it('the JSON Schema and the Zod mirror return the same verdict on all 40 fixtures', () => {
    for (const cls of ['positive', 'negative', 'edge'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = SkillFrontmatterSchema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });

  it.each([
    ['empty allowed-tools array is accepted', { 'allowed-tools': [] as unknown }, true],
    ['string allowed-tools is rejected', { 'allowed-tools': 'Read' }, false],
    ['non-semver version is rejected', { version: '1.2' }, false],
    ['prerelease semver is accepted', { version: '1.2.3-beta.1' }, true],
    ['non-array tags is rejected', { tags: 'a' }, false],
    ['valid requires_env is accepted', { requires_env: ['API_KEY'] }, true],
    ['non-string requires_env element is rejected', { requires_env: [1] as unknown }, false],
    [
      'valid required_environment_variables is accepted',
      {
        required_environment_variables: [{ name: 'API_KEY', prompt: 'Your key' }],
      },
      true,
    ],
    [
      'lowercase env-var name is rejected',
      {
        required_environment_variables: [{ name: 'api_key', prompt: 'x' }],
      },
      false,
    ],
    [
      'env-var missing prompt is rejected',
      {
        required_environment_variables: [{ name: 'API_KEY' }],
      },
      false,
    ],
    [
      'non-array required_environment_variables is rejected',
      {
        required_environment_variables: 'nope',
      },
      false,
    ],
    [
      'non-object env-var entry is rejected',
      {
        required_environment_variables: [42] as unknown,
      },
      false,
    ],
    ['non-string description is rejected', { description: 42 }, false],
    ['non-string license is rejected', { license: 1 }, false],
    ['non-string author is rejected', { author: 5 }, false],
  ])('agree on extras: %s', (_label, patch, expected) => {
    const base = {
      name: 'my-skill',
      description: 'A valid description.',
      'allowed-tools': ['Read'],
      version: '1.0.0',
      author: 'Jeremy Longshore',
      license: 'Apache-2.0',
      compatibility: 'claude-code',
      tags: ['x'],
    };
    const artifact = { ...base, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact)).toBe(expected);
    expect(SkillFrontmatterSchema.safeParse(artifact).success).toBe(expected);
  });

  it('agrees on a non-object metadata (base type check)', () => {
    const bad = {
      name: 'my-skill',
      description: 'A valid description.',
      'allowed-tools': ['Read'],
      version: '1.0.0',
      author: 'Jeremy Longshore',
      license: 'Apache-2.0',
      compatibility: 'claude-code',
      tags: ['x'],
      metadata: ['not', 'an', 'object'],
    };
    expect(validateComposition(bad)).toBe(false);
    expect(SkillFrontmatterSchema.safeParse(bad).success).toBe(false);
  });

  it('agrees on an over-length compatibility (base 500-char cap)', () => {
    const bad = {
      name: 'my-skill',
      description: 'A valid description.',
      'allowed-tools': ['Read'],
      version: '1.0.0',
      author: 'Jeremy Longshore',
      license: 'Apache-2.0',
      compatibility: 'x'.repeat(501),
      tags: ['x'],
    };
    expect(validateComposition(bad)).toBe(false);
    expect(SkillFrontmatterSchema.safeParse(bad).success).toBe(false);
  });

  it('agrees on an over-long name (base 64-char cap)', () => {
    const bad = {
      name: 'a'.repeat(65),
      description: 'A valid description.',
      'allowed-tools': ['Read'],
      version: '1.0.0',
      author: 'Jeremy Longshore',
      license: 'Apache-2.0',
      compatibility: 'claude-code',
      tags: ['x'],
    };
    expect(validateComposition(bad)).toBe(false);
    expect(SkillFrontmatterSchema.safeParse(bad).success).toBe(false);
  });
});

describe('skill-frontmatter — monotonicity (overlay strictly additive/narrowing on base)', () => {
  it('base required is exactly the agentskills.io standardFloor [name, description]', () => {
    expect([...SKILL_FRONTMATTER_BASE_REQUIRED]).toEqual(['name', 'description']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(AUTHORING_DIR, 'upstream-base/skill-frontmatter.v1.json'));
    const overlay = loadJson(join(AUTHORING_DIR, 'is-overlay/skill-frontmatter.v1.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['name', 'description']);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of SKILL_FRONTMATTER_BASE_REQUIRED) {
      expect(SKILL_FRONTMATTER_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field set', () => {
    expect([...SKILL_FRONTMATTER_REQUIRED_FIELDS].sort()).toEqual(
      [
        'allowed-tools',
        'author',
        'compatibility',
        'description',
        'license',
        'name',
        'tags',
        'version',
      ].sort(),
    );
    expect([...SKILL_FRONTMATTER_OVERLAY_REQUIRED].sort()).toEqual(
      ['allowed-tools', 'author', 'compatibility', 'license', 'tags', 'version'].sort(),
    );
  });

  it('refinement: every artifact valid under the composition is valid under the base alone', () => {
    for (const cls of ['positive', 'edge'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        expect(validateComposition(obj)).toBe(true);
        expect(validateBase(obj), `${cls}/${file} must satisfy the base`).toBe(true);
      }
    }
  });

  it('strict narrowing: a base-valid minimal artifact is composition-INVALID (overlay genuinely narrows)', () => {
    const minimal = { name: 'my-skill', description: 'A valid description.' };
    expect(validateBase(minimal)).toBe(true);
    expect(validateComposition(minimal)).toBe(false);
  });

  it('debacle guard: dropping a base-required field invalidates the composition (never demoted to optional)', () => {
    const full = {
      name: 'my-skill',
      description: 'A valid description.',
      'allowed-tools': ['Read'],
      version: '1.0.0',
      author: 'Jeremy Longshore',
      license: 'Apache-2.0',
      compatibility: 'claude-code',
      tags: ['x'],
    };
    for (const field of SKILL_FRONTMATTER_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...full };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate`).toBe(false);
    }
  });
});
