/**
 * version-ordering-invariant — catalog + comparator + live-family tests.
 *
 * The V ≤ C ≤ K authoring-family version-ordering invariant (intent-eval-lab doc
 * 045-RR-LAND, the single-source-of-truth + continuous-spec-compliance machinery;
 * lineage dr-044@d-sak-1). V = the upstream-base (VENDOR) layer version;
 * C = the is-overlay (CONSUMER) layer version; K = the published composition
 * (KERNEL) layer version (= schemas/authoring/<family>/index.json#version).
 *
 * Covered:
 *   1. CATALOG: schemas/authoring/version-ordering-invariant.v1.json parses, is a
 *      valid JSON Schema (ajv compiles it), and its embedded instance conforms;
 *      it carries the INV-VERSION-ORDERING invariant + the §045 / DR-044 lineage.
 *   2. COMPARATOR: the 4 corpus cases the bead requires —
 *        (a) a valid V ≤ C ≤ K ordering PASSES (zero violations),
 *        (b) a C > K violation FAILS (the C ≤ K edge),
 *        (c) a V > C violation FAILS (the V ≤ C edge),
 *        (d) the V = C = K equality case PASSES.
 *      Plus the SemVer-precedence comparator's prerelease / build-metadata rules
 *      (so `1.0.0-draft` orders below `1.0.0`, and a `-draft` triple is the
 *      equality case across all three layers).
 *   3. LIVE FAMILIES: every family declared in the catalog satisfies V ≤ C ≤ K
 *      AND its declared `kernel` value equals the live index.json#version — so the
 *      catalog can never drift from the shipped authoring chambers.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020Module from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INV_VERSION_ORDERING,
  compareSemver,
  semverLte,
  parseSemver,
  satisfiesVersionOrdering,
  versionOrderingViolations,
  type VersionTriple,
} from '../validators/v1/authoring/cross-schema/version-ordering-invariant.js';

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
const REPO_ROOT = join(__dirname, '../..');
const CATALOG_PATH = join(REPO_ROOT, 'schemas/authoring/version-ordering-invariant.v1.json');

interface CatalogFamily {
  family: string;
  indexPath: string;
  vendor: string;
  consumer: string;
  kernel: string;
}
interface Catalog {
  catalogVersion: string;
  lineage: string;
  spec: string;
  invariant: { id: string; statement: string; ordering: string; rationale: string };
  families: CatalogFamily[];
  $defs: Record<string, unknown>;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

let catalog: Catalog;
beforeAll(() => {
  catalog = loadJson<Catalog>(CATALOG_PATH);
});

// ─── 1. Catalog parses + matches its own schema shape ────────────────────────

describe('version-ordering-invariant catalog — parses + conforms to its schema shape', () => {
  it('is a valid JSON Schema ajv can compile, and its embedded instance conforms', () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    // Schema-with-embedded-instance: the schema keywords describe the shape; the
    // literal catalogVersion/lineage/invariant/families ARE a conforming instance.
    const validate = ajv.compile(catalog as unknown as Record<string, unknown>);
    const raw = catalog as unknown as Record<string, unknown>;
    const instance: Record<string, unknown> = {
      catalogVersion: raw['catalogVersion'],
      lineage: raw['lineage'],
      spec: raw['spec'],
      invariant: raw['invariant'],
      families: raw['families'],
    };
    const ok = validate(instance);
    expect(ok, JSON.stringify(validate.errors)).toBe(true);
  });

  it('every family validates against the catalog $defs.family shape', () => {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const familySchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      ...(catalog.$defs['family'] as Record<string, unknown>),
      $defs: catalog.$defs,
    };
    const validate = ajv.compile(familySchema);
    for (const fam of catalog.families) {
      expect(validate(fam), `${fam.family}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it('registers the INV-VERSION-ORDERING invariant + the §045 / DR-044 lineage', () => {
    expect(catalog.catalogVersion).toBe('1.0.0-draft');
    expect(catalog.lineage).toBe('dr-044@d-sak-1');
    expect(catalog.spec).toContain('045-RR-LAND');
    expect(catalog.invariant.id).toBe(INV_VERSION_ORDERING);
    expect(catalog.invariant.ordering).toBe('semver');
    expect(catalog.invariant.statement).toContain('V(f) ≤ C(f) ≤ K(f)');
  });
});

// ─── 2. SemVer-precedence comparator — the building block ────────────────────

describe('compareSemver / semverLte — SemVer 2.0.0 precedence', () => {
  it('orders by release core (major.minor.patch)', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });

  it('a prerelease has LOWER precedence than the same release core (§11.3)', () => {
    expect(compareSemver('1.0.0-draft', '1.0.0')).toBeLessThan(0);
    expect(semverLte('1.0.0-draft', '1.0.0')).toBe(true);
    expect(semverLte('1.0.0', '1.0.0-draft')).toBe(false);
  });

  it('two equal -draft triples compare as EQUAL (the equality case)', () => {
    expect(compareSemver('1.0.0-draft', '1.0.0-draft')).toBe(0);
    expect(compareSemver('2.0.0-draft', '2.0.0-draft')).toBe(0);
  });

  it('ignores build metadata for precedence (§10)', () => {
    expect(compareSemver('1.0.0+build.7', '1.0.0+build.9')).toBe(0);
  });

  it('throws on a non-SemVer string rather than mis-ordering it', () => {
    expect(() => parseSemver('2026-11-25')).toThrow(/not a SemVer/);
    expect(() => parseSemver('not-a-version')).toThrow(/not a SemVer/);
  });
});

// ─── 3. The 4 corpus cases the bead requires ─────────────────────────────────

describe('versionOrderingViolations — V ≤ C ≤ K (the 4 corpus cases)', () => {
  it('(a) a valid V ≤ C ≤ K ordering PASSES (zero violations)', () => {
    const triple: VersionTriple = { vendor: '1.0.0', consumer: '1.1.0', kernel: '1.2.0' };
    expect(versionOrderingViolations(triple)).toEqual([]);
    expect(satisfiesVersionOrdering(triple)).toBe(true);
  });

  it('(b) a C > K violation FAILS (the kernel lags the consumer)', () => {
    const triple: VersionTriple = { vendor: '1.0.0', consumer: '1.2.0', kernel: '1.1.0' };
    const v = versionOrderingViolations(triple);
    expect(v).toHaveLength(1);
    expect(v[0]?.edge).toBe('C<=K');
    expect(v[0]?.severity).toBe('error');
    expect(v[0]?.message).toContain('kernel must not lag the consumer');
    expect(satisfiesVersionOrdering(triple)).toBe(false);
  });

  it('(c) a V > C violation FAILS (the consumer lags the vendor)', () => {
    const triple: VersionTriple = { vendor: '1.2.0', consumer: '1.1.0', kernel: '1.3.0' };
    const v = versionOrderingViolations(triple);
    expect(v).toHaveLength(1);
    expect(v[0]?.edge).toBe('V<=C');
    expect(v[0]?.severity).toBe('error');
    expect(v[0]?.message).toContain('consumer must not lag the vendor');
    expect(satisfiesVersionOrdering(triple)).toBe(false);
  });

  it('(d) the V = C = K equality case PASSES', () => {
    const triple: VersionTriple = {
      vendor: '2.0.0-draft',
      consumer: '2.0.0-draft',
      kernel: '2.0.0-draft',
    };
    expect(versionOrderingViolations(triple)).toEqual([]);
    expect(satisfiesVersionOrdering(triple)).toBe(true);
  });

  it('a triple breaking BOTH edges yields a violation per edge', () => {
    // V > C AND C > K (a fully inverted lineage).
    const triple: VersionTriple = { vendor: '3.0.0', consumer: '2.0.0', kernel: '1.0.0' };
    const v = versionOrderingViolations(triple);
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.edge).sort()).toEqual(['C<=K', 'V<=C']);
  });

  it('every violation carries the INV-VERSION-ORDERING catalog id', () => {
    const v = versionOrderingViolations({ vendor: '2.0.0', consumer: '1.0.0', kernel: '1.0.0' });
    expect(v.every((x) => x.invariant === INV_VERSION_ORDERING)).toBe(true);
  });
});

// ─── 4. Live families — the catalog must match the shipped chambers ──────────

describe('live authoring families — V ≤ C ≤ K holds + catalog agrees with index.json', () => {
  it('declares at least the v1 and v2 families', () => {
    const names = catalog.families.map((f) => f.family).sort();
    expect(names).toEqual(expect.arrayContaining(['v1', 'v2']));
  });

  it('every declared family satisfies V ≤ C ≤ K', () => {
    for (const fam of catalog.families) {
      const triple: VersionTriple = {
        vendor: fam.vendor,
        consumer: fam.consumer,
        kernel: fam.kernel,
      };
      expect(
        satisfiesVersionOrdering(triple),
        `${fam.family}: V=${fam.vendor} C=${fam.consumer} K=${fam.kernel} — ${JSON.stringify(
          versionOrderingViolations(triple),
        )}`,
      ).toBe(true);
    }
  });

  it("every family's declared kernel (K) equals the live index.json#version (no drift)", () => {
    for (const fam of catalog.families) {
      const index = loadJson<{ version: string }>(join(REPO_ROOT, fam.indexPath));
      expect(fam.kernel, `${fam.family}: catalog K vs live index version`).toBe(index.version);
    }
  });

  it('families order across versions (v1.K ≤ v2.K) — the published lineage progresses', () => {
    const byName = new Map(catalog.families.map((f) => [f.family, f]));
    const v1 = byName.get('v1');
    const v2 = byName.get('v2');
    expect(v1).toBeDefined();
    expect(v2).toBeDefined();
    expect(semverLte(v1!.kernel, v2!.kernel)).toBe(true);
  });
});
