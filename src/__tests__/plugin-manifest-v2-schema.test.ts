/**
 * plugin-manifest v2 — the DR-062 projection-mirrored base (tier-3 reconciliation).
 *
 * Proves the v2 contract whose upstream base is REGENERATED from the captured
 * projection (intent-eval-lab specs/_vendor/upstream/plugin-manifest/projection.json,
 * spec-projection/v1, spec_version unversioned-2026-06-12) per DR-062:
 *   - composition purity: the published v2 schema is a PURE allOf of the three
 *     v2 layers, with ZERO $ref into the frozen v1 family
 *   - C1 adoptions (058 #1/#3): the 11 unmodeled component-path fields
 *     (agents, channels, dependencies, experimental.monitors,
 *     experimental.themes, hooks, lspServers, mcpServers, outputStyles,
 *     skills, userConfig) + the documented metadata fields $schema,
 *     defaultEnabled, displayName join the base
 *   - C2 WIDENING PROOF (058 #2): the upstream wire form the v1 base REJECTED
 *     (`commands` as a bare string — the documented string|array union) is
 *     ACCEPTED by the v2 base; the array-only narrowing binds via the overlay
 *   - C3 PROOF (058 #4/#5): the relocated structural name encoding (kebab
 *     pattern + 64-char cap; prose-only upstream) and the relocated
 *     kernel-only `metadata` extension bind via the overlay/composition, NOT
 *     the base (base-valid, composition-invalid)
 *   - ajv ↔ Zod fold agreement on the v2 fixture corpus + branch probes (the
 *     D8 backstop)
 *   - the MONOTONICITY property: the overlay is strictly additive/narrowing on
 *     the v2 base; effective required = base ∪ overlay = the IS 8-field set
 *     (preserved from the v1 composition VERBATIM — the relocation changes
 *     WHERE the narrowings live, not what the composed tier requires)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PluginManifestV2Schema,
  PLUGIN_MANIFEST_V2_BASE_REQUIRED,
  PLUGIN_MANIFEST_V2_OVERLAY_REQUIRED,
  PLUGIN_MANIFEST_V2_REQUIRED_FIELDS,
  PLUGIN_NAME_PATTERN_V2,
  PLUGIN_NAME_MAX_V2,
} from '../validators/v1/authoring/v2/index.js';
import { upstreamBaseIssues } from '../validators/v1/authoring/v2/plugin-manifest.js';

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
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v2/fixtures/plugin-manifest');
const V2_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v2';
const V1_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${V2_BASE_URL}/plugin-manifest.schema.json`;
const UPSTREAM_BASE_ID = `${V2_BASE_URL}/upstream-base/plugin-manifest.v2.json`;

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
  ajv.addSchema(loadJson(join(V2_DIR, 'upstream-base/plugin-manifest.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'is-overlay/plugin-manifest.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'plugin-manifest.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
  // The FROZEN v1 base, loaded read-only as the C2-widening reference point.
  const ajvV1 = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajvV1);
  ajvV1.addSchema(loadJson(join(V1_DIR, 'upstream-base/plugin-manifest.v1.json')));
  validateV1Base = ajvV1.getSchema(`${V1_BASE_URL}/upstream-base/plugin-manifest.v1.json`)!;
});

const V2_VALID = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'A valid example plugin manifest for the v2 fixture corpus.',
  author: {
    name: 'Intent Solutions',
    email: 'dev@intentsolutions.io',
    url: 'https://intentsolutions.io',
  },
  homepage: 'https://example.com/docs',
  license: 'Apache-2.0',
  keywords: ['example', 'testing'],
  commands: ['./commands/example.md'],
};

describe('plugin-manifest v2 — composition is pure (zero authored fields, zero v1 $ref)', () => {
  it('the published v2 schema is exactly an allOf of the three v2 layers', () => {
    const s = loadJson(join(V2_DIR, 'plugin-manifest.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(
      `${V2_BASE_URL}/marketplace-tier.schema.json#/$defs/universalFolds`,
    );
    expect(allOf[2]?.$ref).toBe(`${V2_BASE_URL}/is-overlay/plugin-manifest.v2.json`);
  });

  it('NO plugin-manifest v2 schema file contains a $ref into the v1 family', () => {
    for (const file of [
      'plugin-manifest.schema.json',
      'upstream-base/plugin-manifest.v2.json',
      'is-overlay/plugin-manifest.v2.json',
      'index.json',
    ]) {
      const raw = readFileSync(join(V2_DIR, file), 'utf-8');
      expect(raw, `${file} must not reference authoring/v1`).not.toContain('/authoring/v1/');
    }
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(V2_DIR, 'plugin-manifest.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in v2 index.json as contract #2 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(V2_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['plugin-manifest'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(2);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });

  it('the base $comment cites the projection (path + sha256) and DR-062', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/plugin-manifest.v2.json'));
    const comment = base['$comment'] as string;
    expect(comment).toContain('specs/_vendor/upstream/plugin-manifest/projection.json');
    expect(comment).toContain('a6a67a15e5ddc67c9797e1264481124f42dcf0187e4b85ffea5e27bfad56d632');
    expect(comment).toContain('062-AT-DECR');
  });

  it('never references labs.intentsolutions.io (CISO binding DR-004 + DR-010)', () => {
    for (const file of [
      'plugin-manifest.schema.json',
      'upstream-base/plugin-manifest.v2.json',
      'is-overlay/plugin-manifest.v2.json',
    ]) {
      expect(JSON.stringify(loadJson(join(V2_DIR, file)))).not.toContain('labs.intentsolutions.io');
    }
  });
});

describe('plugin-manifest v2 — fixture corpus (composition)', () => {
  it('accepts every positive fixture (ajv + Zod agree)', () => {
    for (const file of listJson('positive')) {
      const obj = fixture('positive', file);
      expect(validateComposition(obj), `positive/${file} (ajv) should accept`).toBe(true);
      expect(
        PluginManifestV2Schema.safeParse(obj).success,
        `positive/${file} (Zod) should accept`,
      ).toBe(true);
    }
  });

  it('rejects every negative fixture (ajv + Zod agree)', () => {
    for (const file of listJson('negative')) {
      const obj = fixture('negative', file);
      expect(validateComposition(obj), `negative/${file} (ajv) should reject`).toBe(false);
      expect(
        PluginManifestV2Schema.safeParse(obj).success,
        `negative/${file} (Zod) should reject`,
      ).toBe(false);
    }
  });

  it('ajv and Zod return the same verdict on every fixture (D8 backstop)', () => {
    for (const cls of ['positive', 'negative'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = PluginManifestV2Schema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });
});

describe('plugin-manifest v2 — C1 adoptions + C2 WIDENING PROOF (058 #1/#2/#3)', () => {
  it('`commands` as a bare string (the documented string|array union) — v1 base rejected it, v2 base accepts it (058 #2)', () => {
    // Upstream documents commands as string|array; the v1 base hard-coded the
    // array-only form — an IS projection choice DR-062 relocates to the overlay.
    const stringForm = { name: 'example-plugin', commands: './commands/example.md' };
    expect(validateV1Base(stringForm)).toBe(false);
    // The v2 base mirrors the projection: accepted (ajv AND the generated Zod).
    expect(validateBase(stringForm)).toBe(true);
    expect(upstreamBaseIssues(stringForm)).toEqual([]);
  });

  it('the 13 newly-adopted documented fields exist in the v2 base and were absent from the v1 base (058 #1 + #3)', () => {
    const v1Props = loadJson(join(V1_DIR, 'upstream-base/plugin-manifest.v1.json'))[
      'properties'
    ] as Record<string, unknown>;
    const v2Props = loadJson(join(V2_DIR, 'upstream-base/plugin-manifest.v2.json'))[
      'properties'
    ] as Record<string, unknown>;
    // 058 #1: the component-path fields (experimental.monitors +
    // experimental.themes fold into the one `experimental` object property);
    // 058 #3: the documented metadata fields $schema/defaultEnabled/displayName.
    const adopted = [
      '$schema',
      'defaultEnabled',
      'displayName',
      'agents',
      'channels',
      'dependencies',
      'experimental',
      'hooks',
      'lspServers',
      'mcpServers',
      'outputStyles',
      'skills',
      'userConfig',
    ];
    for (const field of adopted) {
      expect(v2Props[field], `v2 base must model ${field}`).toBeDefined();
      expect(v1Props[field], `v1 base must NOT have modeled ${field}`).toBeUndefined();
    }
  });

  it('a fully component-pathed manifest satisfies the v2 base (ajv + Zod agree)', () => {
    const obj = fixture('positive', 'v2-canonical-component-paths.json');
    expect(validateBase(obj)).toBe(true);
    expect(upstreamBaseIssues(obj as Record<string, unknown>)).toEqual([]);
  });
});

describe('plugin-manifest v2 — C3 PROOF (the relocated narrowings bind via overlay/composition, NOT base)', () => {
  it('a non-kebab name is v2-base-VALID but composition-INVALID (the structural encoding lives in the overlay — 058 #5)', () => {
    // Upstream documents kebab-case in PROSE only — the v2 base types name as
    // a bare string, so the uppercase form passes the base.
    const nonKebab = { ...V2_VALID, name: 'Example-Plugin' };
    expect(validateBase(nonKebab)).toBe(true);
    expect(upstreamBaseIssues(nonKebab)).toEqual([]);
    // The composition rejects: the RELOCATED kebab pattern binds via the overlay.
    expect(validateComposition(nonKebab)).toBe(false);
    expect(PluginManifestV2Schema.safeParse(nonKebab).success).toBe(false);
  });

  it('an over-long name is v2-base-VALID but composition-INVALID (the 64-char cap lives in the overlay — 058 #5)', () => {
    const overLong = { ...V2_VALID, name: 'a'.repeat(65) };
    expect(validateBase(overLong)).toBe(true);
    expect(upstreamBaseIssues(overLong)).toEqual([]);
    expect(validateComposition(overLong)).toBe(false);
    expect(PluginManifestV2Schema.safeParse(overLong).success).toBe(false);
  });

  it('the exported structural-name constants mirror the overlay JSON (single-sourced narrowing)', () => {
    const overlay = loadJson(join(V2_DIR, 'is-overlay/plugin-manifest.v2.json'));
    const nameRule = (overlay['properties'] as Record<string, Record<string, unknown>>)['name']!;
    expect(nameRule['pattern']).toBe(PLUGIN_NAME_PATTERN_V2.source);
    expect(nameRule['maxLength']).toBe(PLUGIN_NAME_MAX_V2);
  });

  it('`commands` as a string is v2-base-VALID but composition-INVALID (the relocated array narrowing — 058 #2)', () => {
    const stringCommands = { ...V2_VALID, commands: './commands/example.md' };
    expect(validateBase(stringCommands)).toBe(true);
    expect(upstreamBaseIssues(stringCommands)).toEqual([]);
    expect(validateComposition(stringCommands)).toBe(false);
    expect(PluginManifestV2Schema.safeParse(stringCommands).success).toBe(false);
  });

  it('the relocated metadata extension binds via the overlay (058 #4): non-object metadata rejected by composition', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/plugin-manifest.v2.json'));
    expect((base['properties'] as Record<string, unknown>)['metadata']).toBeUndefined();
    const overlay = loadJson(join(V2_DIR, 'is-overlay/plugin-manifest.v2.json'));
    expect((overlay['properties'] as Record<string, unknown>)['metadata']).toBeDefined();
    const bad = { ...V2_VALID, metadata: ['not', 'an', 'object'] };
    expect(validateComposition(bad)).toBe(false);
    expect(PluginManifestV2Schema.safeParse(bad).success).toBe(false);
  });
});

describe('plugin-manifest v2 — documented wire forms at the base (058 #1 unions)', () => {
  it.each([
    ['the upstream floor: a name-only manifest accepted', { name: 'x' }, true],
    ['agents as a string accepted', { name: 'x', agents: './agents/a.md' }, true],
    ['agents as an array accepted', { name: 'x', agents: ['./agents/a.md'] }, true],
    ['agents as a number rejected', { name: 'x', agents: 7 }, false],
    ['hooks as an inline object accepted', { name: 'x', hooks: { PreToolUse: [] } }, true],
    ['hooks as a number rejected', { name: 'x', hooks: 7 }, false],
    ['mcpServers as a string accepted', { name: 'x', mcpServers: './.mcp.json' }, true],
    ['mcpServers as a number rejected', { name: 'x', mcpServers: 7 }, false],
    ['channels as an array accepted', { name: 'x', channels: [] }, true],
    ['channels as an object rejected', { name: 'x', channels: {} }, false],
    ['dependencies as an object rejected', { name: 'x', dependencies: {} }, false],
    ['userConfig as an object accepted', { name: 'x', userConfig: {} }, true],
    ['userConfig as an array rejected', { name: 'x', userConfig: [] }, false],
    [
      'experimental.monitors as a string accepted',
      { name: 'x', experimental: { monitors: './m.md' } },
      true,
    ],
    [
      'experimental.themes as a non-string-non-array rejected',
      { name: 'x', experimental: { themes: 7 } },
      false,
    ],
    ['experimental as an array rejected', { name: 'x', experimental: [] }, false],
    [
      'keywords as a bare string rejected (documented load error)',
      { name: 'x', keywords: 'tag' },
      false,
    ],
    ['author missing its inner name rejected', { name: 'x', author: {} }, false],
    ['author as a string rejected', { name: 'x', author: 'Jane' }, false],
    ['defaultEnabled as a string rejected', { name: 'x', defaultEnabled: 'yes' }, false],
    ['$schema as a number rejected', { name: 'x', $schema: 7 }, false],
    ['displayName as a number rejected', { name: 'x', displayName: 7 }, false],
  ])('base agrees (ajv + Zod) on: %s', (_label, artifact, expected) => {
    expect(validateBase(artifact), `ajv base: ${_label}`).toBe(expected);
    expect(upstreamBaseIssues(artifact).length === 0, `zod base: ${_label}`).toBe(expected);
  });
});

describe('plugin-manifest v2 — ajv ↔ Zod fold agreement on composition branches', () => {
  it.each([
    ['canonical manifest accepted', {}, true],
    ['unrecognized top-level field accepted (upstream: ignored)', { futureField: 42 }, true],
    ['non-string name rejected', { name: 7 }, false],
    ['empty name rejected', { name: '' }, false],
    ['uppercase name rejected', { name: 'Example-Plugin' }, false],
    ['over-long name rejected (overlay 64-char cap)', { name: 'a'.repeat(65) }, false],
    ['64-char kebab name accepted', { name: 'a'.repeat(64) }, true],
    ['name with spaces rejected', { name: 'example plugin' }, false],
    ['non-semver version rejected', { version: '1.0' }, false],
    ['prerelease semver accepted', { version: '1.0.0-rc.1' }, true],
    ['non-string description rejected', { description: 42 }, false],
    ['author missing inner name rejected', { author: {} }, false],
    ['author as a string rejected', { author: 'Jane' }, false],
    ['non-uri homepage rejected', { homepage: 'not-a-uri' }, false],
    ['repository uri accepted', { repository: 'https://github.com/example/example-plugin' }, true],
    ['non-string license rejected', { license: 7 }, false],
    ['keywords as a bare string rejected', { keywords: 'tag' }, false],
    ['keywords with a non-string item rejected', { keywords: [1] as unknown }, false],
    ['empty commands array accepted', { commands: [] as unknown }, true],
    ['string commands rejected (overlay array narrowing)', { commands: './c.md' }, false],
    ['commands with a non-string item rejected', { commands: [1] as unknown }, false],
    ['agents string component path accepted', { agents: './agents/a.md' }, true],
    ['hooks inline object accepted', { hooks: { PreToolUse: [] } }, true],
    ['mcpServers as a number rejected', { mcpServers: 7 }, false],
    ['defaultEnabled boolean accepted', { defaultEnabled: false }, true],
    ['defaultEnabled string rejected', { defaultEnabled: 'yes' }, false],
    ['metadata object accepted', { metadata: { 'intent-solutions': {} } }, true],
    ['non-object metadata rejected', { metadata: ['nope'] as unknown }, false],
    // v2 universal folds bind on this contract too
    ['description at the v2 1024 cap accepted', { description: 'x'.repeat(1024) }, true],
    ['description over the v2 1024 cap rejected', { description: 'x'.repeat(1025) }, false],
    ['shell substitution $( in description rejected', { description: 'Run $(whoami).' }, false],
    ['reserved-name substring claude rejected', { name: 'claude-plugin' }, false],
  ])('agree on: %s', (_label, patch, expected) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact), `ajv: ${_label}`).toBe(expected);
    expect(PluginManifestV2Schema.safeParse(artifact).success, `zod: ${_label}`).toBe(expected);
  });
});

describe('plugin-manifest v2 — monotonicity (overlay strictly additive/narrowing on the v2 base)', () => {
  it('base required is exactly the upstream floor [name]', () => {
    expect([...PLUGIN_MANIFEST_V2_BASE_REQUIRED]).toEqual(['name']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/plugin-manifest.v2.json'));
    const overlay = loadJson(join(V2_DIR, 'is-overlay/plugin-manifest.v2.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['name']);
    expect(overlayReq).toEqual([
      'version',
      'description',
      'author',
      'homepage',
      'license',
      'keywords',
      'commands',
    ]);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of PLUGIN_MANIFEST_V2_BASE_REQUIRED) {
      expect(PLUGIN_MANIFEST_V2_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field plugin set (v1 composed surface preserved verbatim)', () => {
    expect([...PLUGIN_MANIFEST_V2_REQUIRED_FIELDS].sort()).toEqual(
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
    expect([...PLUGIN_MANIFEST_V2_OVERLAY_REQUIRED].sort()).toEqual(
      ['author', 'commands', 'description', 'homepage', 'keywords', 'license', 'version'].sort(),
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
    for (const field of PLUGIN_MANIFEST_V2_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...V2_VALID };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate (ajv)`).toBe(false);
      expect(
        PluginManifestV2Schema.safeParse(dropped).success,
        `dropping "${field}" must invalidate (Zod)`,
      ).toBe(false);
    }
  });
});
