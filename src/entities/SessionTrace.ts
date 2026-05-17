/**
 * SessionTrace — OTel-compatible execution trace for an EvalRun.
 *
 * Blueprint B § 2.10. State machine: open → closed (1:1 cardinality with
 * EvalRun). Mutable while parent EvalRun is non-terminal; frozen at parent
 * terminal — but the state machine on SessionTrace itself just toggles
 * open → closed.
 *
 * The trace blob is content-addressed at `trace_blob_storage_key` so any
 * tampering is detectable.
 */

import type { OtelSpanId, Rfc3339, StorageKey, Uuidv7 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/** State machine states for SessionTrace (Blueprint B § 2.10). */
export type SessionTraceState = 'open' | 'closed';

/**
 * Allowed transitions. `closed` is terminal — once a trace closes (which
 * happens when the parent EvalRun reaches a terminal state), it never
 * reopens.
 */
export const sessionTraceTransitions: TransitionMap<SessionTraceState> = {
  open: ['closed'],
  closed: [],
} as const;

/**
 * SessionTrace — execution-trace metadata for one EvalRun.
 *
 * Field semantics per Blueprint B § 2.10 prose table. The trace itself
 * (full DAG of spans) lives in object storage at `trace_blob_storage_key`
 * — this row carries only the summary counters and the FK to the blob.
 */
export interface SessionTrace {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** FK → EvalRun.id (1:1 cardinality per § 6.2 ERD). */
  readonly eval_run_id: Uuidv7;

  readonly created_at: Rfc3339;

  /** Populated when state transitions to `closed`. */
  readonly closed_at: Rfc3339 | null;

  /** OTel root span identifier (16 hex chars per OTel spec). */
  readonly root_span_id: OtelSpanId;

  /** Total span count in the trace blob. */
  readonly total_spans: number;

  /** Maximum agent-loop recursion depth observed. */
  readonly max_loop_depth: number;

  /** Number of ToolInvocation rows produced. */
  readonly total_tool_invocations: number;

  /** Number of JudgeDecision rows produced. */
  readonly total_judge_decisions: number;

  /**
   * Object-storage key for the full DAG serialization. Content-addressed
   * (sha256 of payload) per Blueprint B's tamper-evidence requirement.
   */
  readonly trace_blob_storage_key: StorageKey;
}
