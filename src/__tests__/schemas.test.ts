/**
 * Schema validation tests with golden fixtures.
 *
 * Loads every schema in schemas/v1/ + matching valid + invalid fixtures
 * from tests/fixtures/v1/. Validates with ajv (draft 2020-12 + formats).
 *
 * Per iec-E03 acceptance criteria: "validation tests with golden fixtures pass".
 */

import { describe, it, expect, beforeAll } from 'vitest';
// ajv 8 ships as CJS; under NodeNext ESM the default export lands on `.default`
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Unwrap default exports from CJS interop wrappers.
const Ajv2020 = (Ajv2020Module as unknown as { default: new (opts: object) => AjvInstance })
  .default;
const addFormats = (addFormatsModule as unknown as { default: (ajv: AjvInstance) => void }).default;

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, '../../schemas/v1');
const FIXTURES_DIR = join(__dirname, '../../tests/fixtures/v1');

interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key?: string): void;
  compile<T = unknown>(
    schema: Record<string, unknown>,
  ): ((data: T) => boolean) & {
    errors: { instancePath: string; message?: string }[] | null;
  };
}

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

function buildAjv(): AjvInstance {
  const ajv = new Ajv2020({
    strict: true,
    // Disable strictRequired: allOf/if-then patterns reference required
    // properties from the parent schema; strictRequired wants them
    // re-declared at the if-then level, which is needless duplication.
    strictRequired: false,
    allErrors: true,
    validateFormats: true,
  });
  addFormats(ajv);
  return ajv;
}

const ENTITY_SCHEMAS = [
  'eval-spec',
  'eval-run',
  'matcher-map',
  'evidence-bundle',
  'judge-decision',
  'runtime-receipt',
  'regression-pack',
  'rollout-gate',
  'skill-snapshot',
  'skill-version',
  'human-review',
  'session-trace',
  'tool-invocation',
  'cost-record',
  'usage-event',
  'failure-taxonomy',
] as const;

describe('schemas/v1 — structural integrity', () => {
  it('ships exactly 16 entity schemas + 4 predicates + 1 common + 1 index = 22 files', () => {
    // v0.2.0 added retraction/v1 + dashboard-render/v1 predicate schemas
    // alongside the v0.1 gate-result/v1 (16 → 18 files). Class-1 ADR DR-082
    // added skill-refiner-pass/v1 (18 → 19 files). DR-028 T1 added the
    // skill-version entity — the 14th canonical entity (19 → 20 files). DR-103
    // D1 added the usage-event entity (20 → 21 files) and the human-review entity
    // (21 → 22 files); both landed off the same main (parallel PRs #73 + #74), so
    // the on-disk count settles at 22 files / 16 entities with both present. Per
    // DR-103 D1 B1.5 no fixed ordinal is claimed for human-review. The
    // human-review/v1 predicate body ships as hand-authored TS+Zod (a PARALLEL
    // statement, mirroring EvidenceStatement) with NO separate predicate JSON
    // schema, so the predicate-schema count stays 4.
    const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(22);
  });

  it('every entity schema is referenced in index.json', () => {
    const idx = loadJson(join(SCHEMAS_DIR, 'index.json'));
    const schemas = idx['schemas'] as Record<string, { kind: string }>;
    const entityEntries = Object.values(schemas).filter((s) => s.kind === 'entity');
    // 13 Blueprint B § 2 entities + SkillVersion (DR-028 T1 DISCRIMINATOR)
    // + UsageEvent (DR-103 D1 append-only product-metering ledger)
    // + HumanReview (ISEDC DR-103 D1 — open-ended human-trust signal).
    // 16 with both PR #73 + #74 landed (no fixed ordinal claimed for
    // human-review per DR-103 D1 B1.5).
    expect(entityEntries).toHaveLength(16);
  });

  it('every schema declares draft 2020-12', () => {
    const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.schema.json'));
    for (const f of files) {
      const s = loadJson(join(SCHEMAS_DIR, f));
      expect(s['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    }
  });

  it('every entity schema uses additionalProperties: false (closed world)', () => {
    for (const name of ENTITY_SCHEMAS) {
      const s = loadJson(join(SCHEMAS_DIR, `${name}.schema.json`));
      expect(s['additionalProperties'], `${name}.schema.json must be closed-world`).toBe(false);
    }
  });

  it('gate-result/v1 schema is signed to evals.intentsolutions.io (NOT labs)', () => {
    const s = loadJson(join(SCHEMAS_DIR, 'gate-result.schema.json'));
    expect(s['$id']).toBe('https://evals.intentsolutions.io/gate-result/v1.schema.json');
    expect(JSON.stringify(s)).not.toContain('labs.intentsolutions.io');
  });

  it.each([
    ['retraction.schema.json', 'https://evals.intentsolutions.io/retraction/v1.schema.json'],
    [
      'dashboard-render.schema.json',
      'https://evals.intentsolutions.io/dashboard-render/v1.schema.json',
    ],
    [
      'skill-refiner-pass.schema.json',
      'https://evals.intentsolutions.io/skill-refiner-pass/v1.schema.json',
    ],
  ])('%s predicate URI lives at evals.intentsolutions.io (NOT labs)', (file, id) => {
    // CISO binding (DR-004 + DR-010): predicate URIs NEVER on labs.*
    const s = loadJson(join(SCHEMAS_DIR, file));
    expect(s['$id']).toBe(id);
    expect(JSON.stringify(s)).not.toContain('labs.intentsolutions.io');
  });

  it('skill-refiner-pass/v1 $id is FLAT — no /authoring/ segment (DR-082 Q1)', () => {
    const s = loadJson(join(SCHEMAS_DIR, 'skill-refiner-pass.schema.json'));
    expect(JSON.stringify(s['$id'])).not.toContain('/authoring/');
    expect(s['$id']).toBe('https://evals.intentsolutions.io/skill-refiner-pass/v1.schema.json');
  });

  it.each([
    'retraction.schema.json',
    'dashboard-render.schema.json',
    'skill-refiner-pass.schema.json',
  ])('%s is closed-world (additionalProperties: false) + declares draft 2020-12', (file) => {
    const s = loadJson(join(SCHEMAS_DIR, file));
    expect(s['additionalProperties']).toBe(false);
    expect(s['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  it('index.json catalogs 4 predicate schemas (gate-result + retraction + dashboard-render + skill-refiner-pass)', () => {
    const idx = loadJson(join(SCHEMAS_DIR, 'index.json'));
    const schemas = idx['schemas'] as Record<string, { kind: string }>;
    const predicateEntries = Object.values(schemas).filter((s) => s.kind === 'predicate');
    expect(predicateEntries).toHaveLength(4);
  });

  it('skill-refiner-pass/v1 is registered with signing_mode "sigstore_staging" (DR-085 D4 canonical staging label, retires "ln")', () => {
    const idx = loadJson(join(SCHEMAS_DIR, 'index.json'));
    const schemas = idx['schemas'] as Record<string, { signing_mode?: string }>;
    expect(schemas['skill-refiner-pass-v1']?.signing_mode).toBe('sigstore_staging');
  });
});

describe('schemas/v1 — fixtures validate', () => {
  let ajv: AjvInstance;
  const validators = new Map<string, (data: unknown) => boolean>();

  beforeAll(() => {
    ajv = buildAjv();
    // Pre-register common defs under BOTH key paths so refs resolve from
    // entity-schema host (github.com/.../schemas/v1/) AND predicate-body
    // host (evals.intentsolutions.io/). Schemas use relative `_common
    // .schema.json#/$defs/...` refs which ajv resolves against the
    // containing schema's $id base.
    const common = loadJson(join(SCHEMAS_DIR, '_common.schema.json'));
    ajv.addSchema(
      common,
      'https://github.com/jeremylongshore/intent-eval-core/schemas/v1/_common.schema.json',
    );
    ajv.addSchema(common, 'https://evals.intentsolutions.io/_common.schema.json');
    for (const name of ENTITY_SCHEMAS) {
      const s = loadJson(join(SCHEMAS_DIR, `${name}.schema.json`));
      validators.set(name, ajv.compile(s));
    }
    const gate = loadJson(join(SCHEMAS_DIR, 'gate-result.schema.json'));
    validators.set('gate-result', ajv.compile(gate));
  });

  it.each(ENTITY_SCHEMAS)('%s.valid.json validates against its schema', (name) => {
    const validate = validators.get(name)!;
    const fixture = loadJson(join(FIXTURES_DIR, `${name}.valid.json`));
    const ok = validate(fixture);
    if (!ok) {
      throw new Error(
        `${name} validation failed:\n${JSON.stringify((validate as unknown as { errors: unknown }).errors, null, 2)}`,
      );
    }
    expect(ok).toBe(true);
  });

  it('gate-result.valid.json validates (minimal required-only payload)', () => {
    const validate = validators.get('gate-result')!;
    const fixture = loadJson(join(FIXTURES_DIR, 'gate-result.valid.json'));
    const ok = validate(fixture);
    if (!ok) {
      throw new Error(
        `gate-result validation failed:\n${JSON.stringify((validate as unknown as { errors: unknown }).errors, null, 2)}`,
      );
    }
    expect(ok).toBe(true);
  });

  it('gate-result.advisory.valid.json validates (full optional fields)', () => {
    const validate = validators.get('gate-result')!;
    const fixture = loadJson(join(FIXTURES_DIR, 'gate-result.advisory.valid.json'));
    const ok = validate(fixture);
    if (!ok) {
      throw new Error(
        `gate-result advisory validation failed:\n${JSON.stringify((validate as unknown as { errors: unknown }).errors, null, 2)}`,
      );
    }
    expect(ok).toBe(true);
  });
});

describe('schemas/v1 — negative fixtures REJECT', () => {
  let ajv: AjvInstance;
  let validateGate: (data: unknown) => boolean;
  let validateSpec: (data: unknown) => boolean;

  beforeAll(() => {
    ajv = buildAjv();
    const common = loadJson(join(SCHEMAS_DIR, '_common.schema.json'));
    ajv.addSchema(
      common,
      'https://github.com/jeremylongshore/intent-eval-core/schemas/v1/_common.schema.json',
    );
    ajv.addSchema(common, 'https://evals.intentsolutions.io/_common.schema.json');
    validateGate = ajv.compile(loadJson(join(SCHEMAS_DIR, 'gate-result.schema.json')));
    validateSpec = ajv.compile(loadJson(join(SCHEMAS_DIR, 'eval-spec.schema.json')));
  });

  it('gate-result missing gate_name → REJECT', () => {
    const fixture = loadJson(join(FIXTURES_DIR, 'gate-result.invalid-missing-gate_name.json'));
    expect(validateGate(fixture)).toBe(false);
  });

  it('gate-result with gate_decision=ship → REJECT (ship is RolloutGate, not gate-result)', () => {
    const fixture = loadJson(join(FIXTURES_DIR, 'gate-result.invalid-bad-decision.json'));
    expect(validateGate(fixture)).toBe(false);
  });

  it('gate-result with md5 hash prefix → REJECT (only sha256: accepted)', () => {
    const fixture = loadJson(join(FIXTURES_DIR, 'gate-result.invalid-bad-hash-format.json'));
    expect(validateGate(fixture)).toBe(false);
  });

  it('gate-result fail + empty gate_reasons → REJECT (Blueprint B § 7.4 line 829) [f-iec-validators-3]', () => {
    const base = loadJson(join(FIXTURES_DIR, 'gate-result.valid.json'));
    expect(validateGate({ ...base, gate_decision: 'fail' })).toBe(false);
  });

  it('gate-result error + empty gate_reasons → REJECT [f-iec-validators-3]', () => {
    const base = loadJson(join(FIXTURES_DIR, 'gate-result.valid.json'));
    expect(validateGate({ ...base, gate_decision: 'error' })).toBe(false);
  });

  it('gate-result advisory + advisory_severity + empty gate_reasons → REJECT [f-iec-validators-3]', () => {
    const base = loadJson(join(FIXTURES_DIR, 'gate-result.valid.json'));
    expect(validateGate({ ...base, gate_decision: 'advisory', advisory_severity: 'warn' })).toBe(
      false,
    );
  });

  it('gate-result fail + one reason → ACCEPT (rule requires non-empty, nothing more)', () => {
    const base = loadJson(join(FIXTURES_DIR, 'gate-result.valid.json'));
    expect(
      validateGate({ ...base, gate_decision: 'fail', gate_reasons: ['escape.detected'] }),
    ).toBe(true);
  });

  it('eval-spec with aggregation_rule=plurality → REJECT (not in closed enum)', () => {
    const fixture = loadJson(join(FIXTURES_DIR, 'eval-spec.invalid-bad-aggregation.json'));
    expect(validateSpec(fixture)).toBe(false);
  });

  it('eval-spec scoring with a tool-emitted extra key → ACCEPT (scoring is the open object; Zod parity in validators.test.ts) [f-iec-validators-1]', () => {
    const fixture = loadJson(join(FIXTURES_DIR, 'eval-spec.valid.json'));
    const scoring = fixture['scoring'] as Record<string, unknown>;
    const mutated = { ...fixture, scoring: { ...scoring, pass_threshold: 0.8 } };
    expect(validateSpec(mutated)).toBe(true);
  });
});

describe('schemas/v1 — v0.2.0 additive predicates (retraction/v1 + dashboard-render/v1)', () => {
  let ajv: AjvInstance;
  let validateRetraction: (data: unknown) => boolean;
  let validateDashboardRender: (data: unknown) => boolean;
  let validateBundle: (data: unknown) => boolean;

  beforeAll(() => {
    ajv = buildAjv();
    const common = loadJson(join(SCHEMAS_DIR, '_common.schema.json'));
    ajv.addSchema(
      common,
      'https://github.com/jeremylongshore/intent-eval-core/schemas/v1/_common.schema.json',
    );
    ajv.addSchema(common, 'https://evals.intentsolutions.io/_common.schema.json');
    validateRetraction = ajv.compile(loadJson(join(SCHEMAS_DIR, 'retraction.schema.json')));
    validateDashboardRender = ajv.compile(
      loadJson(join(SCHEMAS_DIR, 'dashboard-render.schema.json')),
    );
    validateBundle = ajv.compile(loadJson(join(SCHEMAS_DIR, 'evidence-bundle.schema.json')));
  });

  it('retraction.valid.json validates', () => {
    const ok = validateRetraction(loadJson(join(FIXTURES_DIR, 'retraction.valid.json')));
    expect(ok).toBe(true);
  });

  it('retraction with out-of-set reason_class → REJECT (closed enum, GC binding)', () => {
    const ok = validateRetraction(
      loadJson(join(FIXTURES_DIR, 'retraction.invalid-bad-reason-class.json')),
    );
    expect(ok).toBe(false);
  });

  it('retraction missing reason_class → REJECT (required)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'retraction.valid.json'));
    const bad = JSON.parse(JSON.stringify(fix)) as Record<string, unknown>;
    delete bad['reason_class'];
    expect(validateRetraction(bad)).toBe(false);
  });

  it('retraction with empty retracted_subject → REJECT (minProperties: 1)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'retraction.valid.json'));
    const bad = JSON.parse(JSON.stringify(fix)) as Record<string, unknown>;
    bad['retracted_subject'] = {};
    expect(validateRetraction(bad)).toBe(false);
  });

  it('dashboard-render.valid.json validates', () => {
    const ok = validateDashboardRender(loadJson(join(FIXTURES_DIR, 'dashboard-render.valid.json')));
    expect(ok).toBe(true);
  });

  it('dashboard-render with empty input_bundles → REJECT (minItems: 1)', () => {
    const ok = validateDashboardRender(
      loadJson(join(FIXTURES_DIR, 'dashboard-render.invalid-empty-inputs.json')),
    );
    expect(ok).toBe(false);
  });

  it('dashboard-render missing rendered_artifact → REJECT (required)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'dashboard-render.valid.json'));
    const bad = JSON.parse(JSON.stringify(fix)) as Record<string, unknown>;
    delete bad['rendered_artifact'];
    expect(validateDashboardRender(bad)).toBe(false);
  });

  it('EvidenceBundle WITH pre_registration_hash (sha256:<hex>) validates', () => {
    const ok = validateBundle(
      loadJson(join(FIXTURES_DIR, 'evidence-bundle.with-prereg.valid.json')),
    );
    expect(ok).toBe(true);
  });

  it('EvidenceBundle WITHOUT pre_registration_hash still validates (additive/optional)', () => {
    const ok = validateBundle(loadJson(join(FIXTURES_DIR, 'evidence-bundle.valid.json')));
    expect(ok).toBe(true);
  });

  it('EvidenceBundle with pre_registration_hash: null validates (nullable)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'evidence-bundle.valid.json'));
    const withNull = { ...fix, pre_registration_hash: null };
    expect(validateBundle(withNull)).toBe(true);
  });

  it('EvidenceBundle with malformed pre_registration_hash → REJECT (must be sha256:<hex> or null)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'evidence-bundle.valid.json'));
    const bad = { ...fix, pre_registration_hash: 'not-a-hash' };
    expect(validateBundle(bad)).toBe(false);
  });
});

describe('schemas/v1 — skill-refiner-pass/v1 additive predicate (Class-1 ADR DR-082)', () => {
  let ajv: AjvInstance;
  let validateSkillRefinerPass: (data: unknown) => boolean;

  beforeAll(() => {
    ajv = buildAjv();
    const common = loadJson(join(SCHEMAS_DIR, '_common.schema.json'));
    ajv.addSchema(
      common,
      'https://github.com/jeremylongshore/intent-eval-core/schemas/v1/_common.schema.json',
    );
    ajv.addSchema(common, 'https://evals.intentsolutions.io/_common.schema.json');
    validateSkillRefinerPass = ajv.compile(
      loadJson(join(SCHEMAS_DIR, 'skill-refiner-pass.schema.json')),
    );
  });

  it('skill-refiner-pass.valid.json validates (full determinants + optionals)', () => {
    const ok = validateSkillRefinerPass(
      loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json')),
    );
    expect(ok).toBe(true);
  });

  it('skill-refiner-pass.reject.valid.json validates (DR-085 D5: reject body has no non-regression constraint)', () => {
    const ok = validateSkillRefinerPass(
      loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.reject.valid.json')),
    );
    expect(ok).toBe(true);
  });

  it('DR-085 D5: skill-refiner-pass.invalid-accept-regressed.json → REJECT (accept ⇒ every non_regressed === true)', () => {
    const ok = validateSkillRefinerPass(
      loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.invalid-accept-regressed.json')),
    );
    expect(ok).toBe(false);
  });

  it('DR-085 D3: skill-refiner-pass with parent_version_id: null validates (root attests without forging a parent)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json'));
    const root = { ...fix, parent_version_id: null };
    expect(validateSkillRefinerPass(root)).toBe(true);
  });

  it('DR-085 D4: skill-refiner-pass missing result_snapshot_hash → REJECT (post-edit output is a required determinant)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json'));
    const bad = JSON.parse(JSON.stringify(fix)) as Record<string, unknown>;
    delete bad['result_snapshot_hash'];
    expect(validateSkillRefinerPass(bad)).toBe(false);
  });

  it('skill-refiner-pass with test_statistic_kind != one-sided-z → REJECT (const for v1)', () => {
    const ok = validateSkillRefinerPass(
      loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.invalid-bad-test-kind.json')),
    );
    expect(ok).toBe(false);
  });

  it('skill-refiner-pass missing refiner_strategy_id → REJECT (mechanism-traceability, DR-028)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json'));
    const bad = JSON.parse(JSON.stringify(fix)) as Record<string, unknown>;
    delete bad['refiner_strategy_id'];
    expect(validateSkillRefinerPass(bad)).toBe(false);
  });

  it('skill-refiner-pass with empty reason array → REJECT (minItems: 1)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json'));
    const bad = JSON.parse(JSON.stringify(fix)) as Record<string, unknown>;
    bad['reason'] = [];
    expect(validateSkillRefinerPass(bad)).toBe(false);
  });

  it('skill-refiner-pass with alpha = 1 → REJECT (exclusiveMaximum, falsifiability anchor in (0,1))', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json'));
    const bad = { ...fix, alpha: 1 };
    expect(validateSkillRefinerPass(bad)).toBe(false);
  });

  it('skill-refiner-pass with verdict out of the closed enum → REJECT (widening is /v2)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json'));
    const bad = { ...fix, verdict: 'incomparable' };
    expect(validateSkillRefinerPass(bad)).toBe(false);
  });

  it('skill-refiner-pass with an unknown extra field → REJECT (additionalProperties: false)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json'));
    const bad = { ...fix, surprise: true };
    expect(validateSkillRefinerPass(bad)).toBe(false);
  });
});

describe('schemas/v1 — SkillVersion entity (14th canonical, DR-028 T1 DISCRIMINATOR)', () => {
  let ajv: AjvInstance;
  let validateSkillVersion: (data: unknown) => boolean;

  beforeAll(() => {
    ajv = buildAjv();
    const common = loadJson(join(SCHEMAS_DIR, '_common.schema.json'));
    ajv.addSchema(
      common,
      'https://github.com/jeremylongshore/intent-eval-core/schemas/v1/_common.schema.json',
    );
    validateSkillVersion = ajv.compile(loadJson(join(SCHEMAS_DIR, 'skill-version.schema.json')));
  });

  it('skill-version.valid.json validates (full lineage record)', () => {
    expect(validateSkillVersion(loadJson(join(FIXTURES_DIR, 'skill-version.valid.json')))).toBe(
      true,
    );
  });

  it('skill-version.root.valid.json validates (parent_version_id: null root version)', () => {
    expect(
      validateSkillVersion(loadJson(join(FIXTURES_DIR, 'skill-version.root.valid.json'))),
    ).toBe(true);
  });

  it('skill-version with version_kind out of the closed enum → REJECT (widening is /v2)', () => {
    expect(
      validateSkillVersion(
        loadJson(join(FIXTURES_DIR, 'skill-version.invalid-bad-version-kind.json')),
      ),
    ).toBe(false);
  });

  it('skill-version missing refiner_strategy_id → REJECT (CISO mechanism-traceability, DR-028 P0-RATIFY-5)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'skill-version.valid.json'));
    const bad = JSON.parse(JSON.stringify(fix)) as Record<string, unknown>;
    delete bad['refiner_strategy_id'];
    expect(validateSkillVersion(bad)).toBe(false);
  });

  it('DR-085 D3: skill-version with a sha256:-PREFIXED source_snapshot_hash → REJECT (entity hashes are BARE, aligned to combined_sha)', () => {
    // Pre-DR-085 this field was sha256:-prefixed; D3 aligned it to the bare
    // SkillSnapshot.combined_sha alphabet, so the prefixed form now fails.
    const fix = loadJson(join(FIXTURES_DIR, 'skill-version.valid.json'));
    const bad = { ...fix, source_snapshot_hash: 'sha256:' + '7'.repeat(64) };
    expect(validateSkillVersion(bad)).toBe(false);
  });

  it('skill-version with an unknown extra field → REJECT (additionalProperties: false; e.g. deferred status field)', () => {
    // status / signing_mode / rekor_log_index are DEFERRED to the v0.4.0
    // state-machine DR (DR-028 T1 lines 105/108) — NOT part of this shape yet.
    const fix = loadJson(join(FIXTURES_DIR, 'skill-version.valid.json'));
    const bad = { ...fix, status: 'active' };
    expect(validateSkillVersion(bad)).toBe(false);
  });

  it('skill-version aligns with the skill-refiner-pass/v1 predicate reference (DR-085 D3/D4 hash semantics)', () => {
    // The entity is referenced BY the predicate. The valid fixtures share IDs so
    // the cross-reference is concrete. DR-085 D3: the ENTITY hashes are BARE
    // sha256 (aligned to SkillSnapshot.combined_sha); the PREDICATE hashes are
    // sha256-prefixed (in-toto wire discipline). They name the same content, so
    // the prefixed predicate value === the bare entity value with `sha256:`
    // stripped. DR-085 D4: entity.source_snapshot_hash (pre-edit input) ↔
    // predicate.source_snapshot_hash; entity.content_hash (post-edit output) ↔
    // predicate.result_snapshot_hash.
    const sv = loadJson(join(FIXTURES_DIR, 'skill-version.valid.json'));
    const pred = loadJson(join(FIXTURES_DIR, 'skill-refiner-pass.valid.json'));
    const strip = (h: unknown) => (h as string).slice('sha256:'.length);
    expect(sv['id']).toBe(pred['skill_version_id']);
    expect(sv['parent_version_id']).toBe(pred['parent_version_id']);
    // pre-edit input: bare entity hash === prefixed predicate hash sans prefix
    expect(sv['source_snapshot_hash']).toBe(strip(pred['source_snapshot_hash']));
    // post-edit output: entity.content_hash === predicate.result_snapshot_hash sans prefix
    expect(sv['content_hash']).toBe(strip(pred['result_snapshot_hash']));
  });

  it('skill-version.revert.valid.json + skill-version.restore.valid.json validate (DR-085 D5: non-null parent)', () => {
    expect(
      validateSkillVersion(loadJson(join(FIXTURES_DIR, 'skill-version.revert.valid.json'))),
    ).toBe(true);
    expect(
      validateSkillVersion(loadJson(join(FIXTURES_DIR, 'skill-version.restore.valid.json'))),
    ).toBe(true);
  });

  it('DR-085 D3: a ROOT version (null parent_version_id) with a non-null parent_content_hash → REJECT', () => {
    const root = loadJson(join(FIXTURES_DIR, 'skill-version.root.valid.json'));
    const bad = { ...root, parent_content_hash: '6'.repeat(64) };
    expect(validateSkillVersion(bad)).toBe(false);
  });

  it('DR-085 D3: a NON-root version (uuid parent) with parent_content_hash: null → REJECT', () => {
    const child = loadJson(join(FIXTURES_DIR, 'skill-version.valid.json'));
    const bad = { ...child, parent_content_hash: null };
    expect(validateSkillVersion(bad)).toBe(false);
  });

  it('DR-085 D3: a prefixed (sha256:) content_hash → REJECT (entity hashes are BARE, aligned to combined_sha)', () => {
    const child = loadJson(join(FIXTURES_DIR, 'skill-version.valid.json'));
    const bad = { ...child, content_hash: 'sha256:' + '1'.repeat(64) };
    expect(validateSkillVersion(bad)).toBe(false);
  });

  it('DR-085 D5: version_kind=revert with parent_version_id: null → REJECT (must point at a prior version)', () => {
    const root = loadJson(join(FIXTURES_DIR, 'skill-version.root.valid.json'));
    const bad = { ...root, version_kind: 'revert' };
    expect(validateSkillVersion(bad)).toBe(false);
  });

  it('DR-085 D5: version_kind=restore with parent_version_id: null → REJECT', () => {
    const root = loadJson(join(FIXTURES_DIR, 'skill-version.root.valid.json'));
    const bad = { ...root, version_kind: 'restore' };
    expect(validateSkillVersion(bad)).toBe(false);
  });
});

describe('schemas/v1 — HumanReview entity (net-new canonical, ISEDC DR-103 D1)', () => {
  let ajv: AjvInstance;
  let validateHumanReview: (data: unknown) => boolean;

  beforeAll(() => {
    ajv = buildAjv();
    const common = loadJson(join(SCHEMAS_DIR, '_common.schema.json'));
    ajv.addSchema(
      common,
      'https://github.com/jeremylongshore/intent-eval-core/schemas/v1/_common.schema.json',
    );
    validateHumanReview = ajv.compile(loadJson(join(SCHEMAS_DIR, 'human-review.schema.json')));
  });

  it('human-review.valid.json validates (full review, three channels, pinned)', () => {
    expect(validateHumanReview(loadJson(join(FIXTURES_DIR, 'human-review.valid.json')))).toBe(true);
  });

  it('human-review.root.valid.json validates (thumb-only, judge-pinned)', () => {
    expect(validateHumanReview(loadJson(join(FIXTURES_DIR, 'human-review.root.valid.json')))).toBe(
      true,
    );
  });

  it('DR-103 D1 B1.2: a review pinned to nothing (both session + judge null) → REJECT', () => {
    expect(
      validateHumanReview(loadJson(join(FIXTURES_DIR, 'human-review.invalid-no-pin.json'))),
    ).toBe(false);
  });

  it('DR-103 D1 B1.2: a service-account-authored review (reviewer_is_service_account=true) → REJECT', () => {
    expect(
      validateHumanReview(
        loadJson(join(FIXTURES_DIR, 'human-review.invalid-service-account.json')),
      ),
    ).toBe(false);
  });

  it('a review with all three signal channels null → REJECT (at-least-one-signal)', () => {
    expect(
      validateHumanReview(loadJson(join(FIXTURES_DIR, 'human-review.invalid-empty-signals.json'))),
    ).toBe(false);
  });

  it('DR-103 D2: tenant_id is optional-NOT-nullable (explicit null → REJECT)', () => {
    const base = loadJson(join(FIXTURES_DIR, 'human-review.valid.json'));
    expect(validateHumanReview({ ...base, tenant_id: null })).toBe(false);
  });

  it('an unknown extra field → REJECT (additionalProperties: false)', () => {
    const base = loadJson(join(FIXTURES_DIR, 'human-review.valid.json'));
    expect(validateHumanReview({ ...base, surprise: true })).toBe(false);
  });

  it('a prefixed (sha256:) input_hash → REJECT (entity hash is BARE)', () => {
    const base = loadJson(join(FIXTURES_DIR, 'human-review.valid.json'));
    expect(validateHumanReview({ ...base, input_hash: 'sha256:' + '3'.repeat(64) })).toBe(false);
  });

  it('a missing required pin KEY (session_trace_id omitted) → REJECT', () => {
    const base = loadJson(join(FIXTURES_DIR, 'human-review.valid.json'));
    const bad = { ...base };
    delete bad['session_trace_id'];
    expect(validateHumanReview(bad)).toBe(false);
  });
});

describe('schemas/v1 — UsageEvent entity (DR-103 D1 append-only product-metering ledger)', () => {
  let ajv: AjvInstance;
  let validateUsageEvent: (data: unknown) => boolean;

  beforeAll(() => {
    ajv = buildAjv();
    const common = loadJson(join(SCHEMAS_DIR, '_common.schema.json'));
    ajv.addSchema(
      common,
      'https://github.com/jeremylongshore/intent-eval-core/schemas/v1/_common.schema.json',
    );
    validateUsageEvent = ajv.compile(loadJson(join(SCHEMAS_DIR, 'usage-event.schema.json')));
  });

  it('usage-event.valid.json validates (metered eval_run row + verified source + cost_record_ref seam)', () => {
    expect(validateUsageEvent(loadJson(join(FIXTURES_DIR, 'usage-event.valid.json')))).toBe(true);
  });

  it('usage-event.api-call.valid.json validates (api_call is the ONLY meter exempt from the verified-source binding)', () => {
    expect(
      validateUsageEvent(loadJson(join(FIXTURES_DIR, 'usage-event.api-call.valid.json'))),
    ).toBe(true);
  });

  it('usage-event.tenant.valid.json validates (a present tenant_id is an attested claim; round-trips)', () => {
    expect(validateUsageEvent(loadJson(join(FIXTURES_DIR, 'usage-event.tenant.valid.json')))).toBe(
      true,
    );
  });

  it('DR-103 D1 B1.2 anti-gaming: a metered row with source_verified=false → REJECT (no metered count without verified provenance)', () => {
    expect(
      validateUsageEvent(
        loadJson(join(FIXTURES_DIR, 'usage-event.invalid-metered-unverified.json')),
      ),
    ).toBe(false);
  });

  it('DR-103 D1 B1.2 anti-gaming: a metered row with null source (type + id) → REJECT (no metered count without a gated source)', () => {
    expect(
      validateUsageEvent(
        loadJson(join(FIXTURES_DIR, 'usage-event.invalid-metered-null-source.json')),
      ),
    ).toBe(false);
  });

  it('meter out of the closed enum (dashboard_render) → REJECT (a predicate body, not a meter; DR-103 D1 B1.4)', () => {
    expect(
      validateUsageEvent(loadJson(join(FIXTURES_DIR, 'usage-event.invalid-bad-meter.json'))),
    ).toBe(false);
  });

  it('DR-103 D2: tenant_id is optional-NOT-nullable (explicit null → REJECT, byte-identical to the precedent)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'usage-event.valid.json'));
    const bad = { ...fix, tenant_id: null };
    expect(validateUsageEvent(bad)).toBe(false);
  });

  it('an unknown extra field → REJECT (additionalProperties: false)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'usage-event.valid.json'));
    const bad = { ...fix, rolled_total: 4003 };
    expect(validateUsageEvent(bad)).toBe(false);
  });

  it('DR-103 epic Rule 1: quantity is a non-negative integer count, never a fractional utility weight → REJECT a float', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'usage-event.valid.json'));
    const bad = { ...fix, quantity: 0.95 };
    expect(validateUsageEvent(bad)).toBe(false);
  });

  it('cost_record_ref is the seam to a SEPARATE table: a null ref is valid (the common, unpriced case)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'usage-event.valid.json'));
    const unpriced = { ...fix, cost_record_ref: null };
    expect(validateUsageEvent(unpriced)).toBe(true);
  });
});

describe('schemas/v1 — Blueprint B invariants codified in schemas', () => {
  let ajv: AjvInstance;
  let validateGate: (data: unknown) => boolean;
  let validateRollout: (data: unknown) => boolean;
  let validateJudge: (data: unknown) => boolean;
  let validateFailure: (data: unknown) => boolean;
  let validateMatcher: (data: unknown) => boolean;

  beforeAll(() => {
    ajv = buildAjv();
    const common = loadJson(join(SCHEMAS_DIR, '_common.schema.json'));
    ajv.addSchema(
      common,
      'https://github.com/jeremylongshore/intent-eval-core/schemas/v1/_common.schema.json',
    );
    ajv.addSchema(common, 'https://evals.intentsolutions.io/_common.schema.json');
    validateGate = ajv.compile(loadJson(join(SCHEMAS_DIR, 'gate-result.schema.json')));
    validateRollout = ajv.compile(loadJson(join(SCHEMAS_DIR, 'rollout-gate.schema.json')));
    validateJudge = ajv.compile(loadJson(join(SCHEMAS_DIR, 'judge-decision.schema.json')));
    validateFailure = ajv.compile(loadJson(join(SCHEMAS_DIR, 'failure-taxonomy.schema.json')));
    validateMatcher = ajv.compile(loadJson(join(SCHEMAS_DIR, 'matcher-map.schema.json')));
  });

  it('JudgeDecision UPPERCASE verdict and gate-result lowercase gate_decision do NOT cross', () => {
    const judge = loadJson(join(FIXTURES_DIR, 'judge-decision.valid.json'));
    // Swap UPPERCASE PASS for lowercase pass — must fail
    const bad = { ...judge, verdict: 'pass' };
    expect(validateJudge(bad)).toBe(false);
  });

  it('RolloutGate.decision=ship is rejected on gate-result/v1 (different enum)', () => {
    const gate = loadJson(join(FIXTURES_DIR, 'gate-result.valid.json'));
    const bad = { ...gate, gate_decision: 'ship' };
    expect(validateGate(bad)).toBe(false);
  });

  it('RolloutGate.decision=pass is rejected on rollout-gate (different enum)', () => {
    const rollout = loadJson(join(FIXTURES_DIR, 'rollout-gate.valid.json'));
    const bad = { ...rollout, decision: 'pass' };
    expect(validateRollout(bad)).toBe(false);
  });

  it('FailureTaxonomy.mm_class accepts MM-7+ (broader than MmClass enum)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'failure-taxonomy.valid.json'));
    const proposed = { ...fix, mm_class: 'MM-7', status: 'proposed' };
    expect(validateFailure(proposed)).toBe(true);
  });

  it('MatcherMap.mm_class REJECTS MM-7 (kernel enum lags taxonomy)', () => {
    const fix = loadJson(join(FIXTURES_DIR, 'matcher-map.valid.json'));
    const bad = { ...fix, mm_class: 'MM-7' };
    expect(validateMatcher(bad)).toBe(false);
  });

  it('subject_set entries on EvidenceBundle MUST satisfy SUBJECT_NAME_REGEX', () => {
    const validateBundle = ajv.compile(loadJson(join(SCHEMAS_DIR, 'evidence-bundle.schema.json')));
    const fix = loadJson(join(FIXTURES_DIR, 'evidence-bundle.valid.json'));
    const bad = JSON.parse(JSON.stringify(fix)) as { subject_set: { name: string }[] };
    const first = bad.subject_set[0];
    if (first) {
      first.name = 'INVALID UPPERCASE';
    }
    expect(validateBundle(bad)).toBe(false);
  });

  it('coverage.dimensions_skipped MUST be present even if empty (NOT_APPLICABLE encoding)', () => {
    const gate = loadJson(join(FIXTURES_DIR, 'gate-result.valid.json'));
    const bad = JSON.parse(JSON.stringify(gate)) as Record<string, unknown>;
    delete (bad['coverage'] as { dimensions_skipped?: unknown }).dimensions_skipped;
    expect(validateGate(bad)).toBe(false);
  });
});
