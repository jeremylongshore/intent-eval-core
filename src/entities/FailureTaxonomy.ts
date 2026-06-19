/**
 * FailureTaxonomy — canonical registry of failure-mode classes (MM-N).
 *
 * Blueprint B § 2.13. State machine: proposed → canonical → deprecated.
 * Mutable while `proposed`; immutable once `canonical`. `canonical →
 * deprecated` requires a Class-1 ISEDC Decision Record.
 *
 * **Cross-entity invariant**: JudgeDecision with `verdict = 'FAIL'` MUST
 * classify the failure against an entry here. Drift (a FAIL verdict that
 * doesn't map to a canonical taxonomy entry) emits a
 * `taxonomy.drift.detected` OTel event for human review.
 *
 * **Authoritative source for what MM-N classes exist.** The
 * `MatcherMap.MmClass` literal union is downstream of this entity — when
 * a new MM-N enters `canonical` here, the kernel's `MmClass` enum gets
 * bumped to match.
 */

import type { ActorIdentity, KebabSlug, Rfc3339, SemVer, Uuidv7 } from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/**
 * Failure-mode class identifier per Blueprint B § 2.13.
 *
 * Template-literal type — accepts `MM-1`, `MM-2`, `MM-42`, etc. The
 * taxonomy CAN admit MM-N values beyond the closed `MmClass` literal
 * union in `MatcherMap.ts` because the taxonomy is the SOURCE OF TRUTH
 * for what classes exist: a new MM-7 lifecycle is
 *
 *   proposed (taxonomy) → canonical (taxonomy) → MmClass enum bump (kernel)
 *
 * Until a `canonical` taxonomy entry exists, no MatcherMap may carry that
 * `mm_class` value — but the taxonomy itself can hold the proposal.
 */
export type MmClassId = `MM-${number}`;

/**
 * Status enum per Blueprint B § 2.13. Closed 3-element set.
 *
 * `canonical → deprecated` transition requires Class-1 ISEDC DR per
 * § 2.13 prose — deprecating a canonical class invalidates every
 * historical JudgeDecision classified against it.
 */
export type FailureTaxonomyStatus = 'proposed' | 'canonical' | 'deprecated';

/** State machine state literal — distinct alias for the status enum. */
export type FailureTaxonomyState = FailureTaxonomyStatus;

/**
 * Allowed transitions per Blueprint B § 2.13.
 *
 * No reverse transitions — taxonomy moves forward only. To "un-deprecate"
 * a class, create a new entry with a bumped `version` and `status =
 * 'canonical'`.
 */
export const failureTaxonomyTransitions: TransitionMap<FailureTaxonomyState> = {
  proposed: ['canonical', 'deprecated'],
  canonical: ['deprecated'],
  deprecated: [],
} as const;

/**
 * Structured example reference. Blueprint B § 2.13 says only "structured
 * example references"; inner shape is engineer's choice. Modeled as a
 * minimal object with the two fields most likely to be useful — a URL or
 * path pointer and an optional human description.
 */
export interface FailureTaxonomyExample {
  /** URL, gist, doc path, EvalRun id, etc. */
  readonly ref: string;
  /** Optional human-readable description. */
  readonly description?: string;
}

/**
 * FailureTaxonomy — single canonical-or-proposed failure-mode class entry.
 *
 * Field semantics per Blueprint B § 2.13 prose table.
 */
export interface FailureTaxonomy {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /**
   * Natural key. MUST match the `MM-N` template pattern. Two
   * FailureTaxonomy rows with the same `mm_class` and overlapping
   * non-deprecated lifecycles violate the canonical-set invariant.
   */
  readonly mm_class: MmClassId;

  /** Human-readable slug. */
  readonly name: KebabSlug;

  /** Paragraph description of the failure mode. */
  readonly description: string;

  /**
   * The question a human asks to decide whether a given failure belongs
   * in this class. Drives the classification UI in `audit-harness` and
   * `j-rig`.
   */
  readonly discriminating_question: string;

  /** Structured example references. */
  readonly examples: readonly FailureTaxonomyExample[];

  readonly version: SemVer;

  /** Lifecycle status. */
  readonly status: FailureTaxonomyStatus;

  readonly created_at: Rfc3339;
  readonly created_by: ActorIdentity;
}
