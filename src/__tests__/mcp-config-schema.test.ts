/**
 * mcp-config contract #4 — codegen-generated (DR-044 D8).
 *
 * Mirrors the contract-#1/#2 walking-skeleton tests, proving the three-artifact
 * base+overlay composition for mcp-config (the `.mcp.json` / plugin.json mcpServers
 * per-server entry shape):
 *   - the published schema is a PURE allOf of [upstream-base, universalFolds, is-overlay]
 *   - the JSON Schema (ajv) and the codegen-generated Zod mirror AGREE fold-for-fold
 *   - correctness against the 40-fixture corpus (22 valid accepted; 18 negative rejected)
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on the base
 *   - the effective-required manifest = base ∪ overlay = the IS 8-field mcp set
 *   - registered in index.json as contract #4 + exported from the validators barrel
 *
 * Upstream authority: modelcontextprotocol.io/specification (revision 2025-11-25 —
 * the ONE machine-readable upstream, schema.ts) + code.claude.com/docs/en/mcp
 * ('.mcp.json' standardized format). The base requires the launch surface
 * [name, command, args, transport, env]; the IS overlay adds three net-new
 * tracking/operational fields (description, version, enabled).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  McpConfigSchema,
  MCP_CONFIG_BASE_REQUIRED,
  MCP_CONFIG_OVERLAY_REQUIRED,
  MCP_CONFIG_REQUIRED_FIELDS,
} from '../validators/v1/authoring/mcp-config.js';

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
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v1/fixtures/mcp-config');
const BASE = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${BASE}/mcp-config.schema.json`;
const UPSTREAM_BASE_ID = `${BASE}/upstream-base/mcp-config.v1.json`;

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
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'upstream-base/mcp-config.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'is-overlay/mcp-config.v1.json')));
  ajv.addSchema(loadJson(join(AUTHORING_DIR, 'mcp-config.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
});

describe('mcp-config — composition is pure (zero authored fields)', () => {
  it('the published schema is exactly an allOf of the three layers', () => {
    const s = loadJson(join(AUTHORING_DIR, 'mcp-config.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(`${BASE}/marketplace-tier.schema.json#/$defs/universalFolds`);
    expect(allOf[2]?.$ref).toBe(`${BASE}/is-overlay/mcp-config.v1.json`);
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(AUTHORING_DIR, 'mcp-config.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in index.json as contract #4 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(AUTHORING_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['mcp-config'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(4);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });
});

describe('mcp-config — correctness against the 40-fixture corpus', () => {
  it('accepts every valid server (22/22 — 0 false-rejects)', () => {
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

describe('mcp-config — ajv ↔ Zod fold agreement (D8 backstop)', () => {
  it('the JSON Schema and the Zod mirror return the same verdict on all 40 fixtures', () => {
    for (const cls of ['positive', 'negative', 'edge'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = McpConfigSchema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });

  const valid = {
    name: 'example-server',
    command: 'node',
    args: ['server.js'],
    transport: 'stdio',
    env: {},
    description: 'A valid MCP server.',
    version: '1.0.0',
    enabled: true,
  };

  it.each([
    ['empty args array is accepted', { args: [] as unknown }, true],
    ['string args is rejected', { args: 'server.js' }, false],
    ['empty command is rejected', { command: '' }, false],
    ['non-string command is rejected', { command: 1 }, false],
    ['invalid transport is rejected', { transport: 'carrier-pigeon' }, false],
    ['non-string transport is rejected', { transport: 2 }, false],
    ['http transport is accepted', { transport: 'http' }, true],
    ['sse transport is accepted', { transport: 'sse' }, true],
    ['ws transport is accepted', { transport: 'ws' }, true],
    ['env as a non-object is rejected', { env: [] as unknown }, false],
    ['non-string name is rejected', { name: 7 }, false],
    ['empty name is rejected', { name: '' }, false],
    ['uppercase name is rejected', { name: 'Example-Server' }, false],
    ['over-long name is rejected (base 64-char cap)', { name: 'a'.repeat(65) }, false],
    ['non-string description is rejected', { description: 42 }, false],
    ['non-semver version is rejected', { version: '1.0' }, false],
    ['non-string version is rejected', { version: 1 }, false],
    ['prerelease semver version is accepted', { version: '1.0.0-rc.1' }, true],
    ['non-boolean enabled is rejected', { enabled: 'true' }, false],
    ['optional metadata object is accepted', { metadata: { 'intent-solutions': {} } }, true],
    ['metadata as a non-object is rejected', { metadata: ['nope'] as unknown }, false],
  ])('agree on extras: %s', (_label, patch, expected) => {
    const artifact = { ...valid, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact)).toBe(expected);
    expect(McpConfigSchema.safeParse(artifact).success).toBe(expected);
  });

  it('agrees on an over-budget description (universal disclosureMarkers fold, 1536)', () => {
    const bad = { ...valid, description: 'x'.repeat(1537) };
    expect(validateComposition(bad)).toBe(false);
    expect(McpConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe('mcp-config — monotonicity (overlay strictly additive/narrowing on base)', () => {
  it('base required is exactly the upstream launch surface', () => {
    expect([...MCP_CONFIG_BASE_REQUIRED]).toEqual(['name', 'command', 'args', 'transport', 'env']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(AUTHORING_DIR, 'upstream-base/mcp-config.v1.json'));
    const overlay = loadJson(join(AUTHORING_DIR, 'is-overlay/mcp-config.v1.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['name', 'command', 'args', 'transport', 'env']);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of MCP_CONFIG_BASE_REQUIRED) {
      expect(MCP_CONFIG_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field mcp set', () => {
    expect([...MCP_CONFIG_REQUIRED_FIELDS].sort()).toEqual(
      ['args', 'command', 'description', 'enabled', 'env', 'name', 'transport', 'version'].sort(),
    );
    expect([...MCP_CONFIG_OVERLAY_REQUIRED].sort()).toEqual(
      ['description', 'enabled', 'version'].sort(),
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
    const minimal = {
      name: 'example-server',
      command: 'node',
      args: [],
      transport: 'stdio',
      env: {},
    };
    expect(validateBase(minimal)).toBe(true);
    expect(validateComposition(minimal)).toBe(false);
  });

  it('debacle guard: dropping a required field invalidates the composition (never demoted to optional)', () => {
    const full = {
      name: 'example-server',
      command: 'node',
      args: ['server.js'],
      transport: 'stdio',
      env: {},
      description: 'A valid MCP server.',
      version: '1.0.0',
      enabled: true,
    };
    for (const field of MCP_CONFIG_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...full };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate`).toBe(false);
    }
  });
});
