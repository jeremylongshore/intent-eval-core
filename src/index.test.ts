import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  canTransition,
  evalRunTerminalStates,
  evalRunTransitions,
  evalSpecTransitions,
  matcherMapTransitions,
  type CompositionEdge,
  type CompositionEdgeKind,
  type CompositionNode,
  type EvalRun,
  type EvalRunState,
  type EvalRunTerminalReason,
  type EvalRunTerminalState,
  type EvalSpec,
  type EvalSpecState,
  type MatcherExpectedBehavior,
  type MatcherExpectedBehaviorKindV1,
  type MatcherInputPattern,
  type MatcherMap,
  type MatcherMapState,
  type MmClass,
  type Rfc3339,
  type ScoringAggregationRule,
  type Sha256,
  type Uuidv7,
} from './index.js';

describe('@intentsolutions/core public surface', () => {
  it('re-exports the canTransition helper', () => {
    expect(typeof canTransition).toBe('function');
  });
});

describe('state machines (runtime)', () => {
  it('EvalSpec transitions cover the documented paths (Blueprint B § 2.1)', () => {
    expect(canTransition(evalSpecTransitions, 'draft', 'published')).toBe(true);
    expect(canTransition(evalSpecTransitions, 'published', 'deprecated')).toBe(true);
    expect(canTransition(evalSpecTransitions, 'deprecated', 'published')).toBe(true);
    expect(canTransition(evalSpecTransitions, 'draft', 'deprecated')).toBe(false);
  });

  it('EvalRun transitions match Blueprint B § 3.1 table', () => {
    expect(canTransition(evalRunTransitions, 'queued', 'running')).toBe(true);
    expect(canTransition(evalRunTransitions, 'running', 'judged')).toBe(true);
    expect(canTransition(evalRunTransitions, 'judged', 'reported')).toBe(true);
    expect(canTransition(evalRunTransitions, 'reported', 'archived')).toBe(true);
    expect(canTransition(evalRunTransitions, 'queued', 'archived_failed')).toBe(true);
    expect(canTransition(evalRunTransitions, 'running', 'archived_failed')).toBe(true);
    expect(canTransition(evalRunTransitions, 'judged', 'archived_failed')).toBe(true);
    expect(canTransition(evalRunTransitions, 'reported', 'archived_failed')).toBe(true);
    for (const t of evalRunTerminalStates) {
      expect(evalRunTransitions[t]).toHaveLength(0);
    }
    expect(canTransition(evalRunTransitions, 'judged', 'running')).toBe(false);
    expect(canTransition(evalRunTransitions, 'archived', 'reported')).toBe(false);
  });

  it('MatcherMap deprecate is one-way (no reversal)', () => {
    expect(canTransition(matcherMapTransitions, 'draft', 'published')).toBe(true);
    expect(canTransition(matcherMapTransitions, 'published', 'deprecated')).toBe(true);
    expect(canTransition(matcherMapTransitions, 'deprecated', 'published')).toBe(false);
  });
});

describe('type-level: state literal unions exactly match Blueprint B § 2', () => {
  it('EvalSpecState is draft|published|deprecated', () => {
    expectTypeOf<EvalSpecState>().toEqualTypeOf<'draft' | 'published' | 'deprecated'>();
  });

  it('EvalRunState has the 7 documented states', () => {
    expectTypeOf<EvalRunState>().toEqualTypeOf<
      | 'queued'
      | 'running'
      | 'judged'
      | 'reported'
      | 'archived'
      | 'skipped_due_to_gate'
      | 'archived_failed'
    >();
  });

  it('EvalRunTerminalState is the 3-element subset', () => {
    expectTypeOf<EvalRunTerminalState>().toEqualTypeOf<
      'archived' | 'skipped_due_to_gate' | 'archived_failed'
    >();
  });

  it('EvalRunTerminalReason includes upstream_feed_failed from § 1.3', () => {
    expectTypeOf<EvalRunTerminalReason>().toEqualTypeOf<
      | 'queued_timeout_elapsed'
      | 'run_timeout_elapsed'
      | 'worker_crash_exhausted'
      | 'credential_leak_detected'
      | 'judge_unavailable_exhausted'
      | 'token_ceiling_exceeded'
      | 'evidence_contract_violation'
      | 'upstream_feed_failed'
    >();
  });

  it('MatcherMapState is draft|published|deprecated', () => {
    expectTypeOf<MatcherMapState>().toEqualTypeOf<'draft' | 'published' | 'deprecated'>();
  });

  it('MmClass covers v1 canonical MM-1..MM-6', () => {
    expectTypeOf<MmClass>().toEqualTypeOf<'MM-1' | 'MM-2' | 'MM-3' | 'MM-4' | 'MM-5' | 'MM-6'>();
  });

  it('ScoringAggregationRule is the closed § 2.1 enum', () => {
    expectTypeOf<ScoringAggregationRule>().toEqualTypeOf<'majority' | 'unanimous' | 'weighted'>();
  });
});

describe('type-level: composition DAG (Blueprint B § 1.3)', () => {
  it('CompositionEdgeKind is the closed feeds|gates|enriches enum', () => {
    expectTypeOf<CompositionEdgeKind>().toEqualTypeOf<'feeds' | 'gates' | 'enriches'>();
  });

  it('CompositionNode.kind is the 2-element enum (eval_run|tool_invocation)', () => {
    expectTypeOf<CompositionNode>()
      .toHaveProperty('kind')
      .toEqualTypeOf<'eval_run' | 'tool_invocation'>();
  });

  it('CompositionEdge carries from/to/kind', () => {
    expectTypeOf<CompositionEdge>().toHaveProperty('from').toEqualTypeOf<string>();
    expectTypeOf<CompositionEdge>().toHaveProperty('to').toEqualTypeOf<string>();
    expectTypeOf<CompositionEdge>().toHaveProperty('kind').toEqualTypeOf<CompositionEdgeKind>();
  });
});

describe('type-level: MatcherMap discriminated unions (Blueprint B § 2.3)', () => {
  it('MatcherInputPattern is the closed 3-variant union', () => {
    const regex: MatcherInputPattern = { kind: 'regex', pattern: '.*' };
    const json: MatcherInputPattern = { kind: 'json-schema', schema: {} };
    const structural: MatcherInputPattern = {
      kind: 'structural',
      matcher: { mode: 'all', constraints: [{ path: 'result.status', op: 'exists' }] },
    };
    expect(regex.kind).toBe('regex');
    expect(json.kind).toBe('json-schema');
    expect(structural.kind).toBe('structural');
    // Type-level discrimination: TS narrows on `kind`
    if (regex.kind === 'regex') {
      expectTypeOf(regex).toHaveProperty('pattern').toEqualTypeOf<string>();
    }
  });

  it('MatcherExpectedBehaviorKindV1 is the 4 v1 named variants', () => {
    expectTypeOf<MatcherExpectedBehaviorKindV1>().toEqualTypeOf<
      'exact' | 'semantic' | 'contract-conformance' | 'redaction-confirmed'
    >();
  });

  it('MatcherExpectedBehavior accepts v1 variants without extension flag', () => {
    const exact: MatcherExpectedBehavior = { kind: 'exact' };
    const semantic: MatcherExpectedBehavior = { kind: 'semantic', payload: { threshold: 0.9 } };
    expect(exact.kind).toBe('exact');
    expect(semantic.kind).toBe('semantic');
  });

  it('MatcherExpectedBehavior accepts extension variants with extension:true marker', () => {
    const ext: MatcherExpectedBehavior = {
      kind: 'custom-tool-specific',
      payload: { foo: 'bar' },
      extension: true,
    };
    expect(ext.kind).toBe('custom-tool-specific');
    if ('extension' in ext && ext.extension) {
      expectTypeOf(ext).toHaveProperty('payload').toEqualTypeOf<unknown>();
    }
  });
});

describe('type-level: branded primitives prevent accidental crossover', () => {
  it('Uuidv7 and Sha256 are not assignable to each other', () => {
    expectTypeOf<Uuidv7>().not.toEqualTypeOf<Sha256>();
    expectTypeOf<Sha256>().not.toEqualTypeOf<Uuidv7>();
  });

  it('Rfc3339 is not just a string', () => {
    expectTypeOf<Rfc3339>().not.toEqualTypeOf<string>();
  });
});

describe('type-level: entity shapes have the required FKs from Blueprint B', () => {
  it('EvalRun carries the lifecycle-required FKs', () => {
    expectTypeOf<EvalRun>().toHaveProperty('eval_spec_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<EvalRun>().toHaveProperty('skill_snapshot_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<EvalRun>().toHaveProperty('session_trace_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<EvalRun>().toHaveProperty('cost_record_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<EvalRun>().toHaveProperty('evidence_bundle_id').toEqualTypeOf<Uuidv7 | null>();
    expectTypeOf<EvalRun>().toHaveProperty('parent_run_id').toEqualTypeOf<Uuidv7 | null>();
  });

  it('EvalSpec carries matchers as a UUID array and composition as DAG', () => {
    expectTypeOf<EvalSpec>().toHaveProperty('matchers').toEqualTypeOf<readonly Uuidv7[]>();
    expectTypeOf<EvalSpec>()
      .toHaveProperty('composition')
      .toHaveProperty('edges')
      .toEqualTypeOf<readonly CompositionEdge[]>();
  });

  it('MatcherMap carries mm_class as the closed enum + typed pattern + typed behavior', () => {
    expectTypeOf<MatcherMap>().toHaveProperty('mm_class').toEqualTypeOf<MmClass>();
    expectTypeOf<MatcherMap>().toHaveProperty('input_pattern').toEqualTypeOf<MatcherInputPattern>();
    expectTypeOf<MatcherMap>()
      .toHaveProperty('expected_behavior')
      .toEqualTypeOf<MatcherExpectedBehavior>();
  });
});
