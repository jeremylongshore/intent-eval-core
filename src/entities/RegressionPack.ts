/**
 * RegressionPack — frozen bundle of EvalRuns proving a behavior contract.
 *
 * Blueprint B § 2.7. State machine: draft → committed → superseded.
 * Mutable in `draft`; immutable once `committed`.
 *
 * Forms the spine of regression-checking: every new SkillSnapshot SHOULD
 * have an associated RegressionPack proving it doesn't regress vs the
 * `ancestor_pack_id` it descended from. The `delta_declaration` field
 * names what was deliberately changed (e.g., "added MM-7 redaction
 * matcher to expand scope").
 *
 * Predicate URI (future v0.2+, deferred per DR-010 Q3):
 *   `https://evals.intentsolutions.io/regression-pack/v1`
 */

import type { ActorIdentity, KebabSlug, Rfc3339, Sha256, Uuidv7 } from '../primitives.js';
import type { MmClass } from './MatcherMap.js';
import type { TransitionMap } from '../state-machines/types.js';

/** State machine states for RegressionPack (Blueprint B § 2.7). */
export type RegressionPackState = 'draft' | 'committed' | 'superseded';

/**
 * Allowed transitions. `superseded` is terminal — supersession is one-way.
 * Reverting a supersession requires a NEW RegressionPack pointing at the
 * older pack via `ancestor_pack_id`.
 */
export const regressionPackTransitions: TransitionMap<RegressionPackState> = {
  draft: ['committed'],
  committed: ['superseded'],
  superseded: [],
} as const;

/**
 * Per-MM-class outcome row inside `RegressionPack.outcome_summary`.
 *
 * Blueprint B § 2.7 says only "aggregate pass/fail rates per matcher class"
 * — so `pass` and `fail` are the spec-bound minimum. The other JudgeVerdict
 * values (ADVISORY, NOT_APPLICABLE, ERROR) are NOT mentioned in § 2.7 prose.
 * Modeled as optional to admit producer extension without inventing
 * required fields the spec did not bless.
 */
export interface MatcherOutcomeRow {
  /** Number of EvalRuns in this pack that produced JudgeVerdict='PASS'. */
  readonly pass: number;
  /** Number of EvalRuns in this pack that produced JudgeVerdict='FAIL'. */
  readonly fail: number;
  /** Optional — spec does not require. Engineer's choice to record. */
  readonly advisory?: number;
  /** Optional — spec does not require. Engineer's choice to record. */
  readonly not_applicable?: number;
  /** Optional — spec does not require. Engineer's choice to record. */
  readonly error?: number;
}

/**
 * Aggregate outcomes keyed by MatcherMap class.
 *
 * Partial because not every RegressionPack tests every MM-class — only the
 * classes the constituent EvalSpecs actually exercise will have rows.
 */
export type RegressionOutcomeSummary = Readonly<Partial<Record<MmClass, MatcherOutcomeRow>>>;

/**
 * RegressionPack — frozen bundle proving (or disproving) regression.
 *
 * Field semantics per Blueprint B § 2.7 prose table.
 */
export interface RegressionPack {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /** Human-readable slug. */
  readonly name: KebabSlug;

  /** One-paragraph statement of what this pack proves. */
  readonly purpose: string;

  /** Content hash of the SkillSnapshot this pack tests against. */
  readonly skill_snapshot_sha: Sha256;

  /** EvalSpec FKs that compose this pack. */
  readonly eval_spec_ids: readonly Uuidv7[];

  /** EvalRun FKs whose verdicts compose the outcome summary. */
  readonly eval_run_ids: readonly Uuidv7[];

  /** Aggregate pass/fail (and optional extension) per MM-class. */
  readonly outcome_summary: RegressionOutcomeSummary;

  /** FK → RegressionPack.id this pack descended from, or null for root packs. */
  readonly ancestor_pack_id: Uuidv7 | null;

  /**
   * Free-form declaration of what changed vs the ancestor pack. Per
   * Blueprint B § 2.7: "What variable changed vs ancestor." Not parsed by
   * the kernel — consumer documentation.
   */
  readonly delta_declaration: string;

  readonly created_at: Rfc3339;
  readonly created_by: ActorIdentity;

  /** sha256 of canonical-form serialization. */
  readonly content_hash: Sha256;
}
