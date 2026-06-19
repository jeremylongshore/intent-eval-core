/**
 * cross-schema-invariants — catalog + predicate-helper tests (plan 033 § 14.B).
 *
 * Covered:
 *   1. CATALOG: schemas/authoring/cross-schema-invariants.v1.json parses, is a
 *      valid JSON Schema (ajv compiles it), and its embedded `invariants` data
 *      validates against its own `$defs.invariant` shape; the 7 § 14.B.2 ids are
 *      present with the right edges / enforced_at / severity / class (only
 *      INV-ALLOWED-DISALLOWED advisory+warning, the other 6 structural+error).
 *   2. INV-ALLOWED-DISALLOWED (kernel-checkable advisory) WARNS on overlap and
 *      passes (empty) on disjoint — array AND string forms.
 *   3. Each STRUCTURAL predicate-helper is unit-tested with a violating fixture
 *      (an invalid child / unresolved source ⇒ one error) and a conforming
 *      fixture (all valid ⇒ zero errors), via a DI'd child validator.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  invAllowedDisallowed,
  invCatPlugin,
  invPluginSkill,
  invPluginAgent,
  invPluginMcp,
  invMcpHook,
  invSkillHook,
  type ChildVerdict,
  type ResolvedCatalogEntry,
} from '../validators/v1/authoring/cross-schema/cross-schema-invariants.js';
import type { AuthoringArtifact } from '../validators/v1/authoring/marketplace-tier.js';

interface ValidateFn {
  (data: unknown): boolean;
  errors: { instancePath: string; message?: string }[] | null;
}
interface AjvInstance {
  compile(schema: Record<string, unknown>): ValidateFn;
}
const Ajv2020 = (Ajv2020Module as unknown as { default: new (opts: object) => AjvInstance })
  .default;

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = join(__dirname, '../../schemas/authoring/cross-schema-invariants.v1.json');

interface CatalogInvariant {
  id: string;
  statement: string;
  edge: { from: string; to: string; relation: string };
  enforced_at: string;
  severity: 'error' | 'warning';
  class: 'structural' | 'advisory';
  kernel_checkable?: boolean;
  predicate_helper?: string;
}
interface Catalog {
  catalogVersion: string;
  lineage: string;
  invariants: CatalogInvariant[];
  $defs: Record<string, unknown>;
}

const EXPECTED_IDS = [
  'INV-CAT-PLUGIN',
  'INV-PLUGIN-SKILL',
  'INV-PLUGIN-AGENT',
  'INV-PLUGIN-MCP',
  'INV-MCP-HOOK',
  'INV-SKILL-HOOK',
  'INV-ALLOWED-DISALLOWED',
] as const;

let catalog: Catalog;

beforeAll(() => {
  catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8')) as Catalog;
});

// ─── 1. Catalog parses + matches a JSON-schema shape ─────────────────────────

describe('cross-schema-invariants catalog — parses + matches its schema shape', () => {
  it('is a valid JSON Schema ajv can compile, and its embedded instance data conforms', () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    // The file is a schema-with-embedded-instance: schema keywords ($schema, type,
    // properties, $defs, …) describe the shape; the literal catalogVersion/lineage/
    // invariants ARE a conforming instance. Compiling the file proves the schema is
    // well-formed; validating the instance projection (the non-schema-keyword data)
    // against the same compiled validator proves the literal data conforms.
    const validate = ajv.compile(catalog as unknown as Record<string, unknown>);
    const raw = catalog as unknown as Record<string, unknown>;
    const instance: Record<string, unknown> = {
      catalogVersion: raw['catalogVersion'],
      lineage: raw['lineage'],
      spec: raw['spec'],
      invariants: raw['invariants'],
    };
    const ok = validate(instance);
    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('every invariant validates against the catalog $defs.invariant shape', () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const invariantSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      ...(catalog.$defs['invariant'] as Record<string, unknown>),
      $defs: catalog.$defs,
    };
    const validate = ajv.compile(invariantSchema);
    for (const inv of catalog.invariants) {
      expect(validate(inv), `${inv.id}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it('carries exactly the 7 § 14.B.2 invariants, in catalog order', () => {
    expect(catalog.invariants.map((i) => i.id)).toEqual([...EXPECTED_IDS]);
  });

  it('cites § 14.B + DR-044 lineage in metadata', () => {
    expect(catalog.lineage).toBe('dr-044@d-sak-1');
    expect(catalog.catalogVersion).toBe('1.0.0-draft');
  });

  it('only INV-ALLOWED-DISALLOWED is advisory+warning; the other 6 are structural+error', () => {
    for (const inv of catalog.invariants) {
      if (inv.id === 'INV-ALLOWED-DISALLOWED') {
        expect(inv.class).toBe('advisory');
        expect(inv.severity).toBe('warning');
        expect(inv.kernel_checkable).toBe(true);
      } else {
        expect(inv.class).toBe('structural');
        expect(inv.severity).toBe('error');
        expect(inv.kernel_checkable).toBe(false);
      }
    }
  });

  it('each invariant declares an enforced_at (the validator + mode) + a non-empty statement', () => {
    for (const inv of catalog.invariants) {
      expect(inv.enforced_at.length).toBeGreaterThan(0);
      expect(inv.statement.length).toBeGreaterThan(0);
    }
  });

  it('the catalog edge endpoints match § 14.B.1', () => {
    const byId = new Map(catalog.invariants.map((i) => [i.id, i.edge]));
    expect(byId.get('INV-CAT-PLUGIN')).toMatchObject({
      from: 'marketplace-catalog',
      to: 'plugin-manifest',
    });
    expect(byId.get('INV-PLUGIN-SKILL')).toMatchObject({
      from: 'plugin-manifest',
      to: 'skill-frontmatter',
    });
    expect(byId.get('INV-MCP-HOOK')).toMatchObject({ from: 'mcp-config', to: 'hook-config' });
    expect(byId.get('INV-ALLOWED-DISALLOWED')).toMatchObject({ relation: 'self' });
  });
});

// ─── 2. INV-ALLOWED-DISALLOWED — warns on overlap, passes on disjoint ─────────

describe('invAllowedDisallowed — kernel-checkable advisory (WARNING)', () => {
  it('warns once per overlapping tool (array form)', () => {
    const warnings = invAllowedDisallowed({
      'allowed-tools': ['Read', 'Write', 'Bash'],
      'disallowed-tools': ['Bash', 'Write'],
    });
    expect(warnings).toHaveLength(2);
    expect(warnings.every((w) => w.severity === 'warning')).toBe(true);
    expect(warnings.every((w) => w.invariant === 'INV-ALLOWED-DISALLOWED')).toBe(true);
    expect(warnings.map((w) => w.message).join(' ')).toContain('Bash');
  });

  it('warns on overlap in CSV/space-delimited string form', () => {
    expect(
      invAllowedDisallowed({
        'allowed-tools': 'Read, Write, Bash',
        'disallowed-tools': 'Bash',
      }),
    ).toHaveLength(1);
    expect(
      invAllowedDisallowed({
        'allowed-tools': 'Read Write',
        'disallowed-tools': 'Write',
      }),
    ).toHaveLength(1);
  });

  it('passes (no warnings) on disjoint lists', () => {
    expect(
      invAllowedDisallowed({
        'allowed-tools': ['Read', 'Write'],
        'disallowed-tools': ['Bash'],
      }),
    ).toEqual([]);
  });

  it('passes when either list is absent or malformed (TYPE is another check’s concern)', () => {
    expect(invAllowedDisallowed({ 'allowed-tools': ['Read'] })).toEqual([]);
    expect(invAllowedDisallowed({ 'disallowed-tools': ['Read'] })).toEqual([]);
    expect(
      invAllowedDisallowed({
        'allowed-tools': 42,
        'disallowed-tools': ['Read'],
      }),
    ).toEqual([]);
  });
});

// ─── 3. Structural predicate-helpers — violating + conforming fixtures ────────

const valid: ChildVerdict = { valid: true };
const invalid: ChildVerdict = { valid: false };
const allValid = (): ChildVerdict => valid;
const allInvalid = (): ChildVerdict => invalid;
const child = (n: string): AuthoringArtifact => ({ name: n });

describe('invCatPlugin (INV-CAT-PLUGIN) — structural', () => {
  it('conforming: every entry resolves + validates ⇒ zero errors', () => {
    const entries: ResolvedCatalogEntry[] = [
      { source: './plugins/a', resolved: true, manifest: child('a') },
    ];
    expect(invCatPlugin(entries, allValid)).toEqual([]);
  });

  it('violating: an unresolved source ⇒ one error naming the source', () => {
    const entries: ResolvedCatalogEntry[] = [{ source: './plugins/missing', resolved: false }];
    const v = invCatPlugin(entries, allValid);
    expect(v).toHaveLength(1);
    expect(v[0]?.severity).toBe('error');
    expect(v[0]?.message).toContain('./plugins/missing');
  });

  it('violating: a resolved-but-invalid manifest ⇒ one error', () => {
    const entries: ResolvedCatalogEntry[] = [
      { source: './plugins/bad', resolved: true, manifest: child('bad') },
    ];
    expect(invCatPlugin(entries, allInvalid)).toHaveLength(1);
  });
});

describe('invPlugin{Skill,Agent,Mcp} — structural collection invariants', () => {
  const helpers = [
    ['invPluginSkill', invPluginSkill],
    ['invPluginAgent', invPluginAgent],
    ['invPluginMcp', invPluginMcp],
  ] as const;

  for (const [label, fn] of helpers) {
    it(`${label} conforming: all children valid ⇒ zero errors`, () => {
      expect(fn([child('a'), child('b')], allValid)).toEqual([]);
    });
    it(`${label} violating: one invalid child ⇒ one error at its index`, () => {
      const validateOnlyFirst = (c: AuthoringArtifact): ChildVerdict =>
        c['name'] === 'a' ? valid : invalid;
      const v = fn([child('a'), child('b')], validateOnlyFirst);
      expect(v).toHaveLength(1);
      expect(v[0]?.path).toContain('1');
    });
    it(`${label} empty collection ⇒ vacuously satisfied`, () => {
      expect(fn([], allInvalid)).toEqual([]);
    });
  }
});

describe('invMcpHook / invSkillHook — refers-to (hooks optional)', () => {
  it('absent hooks ⇒ vacuously satisfied (both helpers)', () => {
    expect(invMcpHook(undefined, allInvalid)).toEqual([]);
    expect(invSkillHook(undefined, allInvalid)).toEqual([]);
  });
  it('conforming: present + valid hooks ⇒ zero errors', () => {
    expect(invMcpHook([child('h')], allValid)).toEqual([]);
    expect(invSkillHook([child('h')], allValid)).toEqual([]);
  });
  it('violating: present + invalid hook ⇒ one error', () => {
    expect(invMcpHook([child('h')], allInvalid)).toHaveLength(1);
    expect(invSkillHook([child('h')], allInvalid)).toHaveLength(1);
  });
});
