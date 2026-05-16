/**
 * RolloutGate — evaluation of an EvidenceBundle against a deployment policy.
 *
 * Blueprint B § 2.8. Single terminal state `evaluated`. Immutable at
 * creation. Re-evaluations land as new rows (NEVER mutations).
 *
 * Natural uniqueness: `(eval_run_id, policy_ref)` tuple.
 *
 * When emitted as a signed predicate row, the URI is `gate-result/v1` —
 * the only predicate URI with a normative SPEC and production-Rekor
 * unlocked. The translation from RolloutGate (entity) to gate-result/v1
 * (predicate body) lives in the downstream `intent-rollout-gate` package,
 * not in this kernel.
 *
 * Distinction from gate-result/v1 predicate body:
 *   - RolloutGate is the DATABASE row (with signing_mode, rekor_log_index,
 *     evaluated_at, etc. for persistence)
 *   - gate-result/v1 is the SHAPE OF THE SIGNED PAYLOAD (with policy_hash,
 *     input_hash prefixed sha256, etc. for verification)
 *   - They overlap on `decision`/`gate_decision` (but with DIFFERENT enum
 *     values — see below) and `coverage` (same shape, imported)
 */

import type { Rfc3339, Sha256, Uuidv7 } from '../primitives.js';
import type { Coverage } from '../predicates/gate-result-v1.js';
import type { SigningMode } from './EvidenceBundle.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * RolloutGate decision enum (Blueprint B § 2.8, closed 4-element set).
 *
 * **Deliberately DIFFERENT from `GateDecision`** (the predicate-body verdict
 * enum) — RolloutGate decides about deployment (`ship`/`no_ship`), while
 * gate-result/v1 records a more generic verdict (`pass`/`fail`). The two
 * enums are not aliases. The mapping is policy-dependent and lives in the
 * downstream rollout-gate package:
 *
 * |  RolloutGate.decision  |  Typical gate-result/v1.gate_decision  |
 * |------------------------|----------------------------------------|
 * |  `ship`                |  `pass`                                |
 * |  `no_ship`             |  `fail`                                |
 * |  `advisory`            |  `advisory`                            |
 * |  `error`               |  `error`                               |
 *
 * Policy MAY elevate an `advisory` predicate verdict into a `no_ship`
 * RolloutGate decision — the translation is not 1:1.
 */
export type RolloutGateDecision = 'ship' | 'no_ship' | 'advisory' | 'error';

/** Single terminal state per Blueprint B § 2.8. */
export type RolloutGateState = 'evaluated';

/** No transitions — `evaluated` is terminal. */
export const rolloutGateTransitions: TransitionMap<RolloutGateState> = {
  evaluated: [],
} as const;

/**
 * RolloutGate — evaluation of an EvidenceBundle against a deployment policy.
 *
 * Field semantics per Blueprint B § 2.8 prose table.
 */
export interface RolloutGate {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** FK → EvalRun.id. */
  readonly eval_run_id: Uuidv7;

  /** FK → EvidenceBundle.id. */
  readonly evidence_bundle_id: Uuidv7;

  /**
   * Pointer to the deployment policy at evaluation time. Format:
   * `<content_hash>:<path>` (e.g., `sha256:abc:tests/TESTING.md`). Per
   * Blueprint B § 2.8 — defends against mid-flight policy mutation.
   */
  readonly policy_ref: string;

  /** sha256 of the policy file content, used for verification. */
  readonly policy_content_hash: Sha256;

  /** Decision. */
  readonly decision: RolloutGateDecision;

  /**
   * Structured reason strings. Per Blueprint B § 2.8: "one per matched-or-
   * unmatched policy rule." Inner structure beyond "structured string" is
   * NOT spec-bound; modeled as `readonly string[]` to start. Producers MAY
   * use any internal format consistently.
   */
  readonly decision_reasons: readonly string[];

  /**
   * Coverage declaration. Same shape as gate-result/v1.Coverage per
   * Blueprint B § 7.4 line 807 — imported to keep the shape canonical.
   */
  readonly coverage: Coverage;

  /** RFC 3339 UTC timestamp of evaluation. */
  readonly evaluated_at: Rfc3339;

  /** SemVer of the gate logic that produced this evaluation. */
  readonly gate_version: string;

  /** Signing posture — same enum as EvidenceBundle.signing_mode. */
  readonly signing_mode: SigningMode;

  /**
   * Rekor transparency log index — populated when `signing_mode ===
   * 'rekor_production'`; null otherwise.
   */
  readonly rekor_log_index: number | null;
}
