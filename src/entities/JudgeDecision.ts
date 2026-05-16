/**
 * JudgeDecision — single judge's verdict on an EvalRun for a MatcherMap.
 *
 * Blueprint B § 2.5. Single terminal state `recorded`. Immutable at creation.
 * Follow-up verdicts (e.g., re-judging) land as new rows, never mutations.
 *
 * When emitted as a signed predicate row, the URI is `eval-verdict/v1`
 * (Blueprint B § 2.5 line 199, currently `sigstore_staging`).
 */

import type { Rfc3339, Sha256, Uuidv7 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * Verdict enum per Blueprint B § 2.5 (closed 5-element set).
 *
 * Uppercase per Blueprint B § 2.5 prose. Distinct from `GateDecision`
 * (which is lowercase per § 7.4) — the judge surface and the gate surface
 * are deliberately separate enums even though they overlap semantically.
 * Conversion between them belongs in a separate epic (rollout-gate
 * decision logic in `j-rig`).
 */
export type JudgeVerdict = 'PASS' | 'FAIL' | 'ADVISORY' | 'NOT_APPLICABLE' | 'ERROR';

/**
 * Verdict provenance — describes HOW the judge arrived at the verdict.
 *
 * Closed 4-element enum per Blueprint B § 2.5. Drives replay-fidelity
 * accounting (a `deterministic` verdict is RF-0/RF-1; `llm_no_seed` is
 * typically RF-3/RF-4).
 */
export type VerdictSource = 'deterministic' | 'llm_with_seed' | 'llm_no_seed' | 'hybrid';

/** Single terminal state per Blueprint B § 2.5. */
export type JudgeDecisionState = 'recorded';

/** No transitions — `recorded` is terminal. */
export const judgeDecisionTransitions: TransitionMap<JudgeDecisionState> = {
  recorded: [],
} as const;

/**
 * Seed used by an LLM judge for reproducibility. Blueprint B § 2.5 does not
 * specify integer vs string — typed as the union to admit both. Populated
 * for `verdict_source === 'llm_with_seed'`; null otherwise.
 */
export type JudgeSeed = number | string;

/**
 * JudgeDecision — single judge's verdict row.
 *
 * Field semantics per Blueprint B § 2.5 prose table.
 */
export interface JudgeDecision {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** FK → EvalRun.id. */
  readonly eval_run_id: Uuidv7;

  /** FK → SessionTrace.id. */
  readonly session_trace_id: Uuidv7;

  /** FK → MatcherMap.id. */
  readonly matcher_map_id: Uuidv7;

  /**
   * Stable judge identity, e.g., `audit-harness@0.3.0:escape-scan` or
   * `anthropic:claude-sonnet-4-5:judge-prompt-v2`.
   */
  readonly judge_identity: string;

  /** SemVer of the judge logic that produced this verdict. */
  readonly judge_version: string;

  /** Verdict. */
  readonly verdict: JudgeVerdict;

  /** How the verdict was reached. */
  readonly verdict_source: VerdictSource;

  /**
   * Confidence on a 0..1 scale. Populated for LLM judges; null for
   * deterministic judges where confidence has no meaning.
   */
  readonly confidence: number | null;

  /**
   * Free-form judge reasoning output (e.g., chain-of-thought, rule trace).
   * Null when the judge does not emit reasoning.
   */
  readonly reasoning: string | null;

  /** sha256 of the input the judge saw (canonical form). */
  readonly input_hash: Sha256;

  /** Seed for reproducibility. Populated for `llm_with_seed`. */
  readonly seed: JudgeSeed | null;

  /** RFC 3339 UTC timestamp of the verdict. */
  readonly evaluated_at: Rfc3339;

  /** Wall-clock latency of the judge call in milliseconds. */
  readonly latency_ms: number;

  /** FK → CostRecord.id. */
  readonly cost_record_ref: Uuidv7;
}
