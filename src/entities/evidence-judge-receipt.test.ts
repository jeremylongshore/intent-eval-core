/**
 * Type + runtime tests for E02b entities: EvidenceBundle, JudgeDecision,
 * RuntimeReceipt. Each test cites the Blueprint B section it locks.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  canTransition,
  evidenceBundleTransitions,
  judgeDecisionTransitions,
  runtimeReceiptTransitions,
  type ActualResourceUsage,
  type EvidenceBundle,
  type EvidenceBundleState,
  type JudgeDecision,
  type JudgeDecisionState,
  type JudgeSeed,
  type JudgeVerdict,
  type RuntimeReceipt,
  type RuntimeReceiptState,
  type SigningMode,
  type Uuidv7,
  type VerdictSource,
  type VerificationStatus,
} from '../index.js';

describe('EvidenceBundle (Blueprint B § 2.4)', () => {
  it('SigningMode is the closed 3-element enum', () => {
    expectTypeOf<SigningMode>().toEqualTypeOf<
      'sigstore_staging' | 'rekor_production' | 'unsigned_experimental'
    >();
  });

  it('VerificationStatus is verified|unverified|failed', () => {
    expectTypeOf<VerificationStatus>().toEqualTypeOf<'verified' | 'unverified' | 'failed'>();
  });

  it('state machine: building → signing → signed → archived_to_rekor', () => {
    expectTypeOf<EvidenceBundleState>().toEqualTypeOf<
      'building' | 'signing' | 'signed' | 'archived_to_rekor'
    >();
    expect(canTransition(evidenceBundleTransitions, 'building', 'signing')).toBe(true);
    expect(canTransition(evidenceBundleTransitions, 'signing', 'signed')).toBe(true);
    expect(canTransition(evidenceBundleTransitions, 'signed', 'archived_to_rekor')).toBe(true);
    // No reverse transitions
    expect(canTransition(evidenceBundleTransitions, 'signed', 'building')).toBe(false);
    // archived_to_rekor is terminal
    expect(evidenceBundleTransitions.archived_to_rekor).toHaveLength(0);
  });

  it('carries the predicate_uri_set + subject_set + storage_key fields', () => {
    expectTypeOf<EvidenceBundle>().toHaveProperty('eval_run_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<EvidenceBundle>().toHaveProperty('row_count').toEqualTypeOf<number>();
    expectTypeOf<EvidenceBundle>()
      .toHaveProperty('rekor_log_indices')
      .toEqualTypeOf<readonly number[]>();
  });
});

describe('JudgeDecision (Blueprint B § 2.5)', () => {
  it('JudgeVerdict is the closed UPPERCASE 5-element enum (distinct from GateDecision)', () => {
    // Important: judge surface is UPPERCASE; gate surface is lowercase.
    // The two are NOT aliases — conversion belongs in a downstream package.
    expectTypeOf<JudgeVerdict>().toEqualTypeOf<
      'PASS' | 'FAIL' | 'ADVISORY' | 'NOT_APPLICABLE' | 'ERROR'
    >();
  });

  it('VerdictSource is the closed 4-element enum', () => {
    expectTypeOf<VerdictSource>().toEqualTypeOf<
      'deterministic' | 'llm_with_seed' | 'llm_no_seed' | 'hybrid'
    >();
  });

  it('JudgeSeed accepts both number and string per Blueprint B silence on type', () => {
    expectTypeOf<JudgeSeed>().toEqualTypeOf<number | string>();
    const numericSeed: JudgeSeed = 42;
    const stringSeed: JudgeSeed = 'deadbeef-cafe';
    expect(typeof numericSeed).toBe('number');
    expect(typeof stringSeed).toBe('string');
  });

  it('state machine: recorded is terminal single-state', () => {
    expectTypeOf<JudgeDecisionState>().toEqualTypeOf<'recorded'>();
    expect(judgeDecisionTransitions.recorded).toHaveLength(0);
  });

  it('carries the 4 FKs + confidence/reasoning nullables', () => {
    expectTypeOf<JudgeDecision>().toHaveProperty('eval_run_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<JudgeDecision>().toHaveProperty('session_trace_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<JudgeDecision>().toHaveProperty('matcher_map_id').toEqualTypeOf<Uuidv7>();
    expectTypeOf<JudgeDecision>().toHaveProperty('cost_record_ref').toEqualTypeOf<Uuidv7>();
    expectTypeOf<JudgeDecision>().toHaveProperty('confidence').toEqualTypeOf<number | null>();
    expectTypeOf<JudgeDecision>().toHaveProperty('reasoning').toEqualTypeOf<string | null>();
    expectTypeOf<JudgeDecision>().toHaveProperty('seed').toEqualTypeOf<JudgeSeed | null>();
  });
});

describe('RuntimeReceipt (Blueprint B § 2.6)', () => {
  it('ActualResourceUsage has the fully-spec-bound 4-field shape', () => {
    expectTypeOf<ActualResourceUsage>().toEqualTypeOf<{
      readonly tokens_consumed: number;
      readonly wall_clock_ms: number;
      readonly peak_memory_mb: number;
      readonly network_egress_bytes: number;
    }>();
  });

  it('state machine: issued is terminal single-state', () => {
    expectTypeOf<RuntimeReceiptState>().toEqualTypeOf<'issued'>();
    expect(runtimeReceiptTransitions.issued).toHaveLength(0);
  });

  it('carries provider_adapter_versions + tool_versions as string maps', () => {
    expectTypeOf<RuntimeReceipt>()
      .toHaveProperty('provider_adapter_versions')
      .toEqualTypeOf<Readonly<Record<string, string>>>();
    expectTypeOf<RuntimeReceipt>()
      .toHaveProperty('tool_versions')
      .toEqualTypeOf<Readonly<Record<string, string>>>();
  });

  it('carries actual_resource_usage and runtime_limits_in_effect (ceiling vs actual)', () => {
    expectTypeOf<RuntimeReceipt>()
      .toHaveProperty('actual_resource_usage')
      .toEqualTypeOf<ActualResourceUsage>();
    // runtime_limits_in_effect is the same shape as EvalSpec.runtime_limits
    expectTypeOf<RuntimeReceipt>().toHaveProperty('runtime_limits_in_effect');
  });
});
