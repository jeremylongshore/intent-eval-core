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
  'session-trace',
  'tool-invocation',
  'cost-record',
  'failure-taxonomy',
] as const;

describe('schemas/v1 — structural integrity', () => {
  it('ships exactly 13 entity schemas + 3 predicates + 1 common + 1 index = 18 files', () => {
    // v0.2.0 added retraction/v1 + dashboard-render/v1 predicate schemas
    // alongside the v0.1 gate-result/v1 (16 → 18 files).
    const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(18);
  });

  it('every entity schema is referenced in index.json', () => {
    const idx = loadJson(join(SCHEMAS_DIR, 'index.json'));
    const schemas = idx['schemas'] as Record<string, { kind: string }>;
    const entityEntries = Object.values(schemas).filter((s) => s.kind === 'entity');
    expect(entityEntries).toHaveLength(13);
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
  ])('%s predicate URI lives at evals.intentsolutions.io (NOT labs)', (file, id) => {
    // CISO binding (DR-004 + DR-010): predicate URIs NEVER on labs.*
    const s = loadJson(join(SCHEMAS_DIR, file));
    expect(s['$id']).toBe(id);
    expect(JSON.stringify(s)).not.toContain('labs.intentsolutions.io');
  });

  it.each(['retraction.schema.json', 'dashboard-render.schema.json'])(
    '%s is closed-world (additionalProperties: false) + declares draft 2020-12',
    (file) => {
      const s = loadJson(join(SCHEMAS_DIR, file));
      expect(s['additionalProperties']).toBe(false);
      expect(s['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    },
  );

  it('index.json catalogs 3 predicate schemas (gate-result + retraction + dashboard-render)', () => {
    const idx = loadJson(join(SCHEMAS_DIR, 'index.json'));
    const schemas = idx['schemas'] as Record<string, { kind: string }>;
    const predicateEntries = Object.values(schemas).filter((s) => s.kind === 'predicate');
    expect(predicateEntries).toHaveLength(3);
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
