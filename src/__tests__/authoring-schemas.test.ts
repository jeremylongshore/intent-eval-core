/**
 * Authoring-tier JSON Schema tests (ajv, draft 2020-12) — foundation.
 *
 * Proves the marketplace-tier universal-fold foundation (post-DR-044 D7):
 *   - compiles under ajv strict mode
 *   - exposes the 3 universal folds + the universalFolds composition
 *   - no longer carries requiredFields / isMarketplace (moved per-contract)
 *   - is registered in schemas/authoring/v1/index.json with its 3 universal folds
 *   - never references labs.intentsolutions.io (CISO binding DR-004 + DR-010)
 *   - the universalFolds composition validates the right shapes
 *
 * Per DR-044 D7 / plan 033 § 14.10. The skill-frontmatter contract composition
 * (base + universalFolds + overlay) is proven in skill-frontmatter-schema.test.ts.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

describe('authoring/v1 marketplace-tier — structural integrity', () => {
  it('declares draft 2020-12 and a github (NOT labs) $id', () => {
    const s = loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json'));
    expect(s['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(s['$id']).toBe(SCHEMA_ID);
    expect(JSON.stringify(s)).not.toContain('labs.intentsolutions.io');
  });

  it('exposes exactly the 3 universal folds + universalFolds composition', () => {
    const s = loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json'));
    const defs = s['$defs'] as Record<string, unknown>;
    expect(Object.keys(defs).sort()).toEqual(
      ['deprecationRegistry', 'disclosureMarkers', 'securityChecks', 'universalFolds'].sort(),
    );
    const composition = defs['universalFolds'] as { allOf: unknown[] };
    expect(composition.allOf).toHaveLength(3);
  });

  it('no longer carries requiredFields or isMarketplace (moved per-contract by D7)', () => {
    const s = loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json'));
    const defs = s['$defs'] as Record<string, unknown>;
    expect(defs['requiredFields']).toBeUndefined();
    expect(defs['isMarketplace']).toBeUndefined();
  });

  it('is registered in index.json with its 3 universal fold names', () => {
    const idx = loadJson(join(AUTHORING_DIR, 'index.json'));
    const schemas = idx['schemas'] as Record<
      string,
      { path: string; kind: string; universalFolds: string[] }
    >;
    const entry = schemas['marketplace-tier'];
    expect(entry?.path).toBe('marketplace-tier.schema.json');
    expect(entry?.kind).toBe('authoring-foundation');
    expect(entry?.universalFolds).toEqual([
      'deprecationRegistry',
      'securityChecks',
      'disclosureMarkers',
    ]);
  });
});

describe('authoring/v1 universalFolds — ajv validation', () => {
  let validateUniversal: ValidateFn;

  beforeAll(() => {
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(loadJson(join(AUTHORING_DIR, 'marketplace-tier.schema.json')));
    validateUniversal = ajv.getSchema(`${SCHEMA_ID}#/$defs/universalFolds`)!;
  });

  it('accepts a clean artifact', () => {
    expect(validateUniversal({ name: 'my-skill', description: 'A clean description.' })).toBe(true);
  });

  it('does NOT enforce required fields (that is per-contract)', () => {
    expect(validateUniversal({})).toBe(true);
  });

  it('rejects a deprecated field (deprecationRegistry fold)', () => {
    expect(validateUniversal({ 'compatible-with': 'x' })).toBe(false);
  });

  it('rejects a reserved name (securityChecks fold)', () => {
    expect(validateUniversal({ name: 'skill' })).toBe(false);
  });

  it('rejects XML in description (securityChecks fold)', () => {
    expect(validateUniversal({ description: 'has <tag>' })).toBe(false);
  });

  it('rejects an over-budget description (disclosureMarkers fold)', () => {
    expect(validateUniversal({ description: 'x'.repeat(1537) })).toBe(false);
  });
});
