/**
 * agent-definition v2 — the DR-062 projection-mirrored base (tier-3 reconciliation).
 *
 * Proves the v2 contract whose upstream base is REGENERATED from the captured
 * projection (intent-eval-lab specs/_vendor/upstream/agent-definition/projection.json,
 * spec-projection/v1, spec_version unversioned-2026-06-12) per DR-062:
 *   - composition purity: the published v2 schema is a PURE allOf of the three
 *     v2 layers, with ZERO $ref into the frozen v1 family
 *   - C1 adoption (059 #1): the 11 unmodeled documented fields land in the base
 *     (background, disallowedTools, effort, hooks, initialPrompt, isolation,
 *     maxTurns, mcpServers, memory, permissionMode, skills)
 *   - C2 WIDENING PROOF (059 #3/#4): the upstream wire forms the v1 base
 *     REJECTED (the documented comma-separated `tools` string and the
 *     documented full-model-ID `model` latitude) are ACCEPTED by the v2 base
 *   - C3 PROOF (059 #2/#5): the relocated narrowings (tools array form, model
 *     closed enum, kebab name pattern + cap, the `metadata` extension) bind via
 *     the overlay/composition, NOT the base (base-valid, composition-invalid)
 *   - C4 PROOF (059 #6): the official sample's `color: magenta` stays rejected
 *     (observed-only — never promote observed to documented)
 *   - ajv ↔ Zod fold agreement on the v2 fixture corpus + branch probes (the
 *     D8 backstop)
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on
 *     the v2 base; effective required = base ∪ overlay = the IS 8-field set
 *     (preserved from the v1 composition VERBATIM)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AgentDefinitionV2Schema,
  AGENT_DEFINITION_V2_BASE_REQUIRED,
  AGENT_DEFINITION_V2_OVERLAY_REQUIRED,
  AGENT_DEFINITION_V2_REQUIRED_FIELDS,
  AGENT_MODEL_VALUES_V2,
} from '../validators/v1/authoring/v2/index.js';
import { upstreamBaseIssues } from '../validators/v1/authoring/v2/agent-definition.js';

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
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v2/fixtures/agent-definition');
const V2_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v2';
const V1_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${V2_BASE_URL}/agent-definition.schema.json`;
const UPSTREAM_BASE_ID = `${V2_BASE_URL}/upstream-base/agent-definition.v2.json`;

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
  ajv.addSchema(loadJson(join(V2_DIR, 'upstream-base/agent-definition.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'is-overlay/agent-definition.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'agent-definition.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
  // The FROZEN v1 base, loaded read-only as the C2-widening reference point.
  const ajvV1 = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajvV1);
  ajvV1.addSchema(loadJson(join(V1_DIR, 'upstream-base/agent-definition.v1.json')));
  validateV1Base = ajvV1.getSchema(`${V1_BASE_URL}/upstream-base/agent-definition.v1.json`)!;
});

const V2_VALID = {
  name: 'code-reviewer',
  description: 'Reviews staged diffs for correctness and security regressions.',
  tools: ['Read', 'Grep', 'Glob'],
  model: 'sonnet',
  color: 'green',
  version: '1.0.0',
  author: 'Intent Solutions',
  tags: ['code-review', 'quality'],
};

describe('agent-definition v2 — composition is pure (zero authored fields, zero v1 $ref)', () => {
  it('the published v2 schema is exactly an allOf of the three v2 layers', () => {
    const s = loadJson(join(V2_DIR, 'agent-definition.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(
      `${V2_BASE_URL}/marketplace-tier.schema.json#/$defs/universalFolds`,
    );
    expect(allOf[2]?.$ref).toBe(`${V2_BASE_URL}/is-overlay/agent-definition.v2.json`);
  });

  it('NO agent-definition v2 schema file contains a $ref into the v1 family', () => {
    for (const file of [
      'agent-definition.schema.json',
      'upstream-base/agent-definition.v2.json',
      'is-overlay/agent-definition.v2.json',
      'index.json',
    ]) {
      const raw = readFileSync(join(V2_DIR, file), 'utf-8');
      expect(raw, `${file} must not reference authoring/v1`).not.toContain('/authoring/v1/');
    }
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(V2_DIR, 'agent-definition.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in v2 index.json as contract #3 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(V2_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['agent-definition'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(3);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });

  it('the base $comment cites the projection (path + sha256) and DR-062', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/agent-definition.v2.json'));
    const comment = base['$comment'] as string;
    expect(comment).toContain('specs/_vendor/upstream/agent-definition/projection.json');
    expect(comment).toContain('7ff25f146d3462ee1d99ec6c0c482df899fad1d617552cb09e3594034e852a56');
    expect(comment).toContain('062-AT-DECR');
  });

  it('never references labs.intentsolutions.io (CISO binding DR-004 + DR-010)', () => {
    for (const file of [
      'agent-definition.schema.json',
      'upstream-base/agent-definition.v2.json',
      'is-overlay/agent-definition.v2.json',
    ]) {
      expect(JSON.stringify(loadJson(join(V2_DIR, file)))).not.toContain('labs.intentsolutions.io');
    }
  });
});

describe('agent-definition v2 — fixture corpus (composition)', () => {
  it('accepts every positive fixture (ajv + Zod agree)', () => {
    for (const file of listJson('positive')) {
      const obj = fixture('positive', file);
      expect(validateComposition(obj), `positive/${file} (ajv) should accept`).toBe(true);
      expect(
        AgentDefinitionV2Schema.safeParse(obj).success,
        `positive/${file} (Zod) should accept`,
      ).toBe(true);
    }
  });

  it('rejects every negative fixture (ajv + Zod agree)', () => {
    for (const file of listJson('negative')) {
      const obj = fixture('negative', file);
      expect(validateComposition(obj), `negative/${file} (ajv) should reject`).toBe(false);
      expect(
        AgentDefinitionV2Schema.safeParse(obj).success,
        `negative/${file} (Zod) should reject`,
      ).toBe(false);
    }
  });

  it('ajv and Zod return the same verdict on every fixture (D8 backstop)', () => {
    for (const cls of ['positive', 'negative'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = AgentDefinitionV2Schema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });
});

describe('agent-definition v2 — C2 WIDENING PROOF (059 #3/#4: v1-base-rejected wire forms, v2-base-accepted)', () => {
  it('the documented comma-separated `tools` string — v1 base rejected it, v2 base accepts it', () => {
    // The doc's own frontmatter example wire form: `tools: Read, Grep, Glob`
    // (projection tools_wire_form_in_example = comma-separated-string). The
    // frozen v1 base hard-coded the array-only narrowing — the IS projection
    // choice DR-062 relocates — so it REJECTED this exact documented form.
    const documentedForm = {
      name: 'code-reviewer',
      description: 'Reviews staged diffs.',
      tools: 'Read, Grep, Glob',
    };
    expect(validateV1Base(documentedForm)).toBe(false);
    // The v2 base mirrors the projection: accepted (ajv AND the generated Zod).
    expect(validateBase(documentedForm)).toBe(true);
    expect(upstreamBaseIssues(documentedForm)).toEqual([]);
  });

  it('the documented full-model-ID latitude — v1 base rejected it, v2 base accepts it', () => {
    // 'a full model ID (for example, claude-opus-4-8)' is documented latitude
    // (projection model_full_id_latitude = true); the frozen v1 base's closed
    // alias enum rejected it.
    const fullId = {
      name: 'code-reviewer',
      description: 'Reviews staged diffs.',
      model: 'claude-opus-4-8',
    };
    expect(validateV1Base(fullId)).toBe(false);
    expect(validateBase(fullId)).toBe(true);
    expect(upstreamBaseIssues(fullId)).toEqual([]);
  });

  it('the 11 C1-adopted documented fields exist in the v2 base and NOT in the v1 base (059 #1)', () => {
    const v2Base = loadJson(join(V2_DIR, 'upstream-base/agent-definition.v2.json'));
    const v1Base = loadJson(join(V1_DIR, 'upstream-base/agent-definition.v1.json'));
    const v2Props = v2Base['properties'] as Record<string, unknown>;
    const v1Props = v1Base['properties'] as Record<string, unknown>;
    for (const f of [
      'background',
      'disallowedTools',
      'effort',
      'hooks',
      'initialPrompt',
      'isolation',
      'maxTurns',
      'mcpServers',
      'memory',
      'permissionMode',
      'skills',
    ]) {
      expect(v2Props[f], `v2 base must model documented field ${f}`).toBeDefined();
      expect(v1Props[f], `v1 base never modeled ${f}`).toBeUndefined();
    }
  });
});

describe('agent-definition v2 — C3 PROOF (the relocated narrowings bind via overlay/composition, NOT base)', () => {
  it('a comma-separated tools artifact is v2-base-VALID but composition-INVALID (the array narrowing lives in the overlay)', () => {
    const stringTools = { ...V2_VALID, tools: 'Read, Grep, Glob' };
    expect(validateBase(stringTools)).toBe(true);
    expect(upstreamBaseIssues(stringTools)).toEqual([]);
    expect(validateComposition(stringTools)).toBe(false);
    expect(AgentDefinitionV2Schema.safeParse(stringTools).success).toBe(false);
  });

  it('a full-model-ID artifact is v2-base-VALID but composition-INVALID (the closed alias enum lives in the overlay)', () => {
    const fullId = { ...V2_VALID, model: 'claude-opus-4-8' };
    expect(validateBase(fullId)).toBe(true);
    expect(upstreamBaseIssues(fullId)).toEqual([]);
    expect(validateComposition(fullId)).toBe(false);
    expect(AgentDefinitionV2Schema.safeParse(fullId).success).toBe(false);
  });

  it('an uppercase name is v2-base-VALID but composition-INVALID (the kebab pattern + cap live in the overlay — 059 #5)', () => {
    const upper = { ...V2_VALID, name: 'Code-Reviewer' };
    expect(validateBase(upper)).toBe(true);
    expect(upstreamBaseIssues(upper)).toEqual([]);
    expect(validateComposition(upper)).toBe(false);
    expect(AgentDefinitionV2Schema.safeParse(upper).success).toBe(false);
  });

  it('the relocated metadata extension binds via the overlay (059 #2): non-object metadata rejected by composition', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/agent-definition.v2.json'));
    expect((base['properties'] as Record<string, unknown>)['metadata']).toBeUndefined();
    const overlay = loadJson(join(V2_DIR, 'is-overlay/agent-definition.v2.json'));
    expect((overlay['properties'] as Record<string, unknown>)['metadata']).toBeDefined();
    const bad = { ...V2_VALID, metadata: ['not', 'an', 'object'] };
    expect(validateComposition(bad)).toBe(false);
    expect(AgentDefinitionV2Schema.safeParse(bad).success).toBe(false);
  });
});

describe('agent-definition v2 — C1-adopted documented fields (059 #1 base shapes)', () => {
  const base = { name: 'a-agent', description: 'A documented-surface probe.' };
  it.each([
    ['background true accepted', { background: true }, true],
    ['background false accepted (the documented default)', { background: false }, true],
    ['background string rejected', { background: 'true' }, false],
    ['effort enum value accepted', { effort: 'xhigh' }, true],
    ['effort outside the enum rejected', { effort: 'extreme' }, false],
    ['memory enum value accepted', { memory: 'project' }, true],
    ['memory outside the enum rejected', { memory: 'global' }, false],
    ['permissionMode enum value accepted', { permissionMode: 'bypassPermissions' }, true],
    ['permissionMode outside the enum rejected', { permissionMode: 'sudo' }, false],
    ['isolation worktree accepted (the only documented value)', { isolation: 'worktree' }, true],
    ['isolation outside the documented value rejected', { isolation: 'container' }, false],
    ['maxTurns integer accepted', { maxTurns: 25 }, true],
    ['maxTurns non-integer rejected', { maxTurns: 3.5 }, false],
    ['maxTurns negative rejected', { maxTurns: -1 }, false],
    ['skills array of strings accepted', { skills: ['api-conventions'] }, true],
    ['skills bare string rejected', { skills: 'api-conventions' }, false],
    ['mcpServers array accepted (string|object entries)', { mcpServers: ['slack', {}] }, true],
    ['mcpServers bare string rejected', { mcpServers: 'slack' }, false],
    ['hooks object accepted', { hooks: { PreToolUse: [] } }, true],
    ['hooks bare string rejected', { hooks: 'hooks.json' }, false],
    ['disallowedTools documented string form accepted', { disallowedTools: 'Write, Edit' }, true],
    [
      'disallowedTools array rejected (undocumented for this field)',
      { disallowedTools: ['Write'] },
      false,
    ],
    ['initialPrompt string accepted', { initialPrompt: 'Start by reading the diff.' }, true],
    ['initialPrompt non-string rejected', { initialPrompt: 7 }, false],
    [
      'color magenta rejected even at the base (C4 — observed-only, never adopted)',
      { color: 'magenta' },
      false,
    ],
  ])('base agrees (ajv + Zod) on: %s', (_label, patch, expected) => {
    const artifact = { ...base, ...(patch as Record<string, unknown>) };
    expect(validateBase(artifact), `ajv base: ${_label}`).toBe(expected);
    expect(upstreamBaseIssues(artifact).length === 0, `zod base: ${_label}`).toBe(expected);
  });
});

describe('agent-definition v2 — ajv ↔ Zod fold agreement on composition branches', () => {
  it.each([
    ['canonical artifact accepted', {}, true],
    ['empty tools array accepted (zero pre-approved tools)', { tools: [] as unknown }, true],
    ['tools comma-separated string rejected (overlay narrowing)', { tools: 'Read, Grep' }, false],
    ['tools with non-string entries rejected', { tools: ['Read', 7] }, false],
    ['model inherit accepted', { model: 'inherit' }, true],
    ['model full ID rejected (overlay closed enum)', { model: 'claude-opus-4-8' }, false],
    ['non-string model rejected', { model: 4 }, false],
    ['color magenta rejected (C4 never adopted)', { color: 'magenta' }, false],
    ['non-string name rejected', { name: 7 }, false],
    ['empty name rejected', { name: '' }, false],
    ['uppercase name rejected (overlay kebab pattern)', { name: 'Code-Reviewer' }, false],
    ['over-long name rejected (overlay 64-char cap)', { name: 'a'.repeat(65) }, false],
    ['non-string description rejected', { description: 42 }, false],
    ['non-semver version rejected', { version: '1.0' }, false],
    ['non-string version rejected', { version: 42 }, false],
    ['prerelease semver accepted', { version: '1.0.0-rc.1' }, true],
    ['non-string author rejected', { author: 42 }, false],
    ['non-string color rejected', { color: 7 }, false],
    ['non-string permissionMode rejected', { permissionMode: 7 }, false],
    ['non-string memory rejected', { memory: 7 }, false],
    ['non-string effort rejected', { effort: 7 }, false],
    ['non-string isolation rejected', { isolation: 7 }, false],
    ['tags bare string rejected', { tags: 'code-review' }, false],
    ['metadata object accepted', { metadata: { 'intent-solutions': {} } }, true],
    ['non-object metadata rejected', { metadata: ['nope'] as unknown }, false],
    ['documented optionals accepted alongside the IS set', { effort: 'low', memory: 'user' }, true],
    // v2 universal folds bind on this contract too
    ['description at the v2 1024 cap accepted', { description: 'x'.repeat(1024) }, true],
    ['description over the v2 1024 cap rejected', { description: 'x'.repeat(1025) }, false],
    ['shell substitution $( in description rejected', { description: 'Run $(whoami).' }, false],
    ['reserved-name substring claude rejected', { name: 'claude-reviewer' }, false],
  ])('agree on: %s', (_label, patch, expected) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact), `ajv: ${_label}`).toBe(expected);
    expect(AgentDefinitionV2Schema.safeParse(artifact).success, `zod: ${_label}`).toBe(expected);
  });
});

describe('agent-definition v2 — non-empty (minLength 1) fold-agreement (ajv ↔ Zod)', () => {
  // The STRICT v2 contract floors `description` (upstream-base) and `author`
  // (is-overlay) at minLength:1. Before the v2 Zod mirrored those floors, ajv
  // REJECTED an empty string on each field while the generated Zod ACCEPTED it
  // — the ajv ↔ Zod fold-agreement gap this PR closes (the D8 backstop). These
  // cases pin the agreement at the COMPOSITION tier: BOTH validators reject an
  // empty string and accept a single character (the floor is exactly 1, not 2).
  it.each([
    ['empty description', { description: '' }],
    ['empty author', { author: '' }],
  ])('both ajv and v2 Zod reject %s', (_label, patch) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact), `ajv must reject ${_label}`).toBe(false);
    expect(
      AgentDefinitionV2Schema.safeParse(artifact).success,
      `v2 Zod must reject ${_label}`,
    ).toBe(false);
  });

  it('a single-character value on each floored field is accepted (floor is exactly minLength 1)', () => {
    for (const field of ['description', 'author'] as const) {
      const artifact = { ...V2_VALID, [field]: 'x' };
      expect(validateComposition(artifact), `ajv accepts 1-char ${field}`).toBe(true);
      expect(
        AgentDefinitionV2Schema.safeParse(artifact).success,
        `v2 Zod accepts 1-char ${field}`,
      ).toBe(true);
    }
  });
});

describe('agent-definition v2 — monotonicity (overlay strictly additive/narrowing on the v2 base)', () => {
  it('base required is exactly the upstream standardFloor [name, description]', () => {
    expect([...AGENT_DEFINITION_V2_BASE_REQUIRED]).toEqual(['name', 'description']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/agent-definition.v2.json'));
    const overlay = loadJson(join(V2_DIR, 'is-overlay/agent-definition.v2.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['name', 'description']);
    expect(overlayReq).toEqual(['tools', 'model', 'color', 'version', 'author', 'tags']);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of AGENT_DEFINITION_V2_BASE_REQUIRED) {
      expect(AGENT_DEFINITION_V2_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field agent set (v1 surface preserved verbatim)', () => {
    expect([...AGENT_DEFINITION_V2_REQUIRED_FIELDS].sort()).toEqual(
      ['author', 'color', 'description', 'model', 'name', 'tags', 'tools', 'version'].sort(),
    );
    expect([...AGENT_DEFINITION_V2_OVERLAY_REQUIRED].sort()).toEqual(
      ['author', 'color', 'model', 'tags', 'tools', 'version'].sort(),
    );
    expect([...AGENT_MODEL_VALUES_V2]).toEqual(['sonnet', 'opus', 'haiku', 'fable', 'inherit']);
  });

  it('refinement: every composition-valid fixture is valid under the v2 base alone', () => {
    for (const file of listJson('positive')) {
      const obj = fixture('positive', file);
      expect(validateComposition(obj)).toBe(true);
      expect(validateBase(obj), `positive/${file} must satisfy the base`).toBe(true);
    }
  });

  it('debacle guard: dropping any effective-required field invalidates the composition', () => {
    for (const field of AGENT_DEFINITION_V2_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...V2_VALID };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate (ajv)`).toBe(false);
      expect(
        AgentDefinitionV2Schema.safeParse(dropped).success,
        `dropping "${field}" must invalidate (Zod)`,
      ).toBe(false);
    }
  });
});
