/**
 * Type + runtime tests for E02d entities: SessionTrace, ToolInvocation,
 * CostRecord, FailureTaxonomy. Each test cites the Blueprint B section.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  canTransition,
  costRecordTransitions,
  failureTaxonomyTransitions,
  sessionTraceTransitions,
  toolInvocationTransitions,
  type CostAttributionClass,
  type CostRecord,
  type CostRecordState,
  type FailureTaxonomy,
  type FailureTaxonomyExample,
  type FailureTaxonomyState,
  type FailureTaxonomyStatus,
  type MicroUsd,
  type MmClass,
  type MmClassId,
  type OtelSpanId,
  type Rfc3339,
  type SessionTrace,
  type SessionTraceState,
  type StorageKey,
  type ToolInvocation,
  type ToolInvocationError,
  type ToolInvocationState,
  type Uuidv7,
} from '../index.js';

describe('SessionTrace (Blueprint B § 2.10)', () => {
  it('state machine: open → closed (closed is terminal)', () => {
    expectTypeOf<SessionTraceState>().toEqualTypeOf<'open' | 'closed'>();
    expect(canTransition(sessionTraceTransitions, 'open', 'closed')).toBe(true);
    expect(sessionTraceTransitions.closed).toHaveLength(0);
    // Cannot re-open a closed trace
    expect(canTransition(sessionTraceTransitions, 'closed', 'open')).toBe(false);
  });

  it('1:1 with EvalRun + nullable closed_at + OTel root span', () => {
    expectTypeOf<SessionTrace>().toHaveProperty('eval_run_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<SessionTrace>().toHaveProperty('closed_at').toEqualTypeOf<Rfc3339 | null>();
    expectTypeOf<SessionTrace>().toHaveProperty('root_span_id').toEqualTypeOf<OtelSpanId>();
  });

  it('carries the 4 summary counters', () => {
    expectTypeOf<SessionTrace>().toHaveProperty('total_spans').toEqualTypeOf<number>();
    expectTypeOf<SessionTrace>().toHaveProperty('max_loop_depth').toEqualTypeOf<number>();
    expectTypeOf<SessionTrace>().toHaveProperty('total_tool_invocations').toEqualTypeOf<number>();
    expectTypeOf<SessionTrace>().toHaveProperty('total_judge_decisions').toEqualTypeOf<number>();
  });
});

describe('ToolInvocation (Blueprint B § 2.11)', () => {
  it('state machine: invoked is terminal single-state (retries = new rows)', () => {
    expectTypeOf<ToolInvocationState>().toEqualTypeOf<'invoked'>();
    expect(toolInvocationTransitions.invoked).toHaveLength(0);
  });

  it('ToolInvocationError has {enum_class, message} shape per § 2.11', () => {
    expectTypeOf<ToolInvocationError>().toEqualTypeOf<{
      readonly enum_class: string;
      readonly message: string;
    }>();
  });

  it('carries args_hash + result_hash for replay-determinism', () => {
    expectTypeOf<ToolInvocation>().toHaveProperty('args_hash');
    expectTypeOf<ToolInvocation>().toHaveProperty('result_hash');
  });

  it('result_storage_key nullable for inline-only results', () => {
    expectTypeOf<ToolInvocation>()
      .toHaveProperty('result_storage_key')
      .toEqualTypeOf<StorageKey | null>();
  });

  it('error nullable; retry_attempt is 0-indexed integer', () => {
    expectTypeOf<ToolInvocation>()
      .toHaveProperty('error')
      .toEqualTypeOf<ToolInvocationError | null>();
    expectTypeOf<ToolInvocation>().toHaveProperty('retry_attempt').toEqualTypeOf<number>();
  });

  it('tool_id is opaque string (colon-convention not enforced at kernel layer)', () => {
    // Spec examples: 'audit-harness:escape-scan', 'provider:anthropic:claude-sonnet-4-5'
    const inHouse: ToolInvocation['tool_id'] = 'audit-harness:escape-scan';
    const provider: ToolInvocation['tool_id'] = 'provider:anthropic:claude-sonnet-4-5';
    expect(inHouse.split(':').length).toBe(2);
    expect(provider.split(':').length).toBe(3);
  });
});

describe('CostRecord (Blueprint B § 2.12)', () => {
  it('CostAttributionClass is the closed 7-element enum', () => {
    expectTypeOf<CostAttributionClass>().toEqualTypeOf<
      'run' | 'provider' | 'judge' | 'replay' | 'cache_decision' | 'optimizer_experiment' | 'system'
    >();
  });

  it('state machine: recorded is terminal single-state', () => {
    expectTypeOf<CostRecordState>().toEqualTypeOf<'recorded'>();
    expect(costRecordTransitions.recorded).toHaveLength(0);
  });

  it('both eval_run_id AND tool_invocation_id are nullable per § 2.12', () => {
    // System rollups have neither; run rollups have only eval_run_id;
    // tool rows have both.
    expectTypeOf<CostRecord>().toHaveProperty('eval_run_id').toEqualTypeOf<Uuidv7 | null>();
    expectTypeOf<CostRecord>().toHaveProperty('tool_invocation_id').toEqualTypeOf<Uuidv7 | null>();
  });

  it('external_api_cost_micro_usd uses MicroUsd brand for precision', () => {
    expectTypeOf<CostRecord>()
      .toHaveProperty('external_api_cost_micro_usd')
      .toEqualTypeOf<MicroUsd>();
    // MicroUsd is branded — NOT assignable from plain number
    expectTypeOf<MicroUsd>().not.toEqualTypeOf<number>();
  });

  it('provider_id nullable for non-provider-attributable costs', () => {
    expectTypeOf<CostRecord>().toHaveProperty('provider_id').toEqualTypeOf<string | null>();
  });

  it('carries the 4 token counters + wall_clock_ms', () => {
    expectTypeOf<CostRecord>().toHaveProperty('tokens_consumed').toEqualTypeOf<number>();
    expectTypeOf<CostRecord>().toHaveProperty('prompt_tokens').toEqualTypeOf<number>();
    expectTypeOf<CostRecord>().toHaveProperty('completion_tokens').toEqualTypeOf<number>();
    expectTypeOf<CostRecord>().toHaveProperty('cached_tokens').toEqualTypeOf<number>();
    expectTypeOf<CostRecord>().toHaveProperty('wall_clock_ms').toEqualTypeOf<number>();
  });
});

describe('FailureTaxonomy (Blueprint B § 2.13)', () => {
  it('FailureTaxonomyStatus is the closed 3-element enum', () => {
    expectTypeOf<FailureTaxonomyStatus>().toEqualTypeOf<'proposed' | 'canonical' | 'deprecated'>();
  });

  it('state machine: proposed→canonical→deprecated (no reverse transitions)', () => {
    expectTypeOf<FailureTaxonomyState>().toEqualTypeOf<FailureTaxonomyStatus>();
    expect(canTransition(failureTaxonomyTransitions, 'proposed', 'canonical')).toBe(true);
    expect(canTransition(failureTaxonomyTransitions, 'proposed', 'deprecated')).toBe(true);
    expect(canTransition(failureTaxonomyTransitions, 'canonical', 'deprecated')).toBe(true);
    // Forward-only — no reversals
    expect(canTransition(failureTaxonomyTransitions, 'canonical', 'proposed')).toBe(false);
    expect(canTransition(failureTaxonomyTransitions, 'deprecated', 'canonical')).toBe(false);
    expect(failureTaxonomyTransitions.deprecated).toHaveLength(0);
  });

  it('MmClassId is the template-literal type — extensible beyond MmClass enum', () => {
    // Per Blueprint B § 2.13 architecture: FailureTaxonomy is the SOURCE
    // OF TRUTH for what MM-N classes exist. The MmClass enum in
    // MatcherMap.ts is the DOWNSTREAM kernel-level enum that gets bumped
    // when a new MM-N enters `canonical` status here.
    const existing: MmClassId = 'MM-1';
    const proposed: MmClassId = 'MM-7'; // not in MatcherMap.MmClass yet
    const wayOut: MmClassId = 'MM-42';
    expect(existing).toBe('MM-1');
    expect(proposed).toBe('MM-7');
    expect(wayOut).toBe('MM-42');
  });

  it('FailureTaxonomyExample carries ref + optional description', () => {
    expectTypeOf<FailureTaxonomyExample>().toHaveProperty('ref').toEqualTypeOf<string>();
    const minimal: FailureTaxonomyExample = { ref: 'https://example.com/run-id' };
    const full: FailureTaxonomyExample = {
      ref: 'eval-run-id://abc',
      description: 'archetypal MM-4 token-ceiling escape',
    };
    expect(minimal.ref).toBe('https://example.com/run-id');
    expect(full.description).toContain('MM-4');
  });

  it('carries discriminating_question (drives classification UI)', () => {
    expectTypeOf<FailureTaxonomy>()
      .toHaveProperty('discriminating_question')
      .toEqualTypeOf<string>();
  });
});

describe('cross-entity invariants from § 6.2 ERD + § 2.13 architecture', () => {
  it('SessionTrace ↔ EvalRun is 1:1 (single eval_run_id FK)', () => {
    expectTypeOf<SessionTrace['eval_run_id']>().toEqualTypeOf<Uuidv7>();
  });

  it('ToolInvocation lives under exactly one SessionTrace', () => {
    expectTypeOf<ToolInvocation['session_trace_id']>().toEqualTypeOf<Uuidv7>();
  });

  it('FailureTaxonomy is upstream of MatcherMap.MmClass (taxonomy is SOT)', () => {
    // The kernel's MmClass = 'MM-1'..'MM-6' is a SUBSET snapshot of what
    // FailureTaxonomy has marked `canonical`. New entries land in
    // taxonomy first (status=proposed), reach `canonical`, then the
    // kernel's MmClass enum bumps in a follow-up release.
    // This test documents the architecture by asserting MmClassId
    // accepts values the closed MmClass enum doesn't.
    type _NotInClosedSet = MmClassId extends MmClass ? false : true;
    const proof: _NotInClosedSet = true;
    expect(proof).toBe(true);
  });

  it('CostRecord nullability pattern: system rollups have neither FK', () => {
    const systemRollup: CostRecord = {
      id: '0192cae6-0000-7000-8000-000000000000' as Uuidv7,
      eval_run_id: null,
      tool_invocation_id: null,
      attribution_class: 'system',
      provider_id: null,
      tokens_consumed: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cached_tokens: 0,
      wall_clock_ms: 0,
      external_api_cost_micro_usd: 1_500_000 as MicroUsd,
      recorded_at: '2026-05-16T20:00:00Z' as Rfc3339,
      cost_basis_version: 'cost-basis@2026-05-01',
    };
    expect(systemRollup.attribution_class).toBe('system');
    expect(systemRollup.eval_run_id).toBeNull();
    expect(systemRollup.tool_invocation_id).toBeNull();
  });
});
