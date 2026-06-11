/**
 * plugin-manifest contract #2 — the first codegen-generated contract (DR-044 D8).
 *
 * Mirrors the contract-#1 walking-skeleton test, proving the three-artifact
 * base+overlay composition for plugin-manifest (the `.claude-plugin/plugin.json`
 * shape):
 *   - the published schema is a PURE allOf of [upstream-base, universalFolds, is-overlay]
 *   - the JSON Schema (ajv) and the codegen-generated Zod mirror AGREE fold-for-fold
 *     (the D8 fold-agreement backstop — the gate that justifies the generated Zod)
 *   - correctness against the 40-fixture corpus (22 valid accepted; 18 negative rejected)
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on the
 *     upstream base — the 2026-04-28-debacle guard (required fields never silently demoted)
 *   - the effective-required manifest = base ∪ overlay = the IS 8-field plugin set
 *   - registered in index.json as contract #2 + exported from the validators barrel
 *
 * Upstream authority: code.claude.com/docs/en/plugins-reference § "Plugin manifest
 * schema" — "If you include a manifest, name is the only required field" ⇒ the
 * base floor is exactly [name]; the IS overlay promotes seven upstream-optional
 * metadata fields to required.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PluginManifestSchema,
  PLUGIN_MANIFEST_BASE_REQUIRED,
  PLUGIN_MANIFEST_OVERLAY_REQUIRED,
  PLUGIN_MANIFEST_REQUIRED_FIELDS,
} from '../validators/v1/authoring/plugin-manifest.js';

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
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v1/fixtures/plugin-manifest');
const BASE = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${BASE}/plugin-manifest.schema.json`;
const UPSTREAM_BASE_ID = `${BASE}/upstream-base/plugin-manifest.v1.json`;

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
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'upstream-base/plugin-manifest.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'is-overlay/plugin-manifest.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'plugin-manifest.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
});

describe('plugin-manifest — composition is pure (zero authored fields)', () => {
  it('the published schema is exactly an allOf of the three layers', () => {
    const s = loadJson(join(AUTHORING_DIR, 'plugin-manifest.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(`${BASE}/marketplace-tier.schema.json#/$defs/universalFolds`);
    expect(allOf[2]?.$ref).toBe(`${BASE}/is-overlay/plugin-manifest.v1.json`);
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(AUTHORING_DIR, 'plugin-manifest.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in index.json as contract #2 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(AUTHORING_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['plugin-manifest'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(2);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });
});

describe('plugin-manifest — correctness against the 40-fixture corpus', () => {
  it('accepts every valid manifest (22/22 — 0 false-rejects)', () => {
    for (const cls of ['positive', 'edge'] as const) {
      for (const file of listJson(cls)) {
        expect(validateComposition(fixture(cls, file)), `${cls}/${file} should be accepted`).toBe(
          true,
        );
      }
    }
  });

  it('rejects every negative (18/18 — 0 false-accepts)', () => {
    for (const file of listJson('negative')) {
      expect(validateComposition(fixture('negative', file)), `negative/${file} should reject`).toBe(
        false,
      );
    }
  });
});

describe('plugin-manifest — ajv ↔ Zod fold agreement (D8 backstop)', () => {
  it('the JSON Schema and the Zod mirror return the same verdict on all 40 fixtures', () => {
    for (const cls of ['positive', 'negative', 'edge'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = PluginManifestSchema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });

  const valid = {
    name: 'example-plugin',
    version: '2.0.0',
    description: 'A valid plugin.',
    author: { name: 'Jeremy Longshore', email: 'jeremy@intentsolutions.io' },
    license: 'Apache-2.0',
    homepage: 'https://github.com/jeremylongshore/example-plugin',
    keywords: ['plugin', 'kw'],
    commands: ['/example'],
  };

  it.each([
    ['empty keywords array is accepted', { keywords: [] as unknown }, true],
    ['string keywords is rejected', { keywords: 'kw' }, false],
    ['empty commands array is accepted', { commands: [] as unknown }, true],
    ['string commands is rejected', { commands: '/cmd' }, false],
    ['non-semver version is rejected', { version: '2.0' }, false],
    ['prerelease semver is accepted', { version: '2.0.0-beta.1' }, true],
    ['author as a bare string is rejected (upstream is an object)', { author: 'Jeremy' }, false],
    ['author object missing inner name is rejected', { author: { email: 'x@y.z' } }, false],
    ['author object with only name is accepted', { author: { name: 'Jeremy' } }, true],
    ['homepage that is not a URI is rejected', { homepage: 'not-a-url' }, false],
    ['non-string homepage is rejected', { homepage: 42 }, false],
    ['non-string description is rejected', { description: 42 }, false],
    ['non-string license is rejected', { license: 1 }, false],
    ['non-string name is rejected', { name: 7 }, false],
    ['empty name is rejected', { name: '' }, false],
    ['uppercase name is rejected', { name: 'Example-Plugin' }, false],
    ['optional repository as a valid URI is accepted', { repository: 'https://x.dev/r' }, true],
    ['optional repository that is not a URI is rejected', { repository: 'nope' }, false],
    ['non-string repository is rejected', { repository: 99 }, false],
    ['optional metadata object is accepted', { metadata: { 'intent-solutions': {} } }, true],
    ['metadata as a non-object is rejected', { metadata: ['nope'] as unknown }, false],
  ])('agree on extras: %s', (_label, patch, expected) => {
    const artifact = { ...valid, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact)).toBe(expected);
    expect(PluginManifestSchema.safeParse(artifact).success).toBe(expected);
  });

  it('agrees on an over-budget description (universal disclosureMarkers fold, 1536)', () => {
    const bad = { ...valid, description: 'x'.repeat(1537) };
    expect(validateComposition(bad)).toBe(false);
    expect(PluginManifestSchema.safeParse(bad).success).toBe(false);
  });

  it('agrees on an over-long name (base 64-char cap)', () => {
    const bad = { ...valid, name: 'a'.repeat(65) };
    expect(validateComposition(bad)).toBe(false);
    expect(PluginManifestSchema.safeParse(bad).success).toBe(false);
  });
});

describe('plugin-manifest — monotonicity (overlay strictly additive/narrowing on base)', () => {
  it('base required is exactly the upstream standardFloor [name]', () => {
    expect([...PLUGIN_MANIFEST_BASE_REQUIRED]).toEqual(['name']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(AUTHORING_DIR, 'upstream-base/plugin-manifest.v1.json'));
    const overlay = loadJson(join(AUTHORING_DIR, 'is-overlay/plugin-manifest.v1.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['name']);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of PLUGIN_MANIFEST_BASE_REQUIRED) {
      expect(PLUGIN_MANIFEST_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field plugin set', () => {
    expect([...PLUGIN_MANIFEST_REQUIRED_FIELDS].sort()).toEqual(
      [
        'author',
        'commands',
        'description',
        'homepage',
        'keywords',
        'license',
        'name',
        'version',
      ].sort(),
    );
    expect([...PLUGIN_MANIFEST_OVERLAY_REQUIRED].sort()).toEqual(
      ['author', 'commands', 'description', 'homepage', 'keywords', 'license', 'version'].sort(),
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
    const minimal = { name: 'example-plugin' };
    expect(validateBase(minimal)).toBe(true);
    expect(validateComposition(minimal)).toBe(false);
  });

  it('debacle guard: dropping a required field invalidates the composition (never demoted to optional)', () => {
    const full = {
      name: 'example-plugin',
      version: '2.0.0',
      description: 'A valid plugin.',
      author: { name: 'Jeremy Longshore', email: 'jeremy@intentsolutions.io' },
      license: 'Apache-2.0',
      homepage: 'https://github.com/jeremylongshore/example-plugin',
      keywords: ['plugin', 'kw'],
      commands: ['/example'],
    };
    for (const field of PLUGIN_MANIFEST_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...full };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate`).toBe(false);
    }
  });
});
