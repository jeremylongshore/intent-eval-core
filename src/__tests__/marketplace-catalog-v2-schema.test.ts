/**
 * marketplace-catalog v2 — the DR-062 projection-mirrored base (tier-3 reconciliation).
 *
 * Proves the v2 contract whose upstream base is REGENERATED from the captured
 * projection (intent-eval-lab specs/_vendor/upstream/marketplace-catalog/projection.json,
 * spec-projection/v1, spec_version unversioned-2026-06-12) per DR-062:
 *   - composition purity: the published v2 schema is a PURE allOf of the three
 *     v2 layers, with ZERO $ref into the frozen v1 family
 *   - C1 adoptions (061 #2/#3/#4): the documented top-level optionals (incl.
 *     the upstream-documented `metadata` surface), all 18 documented
 *     plugin-entry optionals, and the 5 documented source forms join the base;
 *     the doc's 14 reserved names adopt as a negated enum (the 061 #5 carve-out)
 *   - BASE-WIDENING PROOF (the C3 relocations, 061 #1/#5): the upstream-legal
 *     wire forms the v1 base REJECTED (an empty `plugins` array — the doc
 *     states no minimum — and a non-kebab `name` — kebab-case is prose-only)
 *     are ACCEPTED by the v2 base
 *   - C3 PROOF: the relocated narrowings (plugins minItems 1, kebab name
 *     pattern + 64-char cap) bind via the overlay/composition, NOT the base
 *     (base-valid, composition-invalid)
 *   - C4 NON-ADOPTION + depth boundary: the per-entry source forms are
 *     ajv-enforced (the generated Zod layer checks the entry floor only)
 *   - ajv ↔ Zod fold agreement on the v2 fixture corpus + top-level branch
 *     probes (the D8 backstop)
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
  MarketplaceCatalogV2Schema,
  MARKETPLACE_CATALOG_V2_BASE_REQUIRED,
  MARKETPLACE_CATALOG_V2_OVERLAY_REQUIRED,
  MARKETPLACE_CATALOG_V2_REQUIRED_FIELDS,
  MARKETPLACE_NAME_RESERVED_V2,
} from '../validators/v1/authoring/v2/index.js';
import { upstreamBaseIssues } from '../validators/v1/authoring/v2/marketplace-catalog.js';

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
const FIXTURE_DIR = join(__dirname, '../../tests/authoring/v2/fixtures/marketplace-catalog');
const V2_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v2';
const V1_BASE_URL = 'https://github.com/jeremylongshore/intent-eval-core/schemas/authoring/v1';
const COMPOSITION_ID = `${V2_BASE_URL}/marketplace-catalog.schema.json`;
const UPSTREAM_BASE_ID = `${V2_BASE_URL}/upstream-base/marketplace-catalog.v2.json`;

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
  ajv.addSchema(loadJson(join(V2_DIR, 'upstream-base/marketplace-catalog.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'is-overlay/marketplace-catalog.v2.json')));
  ajv.addSchema(loadJson(join(V2_DIR, 'marketplace-catalog.schema.json')));
  validateComposition = ajv.getSchema(COMPOSITION_ID)!;
  validateBase = ajv.getSchema(UPSTREAM_BASE_ID)!;
  // The FROZEN v1 base, loaded read-only as the base-widening reference point.
  const ajvV1 = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  addFormats(ajvV1);
  ajvV1.addSchema(loadJson(join(V1_DIR, 'upstream-base/marketplace-catalog.v1.json')));
  validateV1Base = ajvV1.getSchema(`${V1_BASE_URL}/upstream-base/marketplace-catalog.v1.json`)!;
});

const V2_VALID = {
  name: 'example-marketplace',
  owner: { name: 'Example Maintainers', email: 'maintainers@example.com' },
  plugins: [{ name: 'alpha-tools', source: './plugins/alpha-tools' }],
  version: '1.0.0',
  description: 'A valid marketplace catalog.',
  license: 'Apache-2.0',
  homepage: 'https://github.com/example/marketplace',
  keywords: ['plugins', 'marketplace'],
};

describe('marketplace-catalog v2 — composition is pure (zero authored fields, zero v1 $ref)', () => {
  it('the published v2 schema is exactly an allOf of the three v2 layers', () => {
    const s = loadJson(join(V2_DIR, 'marketplace-catalog.schema.json'));
    expect(s['$id']).toBe(COMPOSITION_ID);
    expect(s['properties']).toBeUndefined();
    expect(s['required']).toBeUndefined();
    const allOf = s['allOf'] as { $ref: string }[];
    expect(allOf).toHaveLength(3);
    expect(allOf[0]?.$ref).toBe(UPSTREAM_BASE_ID);
    expect(allOf[1]?.$ref).toBe(
      `${V2_BASE_URL}/marketplace-tier.schema.json#/$defs/universalFolds`,
    );
    expect(allOf[2]?.$ref).toBe(`${V2_BASE_URL}/is-overlay/marketplace-catalog.v2.json`);
  });

  it('NO marketplace-catalog v2 schema file contains a $ref into the v1 family', () => {
    for (const file of [
      'marketplace-catalog.schema.json',
      'upstream-base/marketplace-catalog.v2.json',
      'is-overlay/marketplace-catalog.v2.json',
      'index.json',
    ]) {
      const raw = readFileSync(join(V2_DIR, file), 'utf-8');
      expect(raw, `${file} must not reference authoring/v1`).not.toContain('/authoring/v1/');
    }
  });

  it('carries the generated effective-required manifest in $comment', () => {
    const s = loadJson(join(V2_DIR, 'marketplace-catalog.schema.json'));
    const comment = s['$comment'] as string;
    expect(comment).toContain('EFFECTIVE-REQUIRED MANIFEST');
    expect(comment).toContain('INHERITED');
    expect(comment).toContain('REQUIRED HERE');
  });

  it('is registered in v2 index.json as contract #6 (lifecycle SHIPPED-INTERNAL)', () => {
    const idx = loadJson(join(V2_DIR, 'index.json'));
    const entry = (
      idx['schemas'] as Record<string, { kind: string; contractIndex: number; lifecycle: string }>
    )['marketplace-catalog'];
    expect(entry?.kind).toBe('authoring-contract');
    expect(entry?.contractIndex).toBe(6);
    expect(entry?.lifecycle).toBe('SHIPPED-INTERNAL');
  });

  it('the base $comment cites the projection (path + sha256) and DR-062', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/marketplace-catalog.v2.json'));
    const comment = base['$comment'] as string;
    expect(comment).toContain('specs/_vendor/upstream/marketplace-catalog/projection.json');
    expect(comment).toContain('01d24b5332c29397636fe34265e82e232c5f48722706fbaadec1846dec664092');
    expect(comment).toContain('062-AT-DECR');
  });

  it('never references labs.intentsolutions.io (CISO binding DR-004 + DR-010)', () => {
    for (const file of [
      'marketplace-catalog.schema.json',
      'upstream-base/marketplace-catalog.v2.json',
      'is-overlay/marketplace-catalog.v2.json',
    ]) {
      expect(JSON.stringify(loadJson(join(V2_DIR, file)))).not.toContain('labs.intentsolutions.io');
    }
  });
});

describe('marketplace-catalog v2 — fixture corpus (composition)', () => {
  it('accepts every positive fixture (ajv + Zod agree)', () => {
    for (const file of listJson('positive')) {
      const obj = fixture('positive', file);
      expect(validateComposition(obj), `positive/${file} (ajv) should accept`).toBe(true);
      expect(
        MarketplaceCatalogV2Schema.safeParse(obj).success,
        `positive/${file} (Zod) should accept`,
      ).toBe(true);
    }
  });

  it('rejects every negative fixture (ajv + Zod agree)', () => {
    for (const file of listJson('negative')) {
      const obj = fixture('negative', file);
      expect(validateComposition(obj), `negative/${file} (ajv) should reject`).toBe(false);
      expect(
        MarketplaceCatalogV2Schema.safeParse(obj).success,
        `negative/${file} (Zod) should reject`,
      ).toBe(false);
    }
  });

  it('ajv and Zod return the same verdict on every fixture (D8 backstop)', () => {
    for (const cls of ['positive', 'negative'] as const) {
      for (const file of listJson(cls)) {
        const obj = fixture(cls, file);
        const ajvVerdict = validateComposition(obj);
        const zodVerdict = MarketplaceCatalogV2Schema.safeParse(obj).success;
        expect(zodVerdict, `${cls}/${file}: ajv=${ajvVerdict} zod=${zodVerdict}`).toBe(ajvVerdict);
      }
    }
  });
});

describe('marketplace-catalog v2 — BASE-WIDENING PROOF (061 #1/#5 relocations: v1-base-rejected wire forms, v2-base-accepted)', () => {
  it('an EMPTY plugins array (the doc states no minimum) — v1 base rejected it, v2 base accepts it', () => {
    // The frozen v1 base carried the corpus-rationalized minItems 1 — the IS
    // projection choice DR-062 relocates (061 #1) — so it REJECTED this
    // upstream-legal wire form.
    const emptyCatalog = { name: 'example-marketplace', owner: { name: 'Ex' }, plugins: [] };
    expect(validateV1Base(emptyCatalog)).toBe(false);
    // The v2 base mirrors the projection: accepted (ajv AND the generated Zod).
    expect(validateBase(emptyCatalog)).toBe(true);
    expect(upstreamBaseIssues(emptyCatalog)).toEqual([]);
  });

  it('a non-kebab name (kebab-case is PROSE-ONLY upstream) — v1 base rejected it, v2 base accepts it', () => {
    const prosey = {
      name: 'My Marketplace',
      owner: { name: 'Ex' },
      plugins: [{ name: 'alpha-tools', source: './plugins/alpha-tools' }],
    };
    // The frozen v1 base hard-coded the kebab pattern + 64-char cap (061 #5).
    expect(validateV1Base(prosey)).toBe(false);
    // The v2 base mirrors the projection: a bare string passes the base.
    expect(validateBase(prosey)).toBe(true);
    expect(upstreamBaseIssues(prosey)).toEqual([]);
  });

  it('the 061 #5 CARVE-OUT: a documented RESERVED name — v1 base accepted it, v2 base REJECTS it (ajv + Zod)', () => {
    // 'life-sciences' is on the doc's 14-name reserved list but carries no
    // claude/anthropic substring — only the documented blocklist catches it.
    const reserved = { ...V2_VALID, name: 'life-sciences' };
    expect(validateV1Base(reserved)).toBe(true);
    expect(validateBase(reserved)).toBe(false);
    expect(upstreamBaseIssues(reserved).length).toBeGreaterThan(0);
    expect([...MARKETPLACE_NAME_RESERVED_V2]).toHaveLength(14);
    expect([...MARKETPLACE_NAME_RESERVED_V2]).toContain('life-sciences');
  });

  it('the documented source forms are now MODELED (061 #4): a malformed object source — v1 base accepted it, v2 base rejects it', () => {
    // The v1 base required `source` presence but gave it NO schema; the v2
    // base adopts the 5 documented forms, so a github source without `repo`
    // now fails the base (ajv — per-entry depth boundary).
    const badSource = {
      name: 'example-marketplace',
      owner: { name: 'Ex' },
      plugins: [{ name: 'alpha-tools', source: { source: 'github' } }],
    };
    expect(validateV1Base(badSource)).toBe(true);
    expect(validateBase(badSource)).toBe(false);
    const v1Base = loadJson(join(V1_DIR, 'upstream-base/marketplace-catalog.v1.json'));
    const v2Base = loadJson(join(V2_DIR, 'upstream-base/marketplace-catalog.v2.json'));
    const itemProps = (p: Record<string, unknown>): Record<string, unknown> =>
      (
        (p['properties'] as Record<string, Record<string, unknown>>)['plugins']?.['items'] as
          | { properties?: Record<string, unknown> }
          | undefined
      )?.properties ?? {};
    expect(itemProps(v1Base)['source']).toBeUndefined();
    expect(itemProps(v2Base)['source']).toBeDefined();
  });
});

describe('marketplace-catalog v2 — C3 PROOF (the relocated narrowings bind via overlay/composition, NOT base)', () => {
  it('an empty-plugins catalog is v2-base-VALID but composition-INVALID (minItems 1 lives in the overlay — 061 #1)', () => {
    const emptied = { ...V2_VALID, plugins: [] as unknown[] };
    expect(validateBase(emptied)).toBe(true);
    expect(upstreamBaseIssues(emptied)).toEqual([]);
    expect(validateComposition(emptied)).toBe(false);
    expect(MarketplaceCatalogV2Schema.safeParse(emptied).success).toBe(false);
  });

  it('a non-kebab name is v2-base-VALID but composition-INVALID (the kebab pattern + cap live in the overlay — 061 #5)', () => {
    const prosey = { ...V2_VALID, name: 'not kebab case' };
    expect(validateBase(prosey)).toBe(true);
    expect(upstreamBaseIssues(prosey)).toEqual([]);
    expect(validateComposition(prosey)).toBe(false);
    expect(MarketplaceCatalogV2Schema.safeParse(prosey).success).toBe(false);
  });

  it('the overlay carries NO metadata entry — the documented metadata surface lives in the BASE (061 #2)', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/marketplace-catalog.v2.json'));
    const overlay = loadJson(join(V2_DIR, 'is-overlay/marketplace-catalog.v2.json'));
    expect((base['properties'] as Record<string, unknown>)['metadata']).toBeDefined();
    expect((overlay['properties'] as Record<string, unknown>)['metadata']).toBeUndefined();
    const bad = { ...V2_VALID, metadata: ['not', 'an', 'object'] };
    expect(validateComposition(bad)).toBe(false);
    expect(MarketplaceCatalogV2Schema.safeParse(bad).success).toBe(false);
  });
});

describe('marketplace-catalog v2 — per-source-form conditional shapes (061 #4 adoption; ajv — depth boundary)', () => {
  const catalog = (source: unknown): Record<string, unknown> => ({
    name: 'example-marketplace',
    owner: { name: 'Ex' },
    plugins: [{ name: 'alpha-tools', source }],
  });

  it.each([
    ['relative-path string accepted', './plugins/alpha-tools', true],
    ['non-./-prefixed string rejected', 'plugins/alpha-tools', false],
    ['github with repo accepted', { source: 'github', repo: 'example/alpha' }, true],
    ['github missing repo rejected', { source: 'github' }, false],
    ['url with url accepted', { source: 'url', url: 'https://git.example.com/a.git' }, true],
    ['url missing url rejected', { source: 'url' }, false],
    [
      'git-subdir with path+url accepted',
      { source: 'git-subdir', url: 'https://github.com/example/mono.git', path: 'plugins/a' },
      true,
    ],
    [
      'git-subdir missing path rejected',
      { source: 'git-subdir', url: 'https://github.com/example/mono.git' },
      false,
    ],
    ['npm with package accepted', { source: 'npm', package: '@example/a' }, true],
    ['npm missing package rejected', { source: 'npm' }, false],
    ['unknown source type rejected', { source: 'carrier-pigeon' }, false],
    ['discriminator-less object rejected', { repo: 'example/alpha' }, false],
  ])('base (ajv) agrees on: %s', (_label, source, expected) => {
    expect(validateBase(catalog(source)), _label).toBe(expected);
  });

  it('the generated Zod layer checks the entry floor only (depth boundary — the hook-config posture)', () => {
    // A malformed source form fails ajv (above) but passes the generated Zod
    // base, whose plugins check is the entry floor [name, source] — the
    // documented depth boundary.
    expect(upstreamBaseIssues(catalog({ source: 'github' }))).toEqual([]);
    // The entry FLOOR is Zod-checked: a source-less entry fails both layers.
    const floorless = {
      name: 'example-marketplace',
      owner: { name: 'Ex' },
      plugins: [{ name: 'alpha-tools' }],
    };
    expect(validateBase(floorless)).toBe(false);
    expect(upstreamBaseIssues(floorless).length).toBeGreaterThan(0);
  });
});

describe('marketplace-catalog v2 — ajv ↔ Zod fold agreement on composition branches (top-level surface)', () => {
  it.each([
    ['canonical catalog accepted', {}, true],
    ['non-string name rejected', { name: 7 }, false],
    ['reserved name rejected (base blocklist)', { name: 'agent-skills' }, false],
    ['uppercase name rejected (overlay kebab)', { name: 'Example-Marketplace' }, false],
    ['over-long name rejected (overlay 64-char cap)', { name: 'a'.repeat(65) }, false],
    ['owner as bare string rejected', { owner: 'Example Maintainers' }, false],
    ['owner missing inner name rejected', { owner: { email: 'x@example.com' } }, false],
    ['plugins as bare string rejected', { plugins: 'alpha-tools' }, false],
    ['plugins empty rejected (overlay minItems)', { plugins: [] as unknown }, false],
    ['plugins non-object entry rejected', { plugins: ['alpha-tools'] }, false],
    [
      'plugins entry missing source rejected',
      { plugins: [{ name: 'alpha-tools' }] as unknown },
      false,
    ],
    [
      'plugins entry missing name rejected',
      { plugins: [{ source: './plugins/alpha-tools' }] as unknown },
      false,
    ],
    ['non-semver version rejected', { version: '1.0' }, false],
    ['prerelease semver accepted', { version: '1.0.0-rc.1' }, true],
    ['non-string description rejected', { description: 42 }, false],
    ['non-string license rejected', { license: 7 }, false],
    ['non-uri homepage rejected', { homepage: 'not a uri at all' }, false],
    ['string keywords rejected', { keywords: 'plugins' }, false],
    ['metadata object accepted', { metadata: { pluginRoot: './plugins' } }, true],
    ['non-object metadata rejected', { metadata: ['nope'] as unknown }, false],
    ['non-string $schema rejected', { $schema: 7 }, false],
    [
      'allowCrossMarketplaceDependenciesOn array accepted',
      { allowCrossMarketplaceDependenciesOn: ['partner-marketplace'] as unknown },
      true,
    ],
    [
      'non-array allowCrossMarketplaceDependenciesOn rejected',
      { allowCrossMarketplaceDependenciesOn: 'partner-marketplace' },
      false,
    ],
    // v2 universal folds bind on this contract too
    ['description at the v2 1024 cap accepted', { description: 'x'.repeat(1024) }, true],
    ['description over the v2 1024 cap rejected', { description: 'x'.repeat(1025) }, false],
    ['shell substitution $( in description rejected', { description: 'Run $(whoami).' }, false],
    ['reserved-name substring claude rejected', { name: 'claude-extras' }, false],
  ])('agree on: %s', (_label, patch, expected) => {
    const artifact = { ...V2_VALID, ...(patch as Record<string, unknown>) };
    expect(validateComposition(artifact), `ajv: ${_label}`).toBe(expected);
    expect(MarketplaceCatalogV2Schema.safeParse(artifact).success, `zod: ${_label}`).toBe(expected);
  });
});

describe('marketplace-catalog v2 — monotonicity (overlay strictly additive/narrowing on the v2 base)', () => {
  it('base required is exactly the upstream standardFloor [name, owner, plugins]', () => {
    expect([...MARKETPLACE_CATALOG_V2_BASE_REQUIRED]).toEqual(['name', 'owner', 'plugins']);
  });

  it('the JSON base + overlay required arrays are disjoint (pure addition, no re-declaration)', () => {
    const base = loadJson(join(V2_DIR, 'upstream-base/marketplace-catalog.v2.json'));
    const overlay = loadJson(join(V2_DIR, 'is-overlay/marketplace-catalog.v2.json'));
    const baseReq = base['required'] as string[];
    const overlayReq = overlay['required'] as string[];
    expect(baseReq).toEqual(['name', 'owner', 'plugins']);
    expect(overlayReq).toEqual(['version', 'description', 'license', 'homepage', 'keywords']);
    expect(baseReq.some((f) => overlayReq.includes(f))).toBe(false);
  });

  it('composition required ⊇ base required (overlay only ADDS)', () => {
    for (const f of MARKETPLACE_CATALOG_V2_BASE_REQUIRED) {
      expect(MARKETPLACE_CATALOG_V2_REQUIRED_FIELDS).toContain(f);
    }
  });

  it('effective required = base ∪ overlay = the IS 8-field marketplace set (v1 composed surface preserved VERBATIM)', () => {
    expect([...MARKETPLACE_CATALOG_V2_REQUIRED_FIELDS].sort()).toEqual(
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
    expect([...MARKETPLACE_CATALOG_V2_OVERLAY_REQUIRED].sort()).toEqual(
      ['description', 'homepage', 'keywords', 'license', 'version'].sort(),
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
    for (const field of MARKETPLACE_CATALOG_V2_REQUIRED_FIELDS) {
      const dropped: Record<string, unknown> = { ...V2_VALID };
      delete dropped[field];
      expect(validateComposition(dropped), `dropping "${field}" must invalidate (ajv)`).toBe(false);
      expect(
        MarketplaceCatalogV2Schema.safeParse(dropped).success,
        `dropping "${field}" must invalidate (Zod)`,
      ).toBe(false);
    }
  });
});
