/**
 * hook-config v2 — the DR-062 projection-mirrored base (tier-3 reconciliation).
 *
 * Proves the v2 contract whose upstream base is REGENERATED from the captured
 * projection (intent-eval-lab specs/_vendor/upstream/hook-config/projection.json,
 * spec-projection/v1, spec_version unversioned-2026-06-12) per DR-062:
 *   - composition purity: the published v2 schema is a PURE allOf of the three
 *     v2 layers, with ZERO $ref into the frozen v1 family
 *   - C1 adoptions (060 #1/#3/#5): the documented 3-LEVEL NESTING (event →
 *     [{matcher, hooks:[handler…]}]) replaces v1's flattened single-handler
 *     shape; the 18 documented handler fields; per-type required fields for
 *     ALL FIVE handler types (command/http/mcp_tool/prompt/agent)
 *   - C2 WIDENING PROOF (060 #2): the upstream match-all matcher forms the v1
 *     base REJECTED (omitted matcher, empty-string matcher) are ACCEPTED by
 *     the v2 base
 *   - C3/RELOCATION PROOF: the relocated narrowings (explicit non-empty
 *     matcher, the per-handler IS quartet, the `metadata` extension) bind via
 *     the overlay/composition, NOT the base (base-valid, composition-invalid)
 *   - ajv ↔ Zod fold agreement on the v2 fixture corpus + top-level branch
 *     probes (the D8 backstop). DEPTH BOUNDARY: the nested matcher-group /
 *     handler constraints are enforced by the published JSON Schema (ajv); the
 *     generated Zod layer checks the top-level surface only (the keyword-driven
 *     codegen emits no deep-nesting checks — documented in the generated
 *     module), so the DEEP positive/negative probes below assert ajv verdicts
 *     and the corpus negatives are chosen at the Zod-visible top level
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on
 *     the v2 base; effective top-level required = base ∪ overlay = [hooks]
 *     (the IS per-handler 8-field surface now binds INSIDE the adopted nesting)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HookConfigV2Schema,
  HOOK_CONFIG_V2_BASE_REQUIRED,
  HOOK_CONFIG_V2_OVERLAY_REQUIRED,
  HOOK_CONFIG_V2_REQUIRED_FIELDS,
} from '../validators/v1/authoring/v2/index.js';
import { upstreamBaseIssues } from '../validators/v1/authoring/v2/hook-config.js';

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
const V2_DIR = join(__dirname, '../../schemas/authoring/v2');
const V1_DIR = join(__dirname, '../../schemas/authoring/v1');
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v2/fixtures/hook-config');
const V2_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v2';
const V1_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${V2_BASE_URL}/hook-config.schema.json`;
const UPSTREAM_BASE_ID = `${V2_BASE_URL}/upstream-base/hook-config.v2.json`;

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
let validateV1Base: ValidateFn;

beforeAll(() => {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(loadJson(join(V2_DIR, 'marketplace-tier.schema.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'upstream-base/hook-config.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'is-overlay/hook-config.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'hook-config.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
  // The FROZEN v1 base (the flattened single-handler shape), loaded read-only
  // as the C2-widening reference point.
  const ajvV1 = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajvV1);
  ajvV1.addSchema(loadJson(join(V1_DIR, 'upstream-base/hook-config.v1.json')));
  validateV1Base = ajvV1.getSchema(`${V1_BASE_URL}/upstream-base/hook-config.v1.json`)!;
});

/** One composition-valid handler carrying the IS per-handler quartet. */
const IS_HANDLER = {
  type: 'command',
  command: './scripts/escape-scan.sh --staged',
  description: 'Run the escape-scan gate before any Bash tool call.',
  enabled: true,
  timeout: 30,
  blocking: true,
};

const V2_VALID = {
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [IS_HANDLER] }],
  },
};

/** A one-event document built around a single matcher group (base probes). */
function doc(group: Record<string, unknown>, event = 'PreToolUse'): Record<string, unknown> {
  return { hooks: { [event]: [group] } };
}

describe('hook-config v2 — composition is pure (zero authored fields, zero v1 $ref)', () => {
  it('the published v2 schema is exactly an allOf of the three v2 layers', () => {
    const s = loadJson(join(V2_DIR, 'hook-config.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(
      `${V2_BASE_URL}/marketplace-tier.schema.json#/$defs/universalFolds`,
    );
    expect(allOf[2]?.$ref).toBe(`${V2_BASE_URL}/is-overlay/hook-config.v2.json`);
  });

  it('NO hook-config v2 schema file contains a $ref into the v1 family', () => {
    for (const file of [
      'hook-config.schema.json',
      'upstream-base/hook-config.v2.json',
      'is-overlay/hook-config.v2.json',
      'index.json',
    ]) {
      const raw = readFileSync(join(V2_DIR, file), 'utf-8');
      expect(raw, `${file} must not reference authoring/v1`).not.toContain('/authoring/v1/');
    }
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(V2_DIR, 'hook-config.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
  });

  it('is registered in v2 index.json as contract #5 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(V2_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['hook-config'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(5);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });

  it('the base $comment cites the projection (path + sha256) and DR-062', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/hook-config.v2.json'));
    const comment = base['$comment'] as string;
    expect(comment).toContain('specs/_vendor/upstream/hook-config/projection.json');
    expect(comment).toContain('58b4c144f08aaaf524050f804d7e6d71939d7c7d8128ab1a307b4e6094cfde09');
    expect(comment).toContain('062-AT-DECR');
  });

  it('never references labs.intentsolutions.io (CISO binding DR-004 + DR-010)', () => {
    for (const file of [
      'hook-config.schema.json',
      'upstream-base/hook-config.v2.json',
      'is-overlay/hook-config.v2.json',
    ]) {
      expect(JSON.stringify(loadJson(join(V2_DIR, file)))).not.toContain('labs.intentsolutions.io');
    }
  });
});

describe('hook-config v2 — fixture corpus (composition)', () => {
  it('accepts every positive fixture (ajv + Zod agree)', () => {
    for (const file of listJson('positive')) {
      const obj = fixture('positive', file);
      expect(validateComposition(obj), `positive/${file} (ajv) should accept`).toBe(true);
      expect(
        HookConfigV2Schema.safeParse(obj).success,
        `positive/${file} (Zod) should accept`,
      ).toBe(true);
    }
  });

  it('rejects every negative fixture (ajv + Zod agree)', () => {
    // The corpus negatives are chosen at the Zod-visible TOP LEVEL (missing
    // hooks / non-object hooks / non-object metadata) so the D8 backstop holds;
    // the deep ajv-side negatives live in the per-type and relocation blocks.
    for (const file of listJson('negative')) {
      const obj = fixture('negative', file);
      expect(validateComposition(obj), `negative/${file} (ajv) should reject`).toBe(false);
      expect(
        HookConfigV2Schema.safeParse(obj).success,
        `negative/${file} (Zod) should reject`,
      ).toBe(false);
    }
  });

  it('ajv and Zod return the same verdict on every fixture (D8 backstop)', () => {
    for (const cls of ['positive', 'negative'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = HookConfigV2Schema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });
});

describe('hook-config v2 — C2 WIDENING PROOF (060 #2: v1-base-rejected match-all forms, v2-base-accepted)', () => {
  it('an OMITTED matcher (the documented match-all default) — v1 base rejected it, v2 base accepts it', () => {
    // The frozen v1 base (flattened single-handler shape) required an explicit
    // matcher — the IS projection choice DR-062 relocates — so the
    // matcher-omitted wire form was REJECTED.
    expect(
      validateV1Base({ event: 'PreToolUse', type: 'command', command: './scripts/guard.sh' }),
    ).toBe(false);
    // The v2 base mirrors the projection (matcher.match_all_forms.omitted):
    // a matcher-less group is upstream-valid (ajv AND the generated Zod).
    const omitted = doc({ hooks: [{ type: 'command', command: './scripts/guard.sh' }] });
    expect(validateBase(omitted)).toBe(true);
    expect(upstreamBaseIssues(omitted)).toEqual([]);
  });

  it("an EMPTY-STRING matcher (the documented '' match-all form) — v1 base rejected it, v2 base accepts it", () => {
    // v1 wire shape, empty matcher: the v1 base's minLength 1 rejected it.
    expect(
      validateV1Base({
        event: 'PreToolUse',
        matcher: '',
        type: 'command',
        command: './scripts/guard.sh',
      }),
    ).toBe(false);
    // v2 nested shape: '' is a documented match-all form (projection
    // matcher.match_all_forms.empty) — base-accepted.
    const empty = doc({ matcher: '', hooks: [{ type: 'command', command: './scripts/guard.sh' }] });
    expect(validateBase(empty)).toBe(true);
    expect(upstreamBaseIssues(empty)).toEqual([]);
  });

  it("the '*' match-all form is accepted by base AND composition (the explicit IS spelling)", () => {
    const star = doc({ matcher: '*', hooks: [IS_HANDLER] });
    expect(validateBase(star)).toBe(true);
    expect(validateComposition(star)).toBe(true);
    expect(HookConfigV2Schema.safeParse(star).success).toBe(true);
  });
});

describe('hook-config v2 — RELOCATION PROOF (the IS narrowings bind via overlay/composition, NOT base)', () => {
  it('a matcher-omitted group is v2-base-VALID but composition-INVALID (the explicit-non-empty-matcher requirement lives in the overlay)', () => {
    const omitted = doc({ hooks: [IS_HANDLER] });
    // The v2 base mirrors upstream: omitted matcher = match-all — valid.
    expect(validateBase(omitted)).toBe(true);
    expect(upstreamBaseIssues(omitted)).toEqual([]);
    // The composition rejects: the RELOCATED explicit-non-empty-matcher
    // narrowing (DR-062 C2 → overlay) binds DEEP via ajv. (Zod not asserted —
    // the generated layer's documented depth boundary stops at the top level.)
    expect(validateComposition(omitted)).toBe(false);
  });

  it('an empty-string matcher is v2-base-VALID but composition-INVALID (minLength 1 lives in the overlay)', () => {
    const empty = doc({ matcher: '', hooks: [IS_HANDLER] });
    expect(validateBase(empty)).toBe(true);
    expect(validateComposition(empty)).toBe(false);
  });

  it('a handler missing the IS quartet is v2-base-VALID but composition-INVALID (description/enabled/timeout/blocking carried from the v1 overlay)', () => {
    const upstreamOnly = doc({
      matcher: 'Bash',
      hooks: [{ type: 'command', command: './scripts/guard.sh' }],
    });
    expect(validateBase(upstreamOnly)).toBe(true);
    expect(upstreamBaseIssues(upstreamOnly)).toEqual([]);
    expect(validateComposition(upstreamOnly)).toBe(false);
  });

  it.each(['description', 'enabled', 'timeout', 'blocking'])(
    'dropping the per-handler IS field "%s" invalidates the composition (ajv — deep)',
    (field) => {
      const handler: Record<string, unknown> = { ...IS_HANDLER };
      delete handler[field];
      const dropped = doc({ matcher: 'Bash', hooks: [handler] });
      expect(validateBase(dropped), 'still upstream-valid').toBe(true);
      expect(validateComposition(dropped)).toBe(false);
    },
  );

  it('the relocated metadata extension binds via the overlay (DR-062 C3): non-object metadata rejected by composition', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/hook-config.v2.json'));
    expect((base['properties'] as Record<string, unknown>)['metadata']).toBeUndefined();
    const overlay = loadJson(join(V2_DIR, 'is-overlay/hook-config.v2.json'));
    expect((overlay['properties'] as Record<string, unknown>)['metadata']).toBeDefined();
    const bad = { ...V2_VALID, metadata: ['not', 'an', 'object'] };
    expect(validateComposition(bad)).toBe(false);
    expect(HookConfigV2Schema.safeParse(bad).success).toBe(false);
  });

  it('the v1 FLATTENED single-handler wire shape does NOT satisfy v2 (060 #1 — the nesting replaces it)', () => {
    const v1Shaped = {
      event: 'PreToolUse',
      matcher: 'Bash',
      type: 'command',
      command: './scripts/guard.sh',
      description: 'A v1-shaped flattened handler entry.',
      enabled: true,
      timeout: 30,
      blocking: true,
    };
    expect(validateComposition(v1Shaped)).toBe(false);
    expect(HookConfigV2Schema.safeParse(v1Shaped).success).toBe(false);
  });
});

describe('hook-config v2 — nesting + per-type conditional shapes (060 #1/#3/#5 adoption; ajv — deep)', () => {
  it.each([
    [
      'command with command accepted',
      doc({ hooks: [{ type: 'command', command: './run.sh' }] }),
      true,
    ],
    ['command missing command rejected', doc({ hooks: [{ type: 'command' }] }), false],
    [
      'http with url accepted',
      doc({ hooks: [{ type: 'http', url: 'https://x.example/hook' }] }),
      true,
    ],
    ['http missing url rejected', doc({ hooks: [{ type: 'http' }] }), false],
    [
      'mcp_tool with server+tool accepted',
      doc({ hooks: [{ type: 'mcp_tool', server: 'plane', tool: 'list_states' }] }),
      true,
    ],
    [
      'mcp_tool missing tool rejected',
      doc({ hooks: [{ type: 'mcp_tool', server: 'plane' }] }),
      false,
    ],
    ['prompt with prompt accepted', doc({ hooks: [{ type: 'prompt', prompt: 'Review.' }] }), true],
    ['prompt missing prompt rejected', doc({ hooks: [{ type: 'prompt' }] }), false],
    ['agent with prompt accepted', doc({ hooks: [{ type: 'agent', prompt: 'Audit.' }] }), true],
    ['agent missing prompt rejected', doc({ hooks: [{ type: 'agent' }] }), false],
    ['handler missing type rejected', doc({ hooks: [{ command: './run.sh' }] }), false],
    [
      'invalid handler type rejected (enum)',
      doc({ hooks: [{ type: 'sorcery', command: './run.sh' }] }),
      false,
    ],
    ['matcher group missing hooks rejected', doc({ matcher: 'Bash' }), false],
    [
      'unknown event key rejected (30-event propertyNames enum)',
      doc({ hooks: [{ type: 'command', command: './run.sh' }] }, 'NotAnEvent'),
      false,
    ],
    [
      'non-number handler timeout rejected',
      doc({ hooks: [{ type: 'command', command: './run.sh', timeout: '30' }] }),
      false,
    ],
    [
      'invalid shell rejected (enum {bash, powershell})',
      doc({ hooks: [{ type: 'command', command: './run.sh', shell: 'zsh' }] }),
      false,
    ],
  ])('base verdict (ajv): %s', (_label, artifact, expected) => {
    expect(validateBase(artifact), _label).toBe(expected);
  });
});

describe('hook-config v2 — ajv ↔ Zod fold agreement on top-level composition branches', () => {
  it.each([
    ['canonical document accepted', {}, true],
    ['hooks as array rejected', { hooks: [] as unknown }, false],
    ['hooks as string rejected', { hooks: 'PreToolUse' }, false],
    ['metadata object accepted', { metadata: { 'intent-solutions': {} } }, true],
    ['non-object metadata rejected', { metadata: ['nope'] as unknown }, false],
  ])('agree on: %s', (_label, patch, expected) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact), `ajv: ${_label}`).toBe(expected);
    expect(HookConfigV2Schema.safeParse(artifact).success, `zod: ${_label}`).toBe(expected);
  });
});

describe('hook-config v2 — monotonicity (overlay strictly additive/narrowing on the v2 base)', () => {
  it('base required is exactly the upstream floor [hooks]', () => {
    expect([...HOOK_CONFIG_V2_BASE_REQUIRED]).toEqual(['hooks']);
  });

  it('the overlay adds NO top-level required fields (its narrowings bind inside the nesting)', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/hook-config.v2.json'));
    const overlay = loadJson(join(V2_DIR, 'is-overlay/hook-config.v2.json'));
    expect(base['required'] as string[]).toEqual(['hooks']);
    expect(overlay['required'] as string[]).toEqual([]);
    expect([...HOOK_CONFIG_V2_OVERLAY_REQUIRED]).toEqual([]);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of HOOK_CONFIG_V2_BASE_REQUIRED) {
      expect(HOOK_CONFIG_V2_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective top-level required = base ∪ overlay = [hooks]', () => {
    expect([...HOOK_CONFIG_V2_REQUIRED_FIELDS]).toEqual(['hooks']);
  });

  it('refinement: every composition-valid fixture is valid under the v2 base alone', () => {
    for (const file of listJson('positive')) {
      const obj = fixture('positive', file);
      expect(validateComposition(obj)).toBe(true);
      expect(validateBase(obj), `positive/${file} must satisfy the base`).toBe(true);
    }
  });

  it('debacle guard: dropping any effective-required field invalidates the composition', () => {
    for (const field of HOOK_CONFIG_V2_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...V2_VALID };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate (ajv)`).toBe(false);
      expect(
        HookConfigV2Schema.safeParse(dropped).success,
        `dropping "${field}" must invalidate (Zod)`,
      ).toBe(false);
    }
  });
});
