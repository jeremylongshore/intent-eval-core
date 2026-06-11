/**
 * marketplace-catalog contract #6 — codegen-generated (DR-044 D8).
 *
 * Mirrors the contract-#1/#2 walking-skeleton tests, proving the three-artifact
 * base+overlay composition for marketplace-catalog (the `.claude-plugin/marketplace.json`
 * catalog shape):
 *   - the published schema is a PURE allOf of [upstream-base, universalFolds, is-overlay]
 *   - the JSON Schema (ajv) and the codegen-generated Zod mirror AGREE fold-for-fold
 *   - correctness against the 40-fixture corpus
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on the base
 *   - the effective-required manifest = base ∪ overlay = the IS 8-field catalog set
 *   - registered in index.json as contract #6 + exported from the validators barrel
 *
 * Upstream authority: code.claude.com/docs/en/plugin-marketplaces § "Required
 * fields" / "Owner fields" / "Plugin entries" + anthropics/claude-plugins-official.
 * The base requires [name, owner, plugins] (owner is an object with a required inner
 * `name`; each plugin entry requires [name, source]); the IS overlay promotes five
 * fields to required (version, description, license, homepage, keywords).
 *
 * CORPUS NOTE — `edge/ambiguity-01-empty-array-field.json` carries `plugins: []`,
 * which this contract REJECTS: the upstream documents plugins as "List of available
 * plugins" and the `negative/constraint-plugins-empty` fixture marks empty-plugins
 * as a constraint violation, so minItems:1 is the faithful projection. That one
 * template-generated edge fixture (which assumes empty arrays are always benign) is
 * therefore the single edge fixture the contract does not accept; it is asserted
 * explicitly below rather than swept into the accept-all-edge loop.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MarketplaceCatalogSchema,
  MARKETPLACE_CATALOG_BASE_REQUIRED,
  MARKETPLACE_CATALOG_OVERLAY_REQUIRED,
  MARKETPLACE_CATALOG_REQUIRED_FIELDS,
} from '../validators/v1/authoring/marketplace-catalog.js';

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
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v1/fixtures/marketplace-catalog');
const BASE = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${BASE}/marketplace-catalog.schema.json`;
const UPSTREAM_BASE_ID = `${BASE}/upstream-base/marketplace-catalog.v1.json`;

/** The single edge fixture this contract rejects (empty plugins — see header note). */
const REJECTING_EDGE = 'ambiguity-01-empty-array-field.json';

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
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'upstream-base/marketplace-catalog.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'is-overlay/marketplace-catalog.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'marketplace-catalog.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
});

describe('marketplace-catalog — composition is pure (zero authored fields)', () => {
  it('the published schema is exactly an allOf of the three layers', () => {
    const s = loadJson(join(AUTHORING_DIR, 'marketplace-catalog.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(`${BASE}/marketplace-tier.schema.json#/$defs/universalFolds`);
    expect(allOf[2]?.$ref).toBe(`${BASE}/is-overlay/marketplace-catalog.v1.json`);
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(AUTHORING_DIR, 'marketplace-catalog.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in index.json as contract #6 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(AUTHORING_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['marketplace-catalog'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(6);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });
});

describe('marketplace-catalog — correctness against the 40-fixture corpus', () => {
  it('accepts every valid catalog (21/22 — empty-plugins edge is the lone reject)', () => {
    for (const cls of ['positive', 'edge'] as const) {
      for (const file of listJson(cls)) {
        const expected = !(cls === 'edge' && file === REJECTING_EDGE);
        expect(validateComposition(fixture(cls, file)), `${cls}/${file}`).toBe(expected);
      }
    }
  });

  it('rejects the empty-plugins edge fixture (minItems:1 — a catalog with zero plugins is invalid)', () => {
    expect(validateComposition(fixture('edge', REJECTING_EDGE))).toBe(false);
  });

  it('rejects every negative (18/18 — 0 false-accepts)', () => {
    for (const file of listJson('negative')) {
      expect(validateComposition(fixture('negative', file)), `negative/${file} should reject`).toBe(
        false,
      );
    }
  });
});

describe('marketplace-catalog — ajv ↔ Zod fold agreement (D8 backstop)', () => {
  it('the JSON Schema and the Zod mirror return the same verdict on all 40 fixtures', () => {
    for (const cls of ['positive', 'negative', 'edge'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = MarketplaceCatalogSchema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });

  const valid = {
    name: 'example-marketplace',
    owner: { name: 'Jeremy Longshore' },
    plugins: [{ name: 'plugin-1', source: './plugins/plugin-1' }],
    version: '1.0.0',
    description: 'A valid marketplace catalog.',
    license: 'Apache-2.0',
    homepage: 'https://github.com/jeremylongshore/marketplace',
    keywords: ['marketplace', 'kw'],
  };

  it.each([
    ['non-string name is rejected', { name: 0 }, false],
    ['empty name is rejected', { name: '' }, false],
    ['uppercase name is rejected', { name: 'Example-Marketplace' }, false],
    ['over-long name is rejected (base 64-char cap)', { name: 'a'.repeat(65) }, false],
    ['owner as a bare string is rejected (upstream is an object)', { owner: 'Jeremy' }, false],
    ['owner object missing inner name is rejected', { owner: {} }, false],
    ['owner object with only name is accepted', { owner: { name: 'Jeremy' } }, true],
    ['owner with name + email is accepted', { owner: { name: 'J', email: 'j@x.io' } }, true],
    ['string plugins is rejected', { plugins: 'nope' }, false],
    ['empty plugins array is rejected (minItems 1)', { plugins: [] as unknown }, false],
    ['a non-object plugin entry is rejected', { plugins: ['nope'] as unknown }, false],
    ['a plugin entry missing source is rejected', { plugins: [{ name: 'p' }] as unknown }, false],
    ['a plugin entry missing name is rejected', { plugins: [{ source: './p' }] as unknown }, false],
    [
      'multiple valid plugin entries are accepted',
      {
        plugins: [
          { name: 'a', source: './a' },
          { name: 'b', source: './b' },
        ] as unknown,
      },
      true,
    ],
    ['non-semver version is rejected', { version: '1.0' }, false],
    ['non-string version is rejected', { version: 1 }, false],
    ['prerelease semver version is accepted', { version: '1.0.0-beta.1' }, true],
    ['non-string description is rejected', { description: 42 }, false],
    ['non-string license is rejected', { license: 1 }, false],
    ['homepage that is not a URI is rejected', { homepage: 'not-a-url' }, false],
    ['non-string homepage is rejected', { homepage: 42 }, false],
    ['string keywords is rejected', { keywords: 'kw' }, false],
    ['empty keywords array is accepted', { keywords: [] as unknown }, true],
    ['optional metadata object is accepted', { metadata: { 'intent-solutions': {} } }, true],
    ['metadata as a non-object is rejected', { metadata: ['nope'] as unknown }, false],
  ])('agree on extras: %s', (_label, patch, expected) => {
    const artifact = { ...valid, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact)).toBe(expected);
    expect(MarketplaceCatalogSchema.safeParse(artifact).success).toBe(expected);
  });

  it('agrees on an over-budget description (universal disclosureMarkers fold, 1536)', () => {
    const bad = { ...valid, description: 'x'.repeat(1537) };
    expect(validateComposition(bad)).toBe(false);
    expect(MarketplaceCatalogSchema.safeParse(bad).success).toBe(false);
  });
});

describe('marketplace-catalog — monotonicity (overlay strictly additive/narrowing on base)', () => {
  it('base required is exactly the upstream standardFloor [name, owner, plugins]', () => {
    expect([...MARKETPLACE_CATALOG_BASE_REQUIRED]).toEqual(['name', 'owner', 'plugins']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(AUTHORING_DIR, 'upstream-base/marketplace-catalog.v1.json'));
    const overlay = loadJson(join(AUTHORING_DIR, 'is-overlay/marketplace-catalog.v1.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['name', 'owner', 'plugins']);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of MARKETPLACE_CATALOG_BASE_REQUIRED) {
      expect(MARKETPLACE_CATALOG_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field catalog set', () => {
    expect([...MARKETPLACE_CATALOG_REQUIRED_FIELDS].sort()).toEqual(
      [
        'description',
        'homepage',
        'keywords',
        'license',
        'name',
        'owner',
        'plugins',
        'version',
      ].sort(),
    );
    expect([...MARKETPLACE_CATALOG_OVERLAY_REQUIRED].sort()).toEqual(
      ['description', 'homepage', 'keywords', 'license', 'version'].sort(),
    );
  });

  it('refinement: every artifact valid under the composition is valid under the base alone', () => {
    for (const cls of ['positive', 'edge'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        if (!validateComposition(obj)) continue;
        expect(validateBase(obj), `${cls}/${file} must satisfy the base`).toBe(true);
      }
    }
  });

  it('strict narrowing: a base-valid minimal artifact is composition-INVALID (overlay genuinely narrows)', () => {
    const minimal = {
      name: 'example-marketplace',
      owner: { name: 'Jeremy Longshore' },
      plugins: [{ name: 'plugin-1', source: './plugins/plugin-1' }],
    };
    expect(validateBase(minimal)).toBe(true);
    expect(validateComposition(minimal)).toBe(false);
  });

  it('debacle guard: dropping a required field invalidates the composition (never demoted to optional)', () => {
    const full = {
      name: 'example-marketplace',
      owner: { name: 'Jeremy Longshore' },
      plugins: [{ name: 'plugin-1', source: './plugins/plugin-1' }],
      version: '1.0.0',
      description: 'A valid marketplace catalog.',
      license: 'Apache-2.0',
      homepage: 'https://github.com/jeremylongshore/marketplace',
      keywords: ['marketplace', 'kw'],
    };
    for (const field of MARKETPLACE_CATALOG_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...full };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate`).toBe(false);
    }
  });
});
