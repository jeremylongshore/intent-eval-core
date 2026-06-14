/**
 * Zod-validator tests for the 6 audit-deferred kernel-spec lockups.
 *
 * Pairs with src/entities/deferral-specs.test.ts (which covers the entity
 * types + helpers). This file exercises the runtime validators:
 *   - deferral-A: AssertionExpressionSchema named + extension variants
 *   - deferral-B: StructuralMatcherSchema / MatcherInputPatternSchema structural
 *   - deferral-C: ScoringConfigSchema weights/dimension/tiebreaker
 *   - deferral-D: GateResultV1Schema.coverage_detail + cross-field invariant
 *   - deferral-E: ErrorClassSchema / ToolInvocationErrorSchema format
 *   - deferral-G: tenant_id optional on EvalSpec/EvalRun/SkillSnapshot
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AssertionExpressionSchema,
  ErrorClassSchema,
  EvalRunSchema,
  EvalSpecSchema,
  GateResultV1Schema,
  MatcherInputPatternSchema,
  ScoringConfigSchema,
  SkillSnapshotSchema,
  StructuralMatcherSchema,
  ToolInvocationErrorSchema,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../../tests/fixtures/v1');

function loadJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8')) as Record<string, unknown>;
}

const TENANT = '0192cae6-9999-7000-8000-000000000000';

describe('deferral-A — AssertionExpressionSchema (bd_000-projects-gzgj)', () => {
  it('accepts a named-class assertion', () => {
    const r = AssertionExpressionSchema.safeParse({ class: 'output-equals', target: 'PASS' });
    expect(r.success).toBe(true);
  });

  it('accepts an extension assertion with extension:true', () => {
    const r = AssertionExpressionSchema.safeParse({
      class: 'tool.custom',
      target: {},
      extension: true,
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown named class without the extension discriminator', () => {
    const r = AssertionExpressionSchema.safeParse({ class: 'made-up', target: {} });
    expect(r.success).toBe(false);
  });

  it('parses inside a full EvalSpec assertions array', () => {
    const spec = loadJson('eval-spec.valid.json');
    const withAssertions = {
      ...spec,
      assertions: [
        { class: 'output-contains', target: 'ok', negate: true },
        { class: 'x.custom', target: 1, extension: true },
      ],
    };
    expect(EvalSpecSchema.safeParse(withAssertions).success).toBe(true);
  });
});

describe('deferral-B — structural matcher (bd_000-projects-ra9a)', () => {
  it('StructuralMatcherSchema accepts a conjunction of constraints', () => {
    const r = StructuralMatcherSchema.safeParse({
      mode: 'all',
      constraints: [
        { path: 'result.status', op: 'exists' },
        { path: 'result.code', op: 'equals', value: 200 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects mode other than `all`', () => {
    const r = StructuralMatcherSchema.safeParse({ mode: 'any', constraints: [] });
    expect(r.success).toBe(false);
  });

  it('rejects an empty path', () => {
    const r = StructuralMatcherSchema.safeParse({
      mode: 'all',
      constraints: [{ path: '', op: 'exists' }],
    });
    expect(r.success).toBe(false);
  });

  it('the structural variant flows through MatcherInputPatternSchema', () => {
    const r = MatcherInputPatternSchema.safeParse({
      kind: 'structural',
      matcher: { mode: 'all', constraints: [{ path: 'a', op: 'matches', value: '^x' }] },
    });
    expect(r.success).toBe(true);
  });

  it('rejects the old undefined structural payload (now locked)', () => {
    const r = MatcherInputPatternSchema.safeParse({ kind: 'structural', matcher: null });
    expect(r.success).toBe(false);
  });
});

describe('deferral-C — ScoringConfig weights/tiebreaker (bd_000-projects-21re)', () => {
  it('accepts a weighted config with named weights + dimension + tiebreaker', () => {
    const r = ScoringConfigSchema.safeParse({
      aggregation_rule: 'weighted',
      weight_dimension: 'mm-class',
      weights: [{ key: 'MM-4', weight: 2 }],
      tiebreaker: 'first-listed',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a negative weight', () => {
    const r = ScoringConfigSchema.safeParse({
      aggregation_rule: 'weighted',
      weights: [{ key: 'm', weight: -1 }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects an out-of-set tiebreaker', () => {
    const r = ScoringConfigSchema.safeParse({
      aggregation_rule: 'weighted',
      tiebreaker: 'coin-flip',
    });
    expect(r.success).toBe(false);
  });

  it('a majority config without weighted fields still parses (backward-compat)', () => {
    const r = ScoringConfigSchema.safeParse({ aggregation_rule: 'majority' });
    expect(r.success).toBe(true);
  });
});

describe('deferral-D — gate-result coverage_detail cross-field invariant (bd_000-projects-9xyk)', () => {
  function baseGate(): Record<string, unknown> {
    return loadJson('gate-result.valid.json');
  }

  it('accepts coverage_detail whose ids are members of the matching coverage arrays', () => {
    const gate = baseGate();
    const coverage = gate['coverage'] as { dimensions_evaluated: string[] };
    const id = coverage.dimensions_evaluated[0]!;
    const r = GateResultV1Schema.safeParse({
      ...gate,
      coverage_detail: [{ id, status: 'evaluated', threshold: 0, observed: 0 }],
    });
    expect(r.success, JSON.stringify(!r.success && r.error.issues)).toBe(true);
  });

  it('accepts a skipped detail whose id is in dimensions_skipped', () => {
    const gate = baseGate();
    const r = GateResultV1Schema.safeParse({
      ...gate,
      coverage: { dimensions_evaluated: ['credential-leak'], dimensions_skipped: ['browser-e2e'] },
      coverage_detail: [{ id: 'browser-e2e', status: 'skipped', skip_reason: 'n/a' }],
    });
    expect(r.success).toBe(true);
  });

  it('REJECTS a coverage_detail id not present in the matching coverage array', () => {
    const gate = baseGate();
    const r = GateResultV1Schema.safeParse({
      ...gate,
      coverage_detail: [{ id: 'not-a-declared-dimension', status: 'evaluated' }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.startsWith('coverage_detail'))).toBe(true);
    }
  });

  it('REJECTS a detail whose status mismatches which coverage array holds its id', () => {
    const gate = baseGate();
    const coverage = gate['coverage'] as { dimensions_evaluated: string[] };
    const id = coverage.dimensions_evaluated[0]!;
    // id is in dimensions_evaluated but the detail claims status=skipped → invariant breach.
    const r = GateResultV1Schema.safeParse({
      ...gate,
      coverage_detail: [{ id, status: 'skipped' }],
    });
    expect(r.success).toBe(false);
  });

  it('coverage_detail is optional — omitting it leaves the row valid (additive)', () => {
    expect(GateResultV1Schema.safeParse(baseGate()).success).toBe(true);
  });
});

describe('deferral-E — error-class registry format (bd_000-projects-84li)', () => {
  it('ErrorClassSchema accepts a well-formed <domain>.<condition> class', () => {
    expect(ErrorClassSchema.safeParse('network.timeout').success).toBe(true);
    expect(ErrorClassSchema.safeParse('audit_harness.escape_detected').success).toBe(true);
  });

  it('ErrorClassSchema rejects a bare token (no dot)', () => {
    expect(ErrorClassSchema.safeParse('timeout').success).toBe(false);
  });

  it('ToolInvocationErrorSchema enforces the class format', () => {
    expect(
      ToolInvocationErrorSchema.safeParse({ enum_class: 'provider.rate_limited', message: 'slow' })
        .success,
    ).toBe(true);
    expect(
      ToolInvocationErrorSchema.safeParse({ enum_class: 'NotValid', message: 'x' }).success,
    ).toBe(false);
  });
});

describe('deferral-G — tenant_id reservation (bd_000-projects-k0fj)', () => {
  it('EvalSpec accepts an optional tenant_id', () => {
    const spec = loadJson('eval-spec.valid.json');
    expect(EvalSpecSchema.safeParse({ ...spec, tenant_id: TENANT }).success).toBe(true);
  });

  it('EvalSpec without tenant_id still parses (single-tenant v1)', () => {
    expect(EvalSpecSchema.safeParse(loadJson('eval-spec.valid.json')).success).toBe(true);
  });

  it('EvalRun accepts an optional tenant_id', () => {
    const run = loadJson('eval-run.valid.json');
    expect(EvalRunSchema.safeParse({ ...run, tenant_id: TENANT }).success).toBe(true);
  });

  it('SkillSnapshot accepts an optional tenant_id', () => {
    const snap = loadJson('skill-snapshot.valid.json');
    expect(SkillSnapshotSchema.safeParse({ ...snap, tenant_id: TENANT }).success).toBe(true);
  });

  it('a malformed tenant_id is rejected (UUIDv7 brand)', () => {
    const spec = loadJson('eval-spec.valid.json');
    expect(EvalSpecSchema.safeParse({ ...spec, tenant_id: 'not-a-uuid' }).success).toBe(false);
  });
});
