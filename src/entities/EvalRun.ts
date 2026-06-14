/**
 * EvalRun — single execution of an EvalSpec against a SkillSnapshot.
 *
 * Blueprint B § 2.2. State machine spans 7 states with explicit transition
 * table at Blueprint B § 3.1.
 *
 * Mutable in non-terminal states; frozen at terminal. Clock-skew tolerance
 * ±10 ms across workers.
 */

import type { ActorIdentity, Rfc3339, Sha256, SemVer, Uuidv7 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * EvalRun state enum (Blueprint B § 2.2 + § 3.1).
 *
 * Terminal states: archived, archived_failed, skipped_due_to_gate.
 */
export type EvalRunState =
  | 'queued'
  | 'running'
  | 'judged'
  | 'reported'
  | 'archived'
  | 'skipped_due_to_gate'
  | 'archived_failed';

/** Terminal EvalRun states (frozen, no further transitions). */
export const evalRunTerminalStates = [
  'archived',
  'skipped_due_to_gate',
  'archived_failed',
] as const satisfies readonly EvalRunState[];

export type EvalRunTerminalState = (typeof evalRunTerminalStates)[number];

/**
 * Transition table per Blueprint B § 3.1 (lines 337-351).
 *
 * The terminal states have empty transition arrays — no further moves
 * permitted once a Run is frozen.
 */
export const evalRunTransitions: TransitionMap<EvalRunState> = {
  queued: ['running', 'skipped_due_to_gate', 'archived_failed'],
  running: ['judged', 'archived_failed'],
  judged: ['reported', 'archived_failed'],
  reported: ['archived', 'archived_failed'],
  archived: [],
  skipped_due_to_gate: [],
  archived_failed: [],
} as const;

/**
 * Terminal reason enum. Blueprint B § 3.1 enumerates these for the
 * `archived_failed` / `skipped_due_to_gate` paths, plus § 1.3 line 100
 * adds `upstream_feed_failed` for `feeds`-edge cascade failures.
 *
 * Set is extensible — additions land via ADR + bead.
 */
export type EvalRunTerminalReason =
  | 'queued_timeout_elapsed'
  | 'run_timeout_elapsed'
  | 'worker_crash_exhausted'
  | 'credential_leak_detected'
  | 'judge_unavailable_exhausted'
  | 'token_ceiling_exceeded'
  | 'evidence_contract_violation'
  | 'upstream_feed_failed';

/**
 * EvalRun — one execution attempt.
 *
 * Field semantics per Blueprint B § 2.2 prose table. Foreign keys are
 * populated at specific lifecycle points (e.g., evidence_bundle_id at
 * judged → reported; session_trace_id continuously).
 */
export interface EvalRun {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** FK → EvalSpec.id. */
  readonly eval_spec_id: Uuidv7;
  /** Frozen at queue time — defends against mid-flight spec mutation. */
  readonly eval_spec_version: SemVer;
  /** Frozen at queue time. */
  readonly eval_spec_content_hash: Sha256;

  /** FK → SkillSnapshot.id. */
  readonly skill_snapshot_id: Uuidv7;

  /** Current state. */
  readonly state: EvalRunState;
  /** Why this Run terminated (only meaningful in terminal states). */
  readonly terminal_reason: EvalRunTerminalReason | null;

  // Lifecycle timestamps — populated as the Run progresses.
  readonly queued_at: Rfc3339;
  readonly started_at: Rfc3339 | null;
  readonly judged_at: Rfc3339 | null;
  readonly reported_at: Rfc3339 | null;
  readonly archived_at: Rfc3339 | null;

  /** Worker holding the active lease (null in queued / terminal states). */
  readonly worker_id: string | null;
  readonly lease_expires_at: Rfc3339 | null;

  // Downstream FK refs — populated continuously / at terminal transitions.
  /** FK → SessionTrace.id. Populated as Run executes. */
  readonly session_trace_id: Uuidv7;
  /** FK → EvidenceBundle.id. Populated at judged → reported. */
  readonly evidence_bundle_id: Uuidv7 | null;
  /** FK → CostRecord.id. Populated continuously. */
  readonly cost_record_id: Uuidv7;

  /** Multi-step DAG child link (null for top-level Runs). */
  readonly parent_run_id: Uuidv7 | null;

  /** Defaults to `id` if not explicitly provided. */
  readonly idempotency_key: Uuidv7;

  readonly submitted_by: ActorIdentity;

  /**
   * RESERVED multi-tenancy slot (deferral-G; bd_000-projects-k0fj). OPTIONAL
   * and additive per Blueprint B § 7.2 — reserved so a future multi-tenant
   * deployment does NOT force a consumer-side migration. Tenant-isolation
   * SEMANTICS remain out-of-scope for v1 (deferred to a future DR); v1
   * single-tenant runs omit it. SHOULD equal the parent EvalSpec.tenant_id
   * when both are present (a runtime invariant, not enforced at this layer).
   */
  readonly tenant_id?: Uuidv7;
}
