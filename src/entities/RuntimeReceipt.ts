/**
 * RuntimeReceipt — signed record of HOW an EvalRun executed.
 *
 * Blueprint B § 2.6. Single terminal state `issued`. Immutable at creation
 * (signed before persistence). 1:1 cardinality with EvalRun.
 *
 * Distinct from EvidenceBundle: the bundle carries judge verdicts and gate
 * results; the receipt carries the execution context (worker identity,
 * resource usage, tool versions). Together they constitute the full
 * audit trail.
 *
 * Predicate URI when emitted: `runtime-receipt/v1` (Blueprint B § 2.6
 * line 209, currently `sigstore_staging`).
 */

import type { Rfc3339, Sha256, Uuidv7 } from '../primitives.js';
import type { EvalRunTerminalReason, EvalRunTerminalState } from './EvalRun.js';
import type { RuntimeLimits } from './EvalSpec.js';
import type { TransitionMap } from '../state-machines/types.js';

/** Single terminal state per Blueprint B § 2.6. */
export type RuntimeReceiptState = 'issued';

/** No transitions — `issued` is terminal. */
export const runtimeReceiptTransitions: TransitionMap<RuntimeReceiptState> = {
  issued: [],
} as const;

/**
 * Measured resource consumption for a completed EvalRun. Fully spec-bound
 * shape per Blueprint B § 2.6 (`{tokens_consumed, wall_clock_ms,
 * peak_memory_mb, network_egress_bytes}`).
 *
 * Compare to `RuntimeLimits` (EvalSpec.runtime_limits) — that's the CEILING
 * declared up front; this is the ACTUAL usage measured at termination.
 */
export interface ActualResourceUsage {
  readonly tokens_consumed: number;
  readonly wall_clock_ms: number;
  readonly peak_memory_mb: number;
  readonly network_egress_bytes: number;
}

/**
 * RuntimeReceipt — signed execution-context record for a completed EvalRun.
 *
 * Field semantics per Blueprint B § 2.6 prose table.
 */
export interface RuntimeReceipt {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** FK → EvalRun.id (1:1 cardinality). */
  readonly eval_run_id: Uuidv7;

  /** RFC 3339 UTC timestamp of receipt issuance. */
  readonly created_at: Rfc3339;

  /**
   * Content hash of the EvalSpec at queue time — frozen so the receipt
   * is verifiable against the spec the Run actually used, not whatever
   * the spec might have become later.
   */
  readonly eval_spec_content_hash: Sha256;

  /** Content hash of the SkillSnapshot the Run targeted. */
  readonly skill_snapshot_sha: Sha256;

  /**
   * Per-provider adapter version mapping. Captures the exact provider
   * adapter code that was in effect for the Run. Map shape: provider id →
   * SemVer string.
   */
  readonly provider_adapter_versions: Readonly<Record<string, string>>;

  /**
   * Per-tool version mapping. Captures the exact tool versions invoked
   * during the Run. Map shape: tool id → SemVer string.
   */
  readonly tool_versions: Readonly<Record<string, string>>;

  /** Copy of EvalSpec.runtime_limits frozen at queue time. */
  readonly runtime_limits_in_effect: RuntimeLimits;

  /** Measured resource consumption at termination. */
  readonly actual_resource_usage: ActualResourceUsage;

  /** Worker identity string. */
  readonly worker_identity: string;

  /** sha256 of the worker host environment (binaries, OS, etc.). */
  readonly worker_host_fingerprint: Sha256;

  /** Mirrors EvalRun.state's terminal value. */
  readonly terminal_state: EvalRunTerminalState;

  /** Mirrors EvalRun.terminal_reason. */
  readonly terminal_reason: EvalRunTerminalReason;

  /** FK → EvidenceBundle.id. */
  readonly evidence_bundle_id: Uuidv7;

  /** FK → CostRecord.id. */
  readonly cost_record_id: Uuidv7;
}
