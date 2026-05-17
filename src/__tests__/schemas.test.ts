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
  it('ships exactly 13 entity schemas + 1 predicate + 1 common + 1 index = 16 files', () => {
    const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.json'));
    expect(files).toHaveLength(16);
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

  it('eval-spec with aggregation_rule=plurality → REJECT (not in closed enum)', () => {
    const fixture = loadJson(join(FIXTURES_DIR, 'eval-spec.invalid-bad-aggregation.json'));
    expect(validateSpec(fixture)).toBe(false);
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
