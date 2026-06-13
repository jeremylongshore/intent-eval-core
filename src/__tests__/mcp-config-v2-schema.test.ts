/**
 * mcp-config v2 — the DR-062 projection-mirrored base (tier-3 reconciliation).
 *
 * Proves the v2 contract whose upstream base is REGENERATED from the captured
 * projection (intent-eval-lab specs/_vendor/upstream/mcp-config/projection.json,
 * spec-projection/v1, spec_version 2025-11-25) per DR-062:
 *   - composition purity: the published v2 schema is a PURE allOf of the three
 *     v2 layers, with ZERO $ref into the frozen v1 family
 *   - C1 adoptions (056 #2/#3/#4): the selector takes upstream's wire name
 *     `type`; the `streamable-http` alias is accepted; the per-transport
 *     if/then/else shapes replace the v1 flat shape
 *   - C2 WIDENING PROOF (056 #1): the upstream wire forms the v1 base REJECTED
 *     (omitted `type` — the documented stdio default — and the
 *     `streamable-http` alias) are ACCEPTED by the v2 base
 *   - C3 PROOF: the relocated flat all-required narrowing binds via the
 *     overlay/composition, NOT the base (base-valid, composition-invalid)
 *   - ajv ↔ Zod fold agreement on the v2 fixture corpus + branch probes (the
 *     D8 backstop), including the conditional-required branches
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on
 *     the v2 base; effective required = base ∪ overlay = the IS 8-field set
 *     (preserved from v1 verbatim modulo the transport → type wire-name fix)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  McpConfigV2Schema,
  MCP_CONFIG_V2_BASE_REQUIRED,
  MCP_CONFIG_V2_OVERLAY_REQUIRED,
  MCP_CONFIG_V2_REQUIRED_FIELDS,
  MCP_TYPE_VALUES_V2,
} from '../validators/v1/authoring/v2/index.js';
import { upstreamBaseIssues } from '../validators/v1/authoring/v2/mcp-config.js';

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
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v2/fixtures/mcp-config');
const V2_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v2';
const V1_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${V2_BASE_URL}/mcp-config.schema.json`;
const UPSTREAM_BASE_ID = `${V2_BASE_URL}/upstream-base/mcp-config.v2.json`;

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
  ajv.addSchema(loadJson(join(V2_DIR, 'upstream-base/mcp-config.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'is-overlay/mcp-config.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'mcp-config.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
  // The FROZEN v1 base, loaded read-only as the C2-widening reference point.
  const ajvV1 = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajvV1);
  ajvV1.addSchema(loadJson(join(V1_DIR, 'upstream-base/mcp-config.v1.json')));
  validateV1Base = ajvV1.getSchema(`${V1_BASE_URL}/upstream-base/mcp-config.v1.json`)!;
});

const V2_VALID = {
  name: 'example-server',
  type: 'stdio',
  command: 'node',
  args: ['server.js'],
  env: {},
  description: 'A valid MCP stdio server entry.',
  version: '1.0.0',
  enabled: true,
};

describe('mcp-config v2 — composition is pure (zero authored fields, zero v1 $ref)', () => {
  it('the published v2 schema is exactly an allOf of the three v2 layers', () => {
    const s = loadJson(join(V2_DIR, 'mcp-config.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(
      `${V2_BASE_URL}/marketplace-tier.schema.json#/$defs/universalFolds`,
    );
    expect(allOf[2]?.$ref).toBe(`${V2_BASE_URL}/is-overlay/mcp-config.v2.json`);
  });

  it('NO mcp-config v2 schema file contains a $ref into the v1 family', () => {
    for (const file of [
      'mcp-config.schema.json',
      'upstream-base/mcp-config.v2.json',
      'is-overlay/mcp-config.v2.json',
      'index.json',
    ]) {
      const raw = readFileSync(join(V2_DIR, file), 'utf-8');
      expect(raw, `${file} must not reference authoring/v1`).not.toContain('/authoring/v1/');
    }
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(V2_DIR, 'mcp-config.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in v2 index.json as contract #4 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(V2_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['mcp-config'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(4);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });

  it('the base $comment cites the projection (path + sha256) and DR-062', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/mcp-config.v2.json'));
    const comment = base['$comment'] as string;
    expect(comment).toContain('specs/_vendor/upstream/mcp-config/projection.json');
    expect(comment).toContain('fe9e21933fc0d2031a4a661e539f8228448dfbd5efc648383bf3e9db057f195b');
    expect(comment).toContain('062-AT-DECR');
  });

  it('never references labs.intentsolutions.io (CISO binding DR-004 + DR-010)', () => {
    for (const file of [
      'mcp-config.schema.json',
      'upstream-base/mcp-config.v2.json',
      'is-overlay/mcp-config.v2.json',
    ]) {
      expect(JSON.stringify(loadJson(join(V2_DIR, file)))).not.toContain('labs.intentsolutions.io');
    }
  });
});

describe('mcp-config v2 — fixture corpus (composition)', () => {
  it('accepts every positive fixture (ajv + Zod agree)', () => {
    for (const file of listJson('positive')) {
      const obj = fixture('positive', file);
      expect(validateComposition(obj), `positive/${file} (ajv) should accept`).toBe(true);
      expect(McpConfigV2Schema.safeParse(obj).success, `positive/${file} (Zod) should accept`).toBe(
        true,
      );
    }
  });

  it('rejects every negative fixture (ajv + Zod agree)', () => {
    for (const file of listJson('negative')) {
      const obj = fixture('negative', file);
      expect(validateComposition(obj), `negative/${file} (ajv) should reject`).toBe(false);
      expect(McpConfigV2Schema.safeParse(obj).success, `negative/${file} (Zod) should reject`).toBe(
        false,
      );
    }
  });

  it('ajv and Zod return the same verdict on every fixture (D8 backstop)', () => {
    for (const cls of ['positive', 'negative'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = McpConfigV2Schema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });
});

describe('mcp-config v2 — C2 WIDENING PROOF (056 #1 + #3: v1-base-rejected wire forms, v2-base-accepted)', () => {
  it('the standardized-format stdio entry WITHOUT `type` (the documented default) — v1 base rejected it, v2 base accepts it', () => {
    // Upstream's own `.mcp.json` standardized-format example: command/args/env,
    // no selector key at all (projection transport_field_in_standardized_format
    // = false; stdio is the documented default).
    const standardizedForm = { name: 'example-server', command: 'node', args: [], env: {} };
    // The frozen v1 base required the flat [name, command, args, transport, env]
    // — the IS projection choice DR-062 relocates — so it REJECTED this exact
    // upstream-documented wire form.
    expect(validateV1Base(standardizedForm)).toBe(false);
    // The v2 base mirrors the projection: accepted (ajv AND the generated Zod).
    expect(validateBase(standardizedForm)).toBe(true);
    expect(upstreamBaseIssues(standardizedForm)).toEqual([]);
  });

  it("the `streamable-http` alias (the MCP spec's own transport name) — v1 base rejected it, v2 base accepts it", () => {
    // v1 wire shape, alias value: the v1 enum {stdio,http,sse,ws} rejected it.
    expect(
      validateV1Base({
        name: 'remote-server',
        command: 'node',
        args: [],
        transport: 'streamable-http',
        env: {},
      }),
    ).toBe(false);
    // v2 wire shape (selector `type`, URL-bearing → url required): accepted.
    const v2Alias = {
      name: 'remote-server',
      type: 'streamable-http',
      url: 'https://mcp.example.com/mcp',
    };
    expect(validateBase(v2Alias)).toBe(true);
    expect(upstreamBaseIssues(v2Alias)).toEqual([]);
  });

  it("the selector takes upstream's wire name `type`, not v1's `transport` (056 #2)", () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/mcp-config.v2.json'));
    const props = base['properties'] as Record<string, unknown>;
    expect(props['type']).toBeDefined();
    expect(props['transport']).toBeUndefined();
    expect([...MCP_TYPE_VALUES_V2]).toEqual(['stdio', 'http', 'streamable-http', 'sse', 'ws']);
  });
});

describe('mcp-config v2 — C3 PROOF (the relocated narrowing binds via overlay/composition, NOT base)', () => {
  it('a type-omitted artifact is v2-base-VALID but composition-INVALID (the explicit-`type` requirement lives in the overlay)', () => {
    const { type: _dropped, ...withoutType } = V2_VALID;
    // The v2 base mirrors upstream: `type` is optional (stdio default) — valid.
    expect(validateBase(withoutType)).toBe(true);
    expect(upstreamBaseIssues(withoutType)).toEqual([]);
    // The composition rejects: the RELOCATED flat all-required narrowing
    // (DR-062 C2 → overlay) demands an explicit `type`.
    expect(validateComposition(withoutType)).toBe(false);
    expect(McpConfigV2Schema.safeParse(withoutType).success).toBe(false);
  });

  it('an args/env-omitted stdio artifact is v2-base-VALID but composition-INVALID (flat requiredness is overlay policy)', () => {
    const minimalUpstream = {
      name: 'example-server',
      command: 'node',
      description: 'Minimal upstream-shaped entry.',
      version: '1.0.0',
      enabled: true,
      type: 'stdio',
    };
    expect(validateBase(minimalUpstream)).toBe(true);
    expect(upstreamBaseIssues(minimalUpstream)).toEqual([]);
    expect(validateComposition(minimalUpstream)).toBe(false);
    expect(McpConfigV2Schema.safeParse(minimalUpstream).success).toBe(false);
  });

  it('the relocated metadata extension binds via the overlay (DR-062 C3): non-object metadata rejected by composition', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/mcp-config.v2.json'));
    expect((base['properties'] as Record<string, unknown>)['metadata']).toBeUndefined();
    const overlay = loadJson(join(V2_DIR, 'is-overlay/mcp-config.v2.json'));
    expect((overlay['properties'] as Record<string, unknown>)['metadata']).toBeDefined();
    const bad = { ...V2_VALID, metadata: ['not', 'an', 'object'] };
    expect(validateComposition(bad)).toBe(false);
    expect(McpConfigV2Schema.safeParse(bad).success).toBe(false);
  });
});

describe('mcp-config v2 — per-transport conditional shapes (056 #4 adoption)', () => {
  it.each([
    ['stdio with command accepted', { name: 's', type: 'stdio', command: 'node' }, true],
    ['stdio missing command rejected', { name: 's', type: 'stdio' }, false],
    ['typeless missing command rejected', { name: 's' }, false],
    ['http with url accepted', { name: 's', type: 'http', url: 'https://x.example/mcp' }, true],
    ['http missing url rejected', { name: 's', type: 'http', command: 'node' }, false],
    ['sse with url accepted', { name: 's', type: 'sse', url: 'https://x.example/sse' }, true],
    ['ws with url accepted', { name: 's', type: 'ws', url: 'wss://x.example/socket' }, true],
    ['ws missing url rejected', { name: 's', type: 'ws' }, false],
    [
      'streamable-http missing url rejected',
      { name: 's', type: 'streamable-http', command: 'node' },
      false,
    ],
    ['invalid type rejected (enum)', { name: 's', type: 'carrier-pigeon', command: 'node' }, false],
  ])('base agrees (ajv + Zod) on: %s', (_label, artifact, expected) => {
    expect(validateBase(artifact), `ajv base: ${_label}`).toBe(expected);
    expect(upstreamBaseIssues(artifact).length === 0, `zod base: ${_label}`).toBe(expected);
  });
});

describe('mcp-config v2 — ajv ↔ Zod fold agreement on composition branches', () => {
  it.each([
    ['canonical stdio accepted', {}, true],
    ['empty args array accepted', { args: [] as unknown }, true],
    ['string args rejected', { args: 'server.js' }, false],
    ['empty command rejected', { command: '' }, false],
    ['non-string command rejected', { command: 1 }, false],
    ['env as array rejected', { env: [] as unknown }, false],
    ['non-string name rejected', { name: 7 }, false],
    ['empty name rejected', { name: '' }, false],
    ['uppercase name rejected', { name: 'Example-Server' }, false],
    ['over-long name rejected (base 64-char cap)', { name: 'a'.repeat(65) }, false],
    ['non-string description rejected', { description: 42 }, false],
    ['non-semver version rejected', { version: '1.0' }, false],
    ['non-string version rejected', { version: 42 }, false],
    ['prerelease semver accepted', { version: '1.0.0-rc.1' }, true],
    ['non-boolean enabled rejected', { enabled: 'true' }, false],
    ['metadata object accepted', { metadata: { 'intent-solutions': {} } }, true],
    ['non-object metadata rejected', { metadata: ['nope'] as unknown }, false],
    ['http with url accepted', { type: 'http', url: 'https://x.example/mcp' }, true],
    ['http without url rejected', { type: 'http' }, false],
    ['empty url rejected', { type: 'http', url: '' }, false],
    ['non-string url rejected', { type: 'http', url: 7 }, false],
    [
      'streamable-http alias with url accepted',
      { type: 'streamable-http', url: 'https://x.example' },
      true,
    ],
    ['ws with url accepted', { type: 'ws', url: 'wss://x.example/socket' }, true],
    ['invalid transport rejected', { type: 'carrier-pigeon' }, false],
    ['non-string type rejected', { type: 2 }, false],
    // v2 universal folds bind on this contract too
    ['description at the v2 1024 cap accepted', { description: 'x'.repeat(1024) }, true],
    ['description over the v2 1024 cap rejected', { description: 'x'.repeat(1025) }, false],
    ['shell substitution $( in description rejected', { description: 'Run $(whoami).' }, false],
    ['reserved-name substring claude rejected', { name: 'claude-server' }, false],
  ])('agree on: %s', (_label, patch, expected) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact), `ajv: ${_label}`).toBe(expected);
    expect(McpConfigV2Schema.safeParse(artifact).success, `zod: ${_label}`).toBe(expected);
  });

  it('the frozen v1 wire name `transport` does NOT satisfy the v2 required `type` (DR-062 breaking wire-name fix)', () => {
    const v1Shaped = {
      name: 'example-server',
      command: 'node',
      args: ['server.js'],
      transport: 'stdio',
      env: {},
      description: 'A v1-shaped entry.',
      version: '1.0.0',
      enabled: true,
    };
    expect(validateComposition(v1Shaped)).toBe(false);
    expect(McpConfigV2Schema.safeParse(v1Shaped).success).toBe(false);
  });
});

describe('mcp-config v2 — monotonicity (overlay strictly additive/narrowing on the v2 base)', () => {
  it('base required is exactly the upstream flat floor [name]', () => {
    expect([...MCP_CONFIG_V2_BASE_REQUIRED]).toEqual(['name']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/mcp-config.v2.json'));
    const overlay = loadJson(join(V2_DIR, 'is-overlay/mcp-config.v2.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['name']);
    expect(overlayReq).toEqual([
      'type',
      'command',
      'args',
      'env',
      'description',
      'version',
      'enabled',
    ]);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of MCP_CONFIG_V2_BASE_REQUIRED) {
      expect(MCP_CONFIG_V2_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field mcp set (v1 surface preserved modulo transport → type)', () => {
    expect([...MCP_CONFIG_V2_REQUIRED_FIELDS].sort()).toEqual(
      ['args', 'command', 'description', 'enabled', 'env', 'name', 'type', 'version'].sort(),
    );
    expect([...MCP_CONFIG_V2_OVERLAY_REQUIRED].sort()).toEqual(
      ['args', 'command', 'description', 'enabled', 'env', 'type', 'version'].sort(),
    );
  });

  it('refinement: every composition-valid fixture is valid under the v2 base alone', () => {
    for (const file of listJson('positive')) {
      const obj = fixture('positive', file);
      expect(validateComposition(obj)).toBe(true);
      expect(validateBase(obj), `positive/${file} must satisfy the base`).toBe(true);
    }
  });

  it('debacle guard: dropping any effective-required field invalidates the composition', () => {
    for (const field of MCP_CONFIG_V2_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...V2_VALID };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate (ajv)`).toBe(false);
      expect(
        McpConfigV2Schema.safeParse(dropped).success,
        `dropping "${field}" must invalidate (Zod)`,
      ).toBe(false);
    }
  });
});
