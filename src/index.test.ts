import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  canTransition,
  evalRunTerminalStates,
  evalRunTransitions,
  evalSpecTransitions,
  matcherMapTransitions,
  type EvalRun,
  type EvalRunState,
  type EvalRunTerminalState,
  type EvalSpec,
  type EvalSpecState,
  type MatcherMap,
  type MatcherMapState,
  type MmClass,
  type Rfc3339,
  type Sha256,
  type Uuidv7,
} from './index.js';

describe('@intent-eval/core public surface', () => {
  it('re-exports the canTransition helper', () => {
    expect(typeof canTransition).toBe('function');
  });
});

describe('state machines', () => {
  it('EvalSpec transitions cover the documented paths (Blueprint B § 2.1)', () => {
    expect(canTransition(evalSpecTransitions, 'draft', 'published')).toBe(true);
    expect(canTransition(evalSpecTransitions, 'published', 'deprecated')).toBe(true);
    // Reversible deprecate per Blueprint B
    expect(canTransition(evalSpecTransitions, 'deprecated', 'published')).toBe(true);
    expect(canTransition(evalSpecTransitions, 'draft', 'deprecated')).toBe(false);
  });

  it('EvalRun transitions match Blueprint B § 3.1 table', () => {
    expect(canTransition(evalRunTransitions, 'queued', 'running')).toBe(true);
    expect(canTransition(evalRunTransitions, 'running', 'judged')).toBe(true);
    expect(canTransition(evalRunTransitions, 'judged', 'reported')).toBe(true);
    expect(canTransition(evalRunTransitions, 'reported', 'archived')).toBe(true);
    // Any non-terminal can fail to archived_failed
    expect(canTransition(evalRunTransitions, 'queued', 'archived_failed')).toBe(true);
    expect(canTransition(evalRunTransitions, 'running', 'archived_failed')).toBe(true);
    expect(canTransition(evalRunTransitions, 'judged', 'archived_failed')).toBe(true);
    expect(canTransition(evalRunTransitions, 'reported', 'archived_failed')).toBe(true);
    // No transitions out of terminals
    for (const t of evalRunTerminalStates) {
      expect(evalRunTransitions[t]).toHaveLength(0);
    }
    // Disallowed: skip backwards
    expect(canTransition(evalRunTransitions, 'judged', 'running')).toBe(false);
    expect(canTransition(evalRunTransitions, 'archived', 'reported')).toBe(false);
  });

  it('MatcherMap deprecate is one-way (no reversal)', () => {
    expect(canTransition(matcherMapTransitions, 'draft', 'published')).toBe(true);
    expect(canTransition(matcherMapTransitions, 'published', 'deprecated')).toBe(true);
    expect(canTransition(matcherMapTransitions, 'deprecated', 'published')).toBe(false);
  });
});

describe('type-level: state literal unions are exactly Blueprint B § 2', () => {
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

  it('MatcherMapState is draft|published|deprecated', () => {
    expectTypeOf<MatcherMapState>().toEqualTypeOf<'draft' | 'published' | 'deprecated'>();
  });

  it('MmClass covers v1 canonical MM-1..MM-6', () => {
    expectTypeOf<MmClass>().toEqualTypeOf<'MM-1' | 'MM-2' | 'MM-3' | 'MM-4' | 'MM-5' | 'MM-6'>();
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

  it('EvalSpec carries matchers as a UUID array', () => {
    expectTypeOf<EvalSpec>().toHaveProperty('matchers').toEqualTypeOf<readonly Uuidv7[]>();
  });

  it('MatcherMap carries mm_class as the closed enum', () => {
    expectTypeOf<MatcherMap>().toHaveProperty('mm_class').toEqualTypeOf<MmClass>();
  });
});
