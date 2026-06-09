/**
 * Authoring-tier JSON Schema tests (ajv, draft 2020-12).
 *
 * Proves the marketplace-tier 4-fold foundation:
 *   - compiles under ajv strict mode
 *   - the `isMarketplace` composition + each fold validate the right shapes
 *   - is registered in schemas/authoring/v1/index.json with its 4 folds
 *   - never references labs.intentsolutions.io (CISO binding DR-004 + DR-010)
 *   - agrees with the hand-authored Zod mirror on golden fixtures
 *
 * Per plan 033 § 14.10 / § 14.A.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IsMarketplaceSchema } from '../validators/v1/authoring/marketplace-tier.js';

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
const SCHEMA_ID =
  'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1/marketplace-tier.schema.json';

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

function validArtifact(): Record<string, unknown> {
  return {
    name: 'my-skill',
    description: 'A perfectly valid skill description.',
    'allowed-tools': ['Read'],
    version: '1.0.0',
    author: 'Jeremy Longshore <jeremy@intentsolutions.io>',
    license: 'Apache-2.0',
    compatibility: 'claude-code',
    tags: ['testing'],
  };
}

describe('authoring/v1 marketplace-tier — structural integrity', () => {
  it('declares draft 2020-12 and a github (NOT labs) $id', () => {
    const s = loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json'));
    expect(s['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(s['$id']).toBe(SCHEMA_ID);
    expect(JSON.stringify(s)).not.toContain('labs.intentsolutions.io');
  });

  it('decomposes into the 4 folds + isMarketplace composition', () => {
    const s = loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json'));
    const defs = s['$defs'] as Record<string, unknown>;
    expect(Object.keys(defs).sort()).toEqual(
      [
        'deprecationRegistry',
        'disclosureMarkers',
        'isMarketplace',
        'requiredFields',
        'securityChecks',
      ].sort(),
    );
    const composition = defs['isMarketplace'] as { allOf: unknown[] };
    expect(composition.allOf).toHaveLength(4);
  });

  it('is registered in index.json with all 4 fold names', () => {
    const idx = loadJson(join(AUTHORING_DIR, 'index.json'));
    const schemas = idx['schemas'] as Record<
      string,
      { path: string; kind: string; folds: string[] }
    >;
    const entry = schemas['marketplace-tier'];
    expect(entry?.path).toBe('marketplace-tier.schema.json');
    expect(entry?.kind).toBe('authoring-foundation');
    expect(entry?.folds).toEqual([
      'requiredFields',
      'deprecationRegistry',
      'securityChecks',
      'disclosureMarkers',
    ]);
  });
});

describe('authoring/v1 marketplace-tier — ajv validation', () => {
  let validateMarket: ValidateFn;
  let validateRequired: ValidateFn;

  beforeAll(() => {
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json')));
    validateMarket = ajv.getSchema(`${SCHEMA_ID}#/$defs/isMarketplace`)!;
    validateRequired = ajv.getSchema(`${SCHEMA_ID}#/$defs/requiredFields`)!;
  });

  it('isMarketplace accepts a fully valid artifact', () => {
    expect(validateMarket(validArtifact())).toBe(true);
  });

  it('isMarketplace rejects a missing required field', () => {
    const bad = validArtifact();
    delete bad['version'];
    expect(validateMarket(bad)).toBe(false);
  });

  it('isMarketplace rejects a deprecated field (deprecationRegistry fold)', () => {
    const bad = { ...validArtifact(), 'compatible-with': 'x' };
    expect(validateMarket(bad)).toBe(false);
  });

  it('isMarketplace rejects a reserved name (securityChecks fold)', () => {
    const bad = { ...validArtifact(), name: 'skill' };
    expect(validateMarket(bad)).toBe(false);
  });

  it('isMarketplace rejects XML in description (securityChecks fold)', () => {
    const bad = { ...validArtifact(), description: 'has <tag>' };
    expect(validateMarket(bad)).toBe(false);
  });

  it('isMarketplace rejects an over-budget description (disclosureMarkers fold)', () => {
    const bad = { ...validArtifact(), description: 'x'.repeat(1537) };
    expect(validateMarket(bad)).toBe(false);
  });

  it('requiredFields fold validates in isolation', () => {
    expect(validateRequired(validArtifact())).toBe(true);
    expect(validateRequired({})).toBe(false);
  });
});

describe('authoring/v1 marketplace-tier — Zod ↔ JSON Schema agreement', () => {
  let validateMarket: ValidateFn;

  beforeAll(() => {
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json')));
    validateMarket = ajv.getSchema(`${SCHEMA_ID}#/$defs/isMarketplace`)!;
  });

  it.each([
    ['valid artifact', validArtifact(), true],
    ['missing field', { name: 'x' }, false],
    ['reserved name', { ...validArtifact(), name: 'claude' }, false],
  ])('%s: ajv and Zod agree', (_label, artifact, expected) => {
    expect(validateMarket(artifact)).toBe(expected);
    expect(IsMarketplaceSchema.safeParse(artifact).success).toBe(expected);
  });
});
