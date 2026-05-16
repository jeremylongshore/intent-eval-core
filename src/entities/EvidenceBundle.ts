/**
 * EvidenceBundle — append-only collection of signed predicate rows.
 *
 * Blueprint B § 2.4. State machine: building → signing → signed (with
 * optional sub-state `archived_to_rekor`).
 *
 * APPEND-ONLY. Corrections = new bundle with a new UUIDv7 referencing the
 * prior bundle's content_hash — never in-place mutation.
 *
 * Cardinality: many EvidenceBundles : 1 EvalRun per § 6.2 ERD (`||--o|`,
 * actually 0..1 per ERD reading — at most one EvidenceBundle per EvalRun
 * lifecycle, though replays produce new ones).
 */

import type { Rfc3339, StorageKey, Uuidv7 } from '../primitives.js';
import type { InTotoSubject, KnownPredicateUri } from '../predicates/index.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * Signing mode per Blueprint B § 2.4.
 *
 * - `sigstore_staging`     — DR-010 Q3 default for predicates without a
 *                             normative SPEC.md (everything except
 *                             `gate-result/v1` at v1)
 * - `rekor_production`     — promoted predicates with normative SPEC.md +
 *                             DNSSEC + CAA pinning verified
 * - `unsigned_experimental` — local-only / sandbox; MUST NOT leave the
 *                             producing environment
 */
export type SigningMode = 'sigstore_staging' | 'rekor_production' | 'unsigned_experimental';

/**
 * Verification status of the bundle's signatures at the most-recent check.
 *
 * `unverified` means "never checked", not "failed to verify". `failed` is
 * the terminal-bad state.
 */
export type VerificationStatus = 'verified' | 'unverified' | 'failed';

/** State machine states for EvidenceBundle (Blueprint B § 2.4). */
export type EvidenceBundleState = 'building' | 'signing' | 'signed' | 'archived_to_rekor';

/**
 * Allowed transitions for EvidenceBundle.
 *
 * `archived_to_rekor` is a terminal sub-state (no further transitions).
 * Bundles in `signed` MAY optionally promote to `archived_to_rekor` once
 * their signatures land in the Rekor transparency log.
 */
export const evidenceBundleTransitions: TransitionMap<EvidenceBundleState> = {
  building: ['signing'],
  signing: ['signed'],
  signed: ['archived_to_rekor'],
  archived_to_rekor: [],
} as const;

/**
 * EvidenceBundle — content-addressed collection of signed predicate rows.
 *
 * Field semantics per Blueprint B § 2.4 prose table.
 */
export interface EvidenceBundle {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** FK → EvalRun.id. */
  readonly eval_run_id: Uuidv7;

  /** RFC 3339 UTC timestamp. */
  readonly created_at: Rfc3339;

  /**
   * Predicate URIs represented in this bundle's rows. Drawn from
   * `KnownPredicateUri` plus any future URI added without a kernel bump
   * (§ 7.2 backward-compat policy).
   *
   * The `string & {}` intersection preserves IDE autocomplete for known
   * URIs without collapsing the literal union into the wider `string` type
   * — see https://github.com/microsoft/TypeScript/issues/29729 for the
   * canonical pattern.
   */
  readonly predicate_uri_set: readonly (KnownPredicateUri | (string & {}))[];

  /** Number of rows in the bundle. */
  readonly row_count: number;

  /**
   * Deduplicated in-toto Subject entries across all rows in the bundle.
   * Per Blueprint B § 2.4 prose table.
   */
  readonly subject_set: readonly InTotoSubject[];

  /**
   * sha256-content-addressed object-storage key for the bundle payload.
   * Per Blueprint B's tamper-evidence requirement (§ 2.4).
   */
  readonly storage_key: StorageKey;

  /** Signing posture for the bundle. */
  readonly signing_mode: SigningMode;

  /**
   * Rekor transparency log indices. Populated when `signing_mode ===
   * 'rekor_production'`; empty otherwise.
   */
  readonly rekor_log_indices: readonly number[];

  /** Most-recent verification result. */
  readonly verification_status: VerificationStatus;

  /** RFC 3339 UTC timestamp of the most-recent verification. */
  readonly verification_last_checked_at: Rfc3339;
}
