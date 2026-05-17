/**
 * tsd negative tests — state literal unions.
 *
 * Proves that out-of-set state values are rejected at compile time.
 */

import { expectAssignable, expectError, expectNotAssignable, expectType } from 'tsd';
import type {
  EvalRunState,
  EvalRunTerminalReason,
  EvalSpecState,
  EvidenceBundleState,
  FailureTaxonomyStatus,
  JudgeVerdict,
  MatcherMapState,
  MmClass,
  MmClassId,
  RegressionPackState,
  RolloutGateDecision,
  RolloutGateState,
  ScoringAggregationRule,
  SigningMode,
  SkillSnapshotState,
  VerdictSource,
  VerificationStatus,
  GateDecision,
} from '../dist/index.js';

// ─── EvalSpecState ─────────────────────────────────────────────────────
expectAssignable<EvalSpecState>('draft');
expectAssignable<EvalSpecState>('published');
expectAssignable<EvalSpecState>('deprecated');
expectError<EvalSpecState>('archived');
expectError<EvalSpecState>('committed'); // belongs to RegressionPack
expectError<EvalSpecState>('PUBLISHED'); // case-sensitive
expectError<EvalSpecState>('');

// ─── EvalRunState ──────────────────────────────────────────────────────
expectAssignable<EvalRunState>('queued');
expectAssignable<EvalRunState>('running');
expectAssignable<EvalRunState>('judged');
expectAssignable<EvalRunState>('reported');
expectAssignable<EvalRunState>('archived');
expectAssignable<EvalRunState>('skipped_due_to_gate');
expectAssignable<EvalRunState>('archived_failed');
expectError<EvalRunState>('draft');
expectError<EvalRunState>('paused');
expectError<EvalRunState>('SKIPPED_DUE_TO_GATE');

// ─── EvalRunTerminalReason (includes upstream_feed_failed from § 1.3) ──
expectAssignable<EvalRunTerminalReason>('upstream_feed_failed');
expectAssignable<EvalRunTerminalReason>('credential_leak_detected');
expectError<EvalRunTerminalReason>('user_cancelled'); // not in spec

// ─── MatcherMapState ───────────────────────────────────────────────────
expectAssignable<MatcherMapState>('draft');
expectError<MatcherMapState>('proposed'); // belongs to FailureTaxonomy

// ─── MmClass — closed v1 canonical set ─────────────────────────────────
expectAssignable<MmClass>('MM-1');
expectAssignable<MmClass>('MM-6');
expectError<MmClass>('MM-7'); // not in v1 canonical set
expectError<MmClass>('mm-1'); // lowercase rejected
expectError<MmClass>('MM-100');

// ─── MmClassId — broader template type ─────────────────────────────────
// MmClassId admits any MM-N — the taxonomy authority can propose new ones
expectAssignable<MmClassId>('MM-1');
expectAssignable<MmClassId>('MM-7');
expectAssignable<MmClassId>('MM-100');
expectError<MmClassId>('mm-1');
expectError<MmClassId>('MM-'); // missing number
// Note: TS template `MM-${number}` accepts non-integer numerics like
// 'MM-1.5'. That's a known TS limitation, not a kernel concern — runtime
// validators (iec-E04 Zod) will narrow to integer-only at the brand layer.
expectError<MmClassId>('FF-1'); // wrong prefix

// MM-7+ is in MmClassId but NOT in MmClass (taxonomy is upstream of kernel).
// Template-literal vs union assignability is a known TS edge case — use
// expectNotAssignable which checks structural non-assignability instead
// of expectError which checks compiler-emitted errors. The same invariant
// is proven structurally in src/entities/session-tool-cost-failure.test.ts
// via the `MmClassId extends MmClass ? false : true` conditional.
declare const proposedFromTaxonomy: MmClassId;
expectNotAssignable<MmClass>(proposedFromTaxonomy);

// ─── ScoringAggregationRule ────────────────────────────────────────────
expectAssignable<ScoringAggregationRule>('majority');
expectError<ScoringAggregationRule>('plurality');

// ─── EvidenceBundleState ───────────────────────────────────────────────
expectAssignable<EvidenceBundleState>('building');
expectAssignable<EvidenceBundleState>('archived_to_rekor');
expectError<EvidenceBundleState>('rejected');

// ─── SigningMode + VerificationStatus ──────────────────────────────────
expectAssignable<SigningMode>('rekor_production');
expectError<SigningMode>('signed'); // that's a state, not a signing mode
expectAssignable<VerificationStatus>('verified');
expectError<VerificationStatus>('VERIFIED');

// ─── JudgeVerdict (UPPERCASE) vs GateDecision (lowercase) — distinct ───
expectAssignable<JudgeVerdict>('PASS');
expectAssignable<JudgeVerdict>('NOT_APPLICABLE');
expectError<JudgeVerdict>('pass'); // lowercase belongs to GateDecision
expectError<JudgeVerdict>('Pass');

expectAssignable<GateDecision>('pass');
expectAssignable<GateDecision>('advisory');
expectError<GateDecision>('PASS'); // uppercase belongs to JudgeVerdict
expectError<GateDecision>('NOT_APPLICABLE'); // belongs to JudgeVerdict only

// ─── VerdictSource ─────────────────────────────────────────────────────
expectAssignable<VerdictSource>('llm_with_seed');
expectError<VerdictSource>('human');

// ─── RolloutGateDecision (ship/no_ship) — distinct from GateDecision ───
expectAssignable<RolloutGateDecision>('ship');
expectAssignable<RolloutGateDecision>('no_ship');
expectError<RolloutGateDecision>('pass'); // belongs to GateDecision
expectError<RolloutGateDecision>('fail');

expectError<GateDecision>('ship'); // and vice versa
expectError<GateDecision>('no_ship');

// ─── Single-state terminals ────────────────────────────────────────────
expectType<RolloutGateState>('evaluated');
expectError<RolloutGateState>('pending');

expectType<SkillSnapshotState>('created');
expectError<SkillSnapshotState>('updated');

// ─── RegressionPackState ──────────────────────────────────────────────
expectAssignable<RegressionPackState>('superseded');
expectError<RegressionPackState>('replaced');

// ─── FailureTaxonomyStatus ────────────────────────────────────────────
expectAssignable<FailureTaxonomyStatus>('proposed');
expectError<FailureTaxonomyStatus>('rejected');
