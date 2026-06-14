/**
 * Audit-deferred kernel-spec lockups — type + runtime tests.
 *
 * Covers the 6 audit deferrals locked additively in this PR. Each cites its
 * bead and the Blueprint B section the deferral hung off:
 *
 *   - deferral-A (bd_000-projects-gzgj) — AssertionExpression typed-class enum
 *   - deferral-B (bd_000-projects-ra9a) — MatcherInputPattern.structural payload
 *   - deferral-C (bd_000-projects-21re) — ScoringConfig weights/tiebreaker
 *   - deferral-D (bd_000-projects-9xyk) — gate-result/v1 coverage-detail element
 *   - deferral-E (bd_000-projects-84li) — ToolInvocationError.enum_class registry
 *   - deferral-G (bd_000-projects-k0fj) — tenant_id reservation
 *
 * Type assertions prove the locked shapes; runtime assertions cover the kernel
 * helper functions + runtime tuples.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  ASSERTION_CLASSES,
  ERROR_CLASS_PATTERN,
  KERNEL_ERROR_CLASSES,
  STRUCTURAL_OPS,
  isKernelErrorClass,
  isWellFormedErrorClass,
  type AssertionClass,
  type AssertionExpression,
  type AssertionExpressionExtension,
  type CoverageDimensionDetail,
  type CoverageDimensionStatus,
  type EvalRun,
  type EvalSpec,
  type KernelErrorClass,
  type MatcherInputPattern,
  type NamedAssertionExpression,
  type ScoringConfig,
  type ScoringWeight,
  type ScoringWeightDimension,
  type SkillSnapshot,
  type StructuralConstraint,
  type StructuralMatcher,
  type StructuralOp,
  type ToolInvocationError,
  type Uuidv7,
} from '../index.js';

describe('deferral-A: AssertionExpression typed-class enum (bd_000-projects-gzgj)', () => {
  it('AssertionClass is the closed v1 named set', () => {
    expectTypeOf<AssertionClass>().toEqualTypeOf<
      | 'output-equals'
      | 'output-contains'
      | 'output-matches'
      | 'schema-conforms'
      | 'judge-verdict'
      | 'matcher-satisfied'
    >();
  });

  it('ASSERTION_CLASSES runtime tuple mirrors the type', () => {
    expect(ASSERTION_CLASSES).toEqual([
      'output-equals',
      'output-contains',
      'output-matches',
      'schema-conforms',
      'judge-verdict',
      'matcher-satisfied',
    ]);
    expect(ASSERTION_CLASSES).toHaveLength(6);
  });

  it('a named assertion narrows on `class`', () => {
    const a: NamedAssertionExpression = {
      class: 'output-equals',
      target: 'PASS',
      negate: false,
    };
    expect(a.class).toBe('output-equals');
  });

  it('an extension assertion carries the `extension: true` discriminator', () => {
    const ext: AssertionExpressionExtension = {
      class: 'tool.custom-assertion',
      target: { anything: true },
      extension: true,
    };
    expect(ext.extension).toBe(true);
    const expr: AssertionExpression = ext;
    expect(expr.class).toBe('tool.custom-assertion');
  });
});

describe('deferral-B: MatcherInputPattern.structural payload (bd_000-projects-ra9a)', () => {
  it('STRUCTURAL_OPS runtime tuple is the closed v1 op set', () => {
    expect(STRUCTURAL_OPS).toEqual([
      'exists',
      'absent',
      'equals',
      'type-is',
      'matches',
      'length-equals',
    ]);
    expectTypeOf<StructuralOp>().toEqualTypeOf<
      'exists' | 'absent' | 'equals' | 'type-is' | 'matches' | 'length-equals'
    >();
  });

  it('a structural matcher is a conjunction of path-anchored constraints', () => {
    const presence: StructuralConstraint = { path: 'result.status', op: 'exists' };
    const valued: StructuralConstraint = { path: 'result.code', op: 'equals', value: 200 };
    const matcher: StructuralMatcher = { mode: 'all', constraints: [presence, valued] };
    expect(matcher.mode).toBe('all');
    expect(matcher.constraints).toHaveLength(2);
  });

  it('the structural variant of MatcherInputPattern carries the locked shape', () => {
    const pattern: MatcherInputPattern = {
      kind: 'structural',
      matcher: { mode: 'all', constraints: [{ path: 'a.b', op: 'type-is', value: 'string' }] },
    };
    if (pattern.kind === 'structural') {
      expectTypeOf(pattern.matcher).toEqualTypeOf<StructuralMatcher>();
    }
  });
});

describe('deferral-C: ScoringConfig weights/tiebreaker (bd_000-projects-21re)', () => {
  it('ScoringWeightDimension is the closed v1 set', () => {
    expectTypeOf<ScoringWeightDimension>().toEqualTypeOf<'matcher' | 'mm-class' | 'judge'>();
  });

  it('a weighted ScoringConfig names its weights + dimension + tiebreaker', () => {
    const w: ScoringWeight = { key: 'matcher-1', weight: 0.7 };
    const scoring: ScoringConfig = {
      aggregation_rule: 'weighted',
      weight_dimension: 'matcher',
      weights: [w],
      tiebreaker: 'fail-closed',
    };
    expect(scoring.weights?.[0]?.weight).toBe(0.7);
    expect(scoring.tiebreaker).toBe('fail-closed');
  });

  it('a majority ScoringConfig omits the weighted-only fields (backward-compat)', () => {
    const scoring: ScoringConfig = { aggregation_rule: 'majority' };
    expect(scoring.weights).toBeUndefined();
  });
});

describe('deferral-D: gate-result/v1 coverage-detail element (bd_000-projects-9xyk)', () => {
  it('CoverageDimensionStatus is the closed evaluated|skipped set', () => {
    expectTypeOf<CoverageDimensionStatus>().toEqualTypeOf<'evaluated' | 'skipped'>();
  });

  it('a coverage-detail element carries id + status + optional descriptive numbers', () => {
    const detail: CoverageDimensionDetail = {
      id: 'credential-leak',
      status: 'evaluated',
      threshold: 0,
      observed: 0,
    };
    expect(detail.id).toBe('credential-leak');
    expect(detail.status).toBe('evaluated');
  });

  it('a skipped coverage-detail element carries a skip_reason', () => {
    const detail: CoverageDimensionDetail = {
      id: 'browser-e2e',
      status: 'skipped',
      skip_reason: 'no browser dimension applies to this gate',
    };
    expect(detail.status).toBe('skipped');
  });
});

describe('deferral-E: ToolInvocationError.enum_class registry (bd_000-projects-84li)', () => {
  it('KERNEL_ERROR_CLASSES is the cross-cutting registry tuple', () => {
    expect(KERNEL_ERROR_CLASSES).toContain('network.timeout');
    expect(KERNEL_ERROR_CLASSES).toContain('provider.rate_limited');
    expect(KERNEL_ERROR_CLASSES).toContain('tool.crashed');
  });

  it('isKernelErrorClass recognizes a registered class and rejects a tool-defined one', () => {
    expect(isKernelErrorClass('network.timeout')).toBe(true);
    expect(isKernelErrorClass('provider.unavailable')).toBe(true);
    // Tool-defined classes are NOT kernel-registered (the enum stays open).
    expect(isKernelErrorClass('audit-harness.escape_detected')).toBe(false);
    expect(isKernelErrorClass('not-even-an-error-class')).toBe(false);
  });

  it('a KernelErrorClass value is assignable to enum_class (string-open)', () => {
    const cls: KernelErrorClass = 'tool.invalid_args';
    const err: ToolInvocationError = { enum_class: cls, message: 'bad args' };
    expect(err.enum_class).toBe('tool.invalid_args');
  });

  it('isWellFormedErrorClass enforces the <domain>.<condition> convention', () => {
    expect(isWellFormedErrorClass('network.timeout')).toBe(true);
    expect(isWellFormedErrorClass('audit_harness.escape_detected')).toBe(true);
    expect(isWellFormedErrorClass('a.b.c')).toBe(true);
    // No dot → not a registered class (bare token).
    expect(isWellFormedErrorClass('timeout')).toBe(false);
    // Uppercase / leading dot / trailing dot are malformed.
    expect(isWellFormedErrorClass('Network.Timeout')).toBe(false);
    expect(isWellFormedErrorClass('.timeout')).toBe(false);
    expect(isWellFormedErrorClass('network.')).toBe(false);
  });

  it('ERROR_CLASS_PATTERN is exported for downstream reuse', () => {
    expect(ERROR_CLASS_PATTERN.test('provider.rate_limited')).toBe(true);
    expect(ERROR_CLASS_PATTERN.test('nope')).toBe(false);
  });
});

describe('deferral-G: tenant_id reservation (bd_000-projects-k0fj)', () => {
  const tid = '0192cae6-9999-7000-8000-000000000000' as Uuidv7;

  it('EvalSpec reserves an optional tenant_id', () => {
    expectTypeOf<EvalSpec>().toHaveProperty('tenant_id').toEqualTypeOf<Uuidv7 | undefined>();
  });

  it('EvalRun reserves an optional tenant_id', () => {
    expectTypeOf<EvalRun>().toHaveProperty('tenant_id').toEqualTypeOf<Uuidv7 | undefined>();
  });

  it('SkillSnapshot reserves an optional tenant_id', () => {
    expectTypeOf<SkillSnapshot>().toHaveProperty('tenant_id').toEqualTypeOf<Uuidv7 | undefined>();
  });

  it('the slot is a UUIDv7 brand when present (single-tenant v1 omits it)', () => {
    expect(typeof tid).toBe('string');
  });
});
