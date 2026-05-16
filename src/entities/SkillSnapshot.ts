/**
 * SkillSnapshot — content-addressed pin of a skill's source + deps + config.
 *
 * Blueprint B § 2.9. Single terminal state `created`. Immutable. New
 * snapshot = new row + new `combined_sha`.
 *
 * The `combined_sha` is load-bearing — it's the value EvalSpec uses in
 * `expected_artifacts` to declare which skill version a spec targets, and
 * it's what RegressionPack uses to anchor a regression-check chain. The
 * formula (Blueprint B § 2.9):
 *
 *   combined_sha = sha256(source_sha || dependency_lock_sha || config_sha)
 *
 * Concatenation order MATTERS — changing the order breaks compatibility
 * with every existing pin. The kernel does NOT compute the hash (that's
 * runtime); it just types it.
 *
 * Predicate URI (deferred Phase B+, per DR-010 Q3):
 *   `https://evals.intentsolutions.io/skill-snapshot/v1`
 */

import type {
  ActorIdentity,
  KebabSlug,
  Rfc3339,
  SemVer,
  Sha256,
  StorageKey,
  Uuidv7,
} from '../primitives.js';
import type { TransitionMap } from '../state-machines/types.js';

/** Single terminal state per Blueprint B § 2.9. */
export type SkillSnapshotState = 'created';

/** No transitions — `created` is terminal. */
export const skillSnapshotTransitions: TransitionMap<SkillSnapshotState> = {
  created: [],
} as const;

/**
 * SkillSnapshot — pin of a skill at a moment in time.
 *
 * Field semantics per Blueprint B § 2.9 prose table.
 */
export interface SkillSnapshot {
  /** UUIDv7 PK. */
  readonly id: Uuidv7;

  /**
   * Logical skill identifier — kebab-case slug. Stable across snapshots
   * of the same skill (e.g., `validate-skillmd` keeps its `skill_id`
   * across every version it ships). The (skill_id, combined_sha) tuple
   * is the natural pin.
   */
  readonly skill_id: KebabSlug;

  /** sha256 of the source tarball. */
  readonly source_sha: Sha256;

  /** sha256 of the dependency lock file. */
  readonly dependency_lock_sha: Sha256;

  /** sha256 of the skill's config (SKILL.md frontmatter + any sidecar config). */
  readonly config_sha: Sha256;

  /**
   * **Load-bearing pin.** Computed as `sha256(source_sha || dependency_
   * lock_sha || config_sha)` per Blueprint B § 2.9. Concatenation order
   * is normative — do not reorder.
   *
   * Referenced by EvalSpec.expected_artifacts and RegressionPack
   * .skill_snapshot_sha as the single source of truth for "which version
   * of this skill."
   */
  readonly combined_sha: Sha256;

  /**
   * Optional SemVer label if upstream declares one. Null when upstream
   * publishes only content-addressed (no human-readable version).
   */
  readonly version_label: SemVer | null;

  /** Object-storage key of the snapshot tarball. */
  readonly storage_key: StorageKey;

  readonly created_at: Rfc3339;
  readonly created_by: ActorIdentity;
}
