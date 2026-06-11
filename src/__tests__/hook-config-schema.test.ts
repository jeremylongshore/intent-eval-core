/**
 * hook-config contract #5 — codegen-generated (DR-044 D8).
 *
 * Mirrors the contract-#1/#2 walking-skeleton tests, proving the three-artifact
 * base+overlay composition for hook-config (a single flattened hooks.json handler
 * entry):
 *   - the published schema is a PURE allOf of [upstream-base, universalFolds, is-overlay]
 *   - the JSON Schema (ajv) and the codegen-generated Zod mirror AGREE fold-for-fold
 *   - correctness against the 40-fixture corpus (22 valid accepted; 18 negative rejected)
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on the base
 *   - the effective-required manifest = base ∪ overlay = the IS 8-field hook set
 *   - registered in index.json as contract #5 + exported from the validators barrel
 *
 * Upstream authority: code.claude.com/docs/en/hooks (Hook lifecycle event table +
 * the per-handler field tables; exit-code-2 blocking semantics) +
 * code.claude.com/docs/en/settings. The base requires the trigger+handler surface
 * [event, matcher, type, command]; `timeout` is upstream-optional and promoted to
 * IS-required; description/enabled/blocking are net-new IS-required fields. This
 * contract carries NO `name` — a hook handler has no public identifier, so the
 * universal securityChecks name fold does not fire on it.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HookConfigSchema,
  HOOK_CONFIG_BASE_REQUIRED,
  HOOK_CONFIG_OVERLAY_REQUIRED,
  HOOK_CONFIG_REQUIRED_FIELDS,
} from '../validators/v1/authoring/hook-config.js';

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
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v1/fixtures/hook-config');
const BASE = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${BASE}/hook-config.schema.json`;
const UPSTREAM_BASE_ID = `${BASE}/upstream-base/hook-config.v1.json`;

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
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'upstream-base/hook-config.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'is-overlay/hook-config.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'hook-config.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
});

describe('hook-config — composition is pure (zero authored fields)', () => {
  it('the published schema is exactly an allOf of the three layers', () => {
    const s = loadJson(join(AUTHORING_DIR, 'hook-config.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(`${BASE}/marketplace-tier.schema.json#/$defs/universalFolds`);
    expect(allOf[2]?.$ref).toBe(`${BASE}/is-overlay/hook-config.v1.json`);
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(AUTHORING_DIR, 'hook-config.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in index.json as contract #5 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(AUTHORING_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['hook-config'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(5);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });
});

describe('hook-config — correctness against the 40-fixture corpus', () => {
  it('accepts every valid hook (22/22 — 0 false-rejects)', () => {
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

describe('hook-config — ajv ↔ Zod fold agreement (D8 backstop)', () => {
  it('the JSON Schema and the Zod mirror return the same verdict on all 40 fixtures', () => {
    for (const cls of ['positive', 'negative', 'edge'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = HookConfigSchema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });

  const valid = {
    event: 'PreToolUse',
    matcher: 'Bash',
    type: 'command',
    command: 'echo hook',
    description: 'A valid hook.',
    enabled: true,
    timeout: 30,
    blocking: true,
  };

  it.each([
    ['invalid event is rejected', { event: 'NotAnEvent' }, false],
    ['non-string event is rejected', { event: 2 }, false],
    ['SessionStart event is accepted', { event: 'SessionStart' }, true],
    ['SessionEnd event is accepted', { event: 'SessionEnd' }, true],
    ['empty matcher is rejected', { matcher: '' }, false],
    ['non-string matcher is rejected', { matcher: 9 }, false],
    ['invalid type is rejected', { type: 'sorcery' }, false],
    ['non-string type is rejected', { type: 3 }, false],
    ['http type is accepted', { type: 'http' }, true],
    ['agent type is accepted', { type: 'agent' }, true],
    ['empty command is rejected', { command: '' }, false],
    ['non-string command is rejected', { command: [] as unknown }, false],
    ['non-string description is rejected', { description: 42 }, false],
    ['non-boolean enabled is rejected', { enabled: 'yes' }, false],
    ['non-boolean blocking is rejected', { blocking: 1 }, false],
    ['non-integer timeout (float) is rejected', { timeout: 1.5 }, false],
    ['string timeout is rejected', { timeout: '30' }, false],
    ['negative timeout is rejected', { timeout: -5 }, false],
    ['zero timeout is accepted', { timeout: 0 }, true],
    ['optional metadata object is accepted', { metadata: { 'intent-solutions': {} } }, true],
    ['metadata as a non-object is rejected', { metadata: ['nope'] as unknown }, false],
  ])('agree on extras: %s', (_label, patch, expected) => {
    const artifact = { ...valid, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact)).toBe(expected);
    expect(HookConfigSchema.safeParse(artifact).success).toBe(expected);
  });

  it('agrees on an over-budget description (universal disclosureMarkers fold, 1536)', () => {
    const bad = { ...valid, description: 'x'.repeat(1537) };
    expect(validateComposition(bad)).toBe(false);
    expect(HookConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe('hook-config — monotonicity (overlay strictly additive/narrowing on base)', () => {
  it('base required is exactly the upstream trigger+handler surface', () => {
    expect([...HOOK_CONFIG_BASE_REQUIRED]).toEqual(['event', 'matcher', 'type', 'command']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(AUTHORING_DIR, 'upstream-base/hook-config.v1.json'));
    const overlay = loadJson(join(AUTHORING_DIR, 'is-overlay/hook-config.v1.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['event', 'matcher', 'type', 'command']);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of HOOK_CONFIG_BASE_REQUIRED) {
      expect(HOOK_CONFIG_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field hook set', () => {
    expect([...HOOK_CONFIG_REQUIRED_FIELDS].sort()).toEqual(
      [
        'blocking',
        'command',
        'description',
        'enabled',
        'event',
        'matcher',
        'timeout',
        'type',
      ].sort(),
    );
    expect([...HOOK_CONFIG_OVERLAY_REQUIRED].sort()).toEqual(
      ['blocking', 'description', 'enabled', 'timeout'].sort(),
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
    const minimal = { event: 'PreToolUse', matcher: 'Bash', type: 'command', command: 'echo hi' };
    expect(validateBase(minimal)).toBe(true);
    expect(validateComposition(minimal)).toBe(false);
  });

  it('debacle guard: dropping a required field invalidates the composition (never demoted to optional)', () => {
    const full = {
      event: 'PreToolUse',
      matcher: 'Bash',
      type: 'command',
      command: 'echo hook',
      description: 'A valid hook.',
      enabled: true,
      timeout: 30,
      blocking: true,
    };
    for (const field of HOOK_CONFIG_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...full };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate`).toBe(false);
    }
  });
});
