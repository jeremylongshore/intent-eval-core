/**
 * SkillVersion — refinement-lineage record of a skill (14th canonical entity).
 *
 * DR-028 T1 DISCRIMINATOR resolution (ISEDC Session 7, intent-eval-lab
 * `028-AT-DECR-...`). SEPARATE entity from SkillSnapshot:
 *
 *   - SkillSnapshot (§ 2.9) content-addressed-PINS a skill's source state at a
 *     moment in time. Single terminal state `created`. No discriminator.
 *   - SkillVersion captures the REFINEMENT LINEAGE the Skill Refiner produces.
 *     `version_kind` is the load-bearing signable discriminator; each accepted
 *     edit produces a NEW immutable SkillVersion (append-only event log, AC-2).
 *
 * The relationship between the two is deliberately NOT a relational foreign key
 * (DR-028 T1): `source_snapshot_hash` is a READ-ONLY content-hash REFERENCE to
 * the SkillSnapshot at refinement time — there is no enforced relational
 * integrity. The CTO's "orthogonal-no-FK" fallback is folded into the
 * discriminator path exactly here (DR-028 rationale): schema-integrity
 * orthogonality without losing the discriminator signal.
 *
 * SCOPE — DR-028 T1 binding minority constraint (lines 105 / 108): "Phase C
 * ships entity + discriminator + `parent_version_id` only. State-machine
 * formalism deferred ... authored as a SECOND DR in v0.4.0 — not now." So this
 * entity ships WITHOUT a lifecycle `TransitionMap` (unlike entities that have
 * one), and WITHOUT the P0-RATIFY-2 status/signing cross-field fields
 * (`status`, `signing_mode`, `rekor_log_index`, `pending_production`,
 * `retry_after`, `signing_downgrade_reason`) — those land with the deferred
 * state-machine DR. Adding them later is additive; they are intentionally NOT
 * pre-committed into a signed shape now (one-way door discipline).
 *
 * The signed skill-refiner-pass/v1 predicate body (src/predicates/) already
 * references this entity by id/hash (`skill_version_id` / `parent_version_id`
 * as Uuidv7, `source_snapshot_hash` as Sha256Prefixed); this entity types those
 * fields identically so the references align.
 */

import type { ActorIdentity, KebabSlug, Rfc3339, Sha256Prefixed, Uuidv7 } from '../primitives.js';

/**
 * version_kind — the load-bearing signable discriminator (DR-028 T1 line 90).
 * CLOSED set. Widening it after a signed publish is a /v2 trigger.
 */
export type SkillVersionKind = 'edit' | 'revert' | 'restore';

/**
 * SkillVersion — one node in a skill's refinement lineage.
 *
 * Field semantics per DR-028 T1 + Skill Refiner plan 027 § 4 Phase C.
 */
export interface SkillVersion {
  /** UUIDv7 PK. The `skill_version_id` the skill-refiner-pass/v1 predicate references. */
  readonly id: Uuidv7;

  /**
   * Logical skill identifier — kebab-case slug, stable across versions of the
   * same skill (mirrors SkillSnapshot.skill_id).
   */
  readonly skill_id: KebabSlug;

  /**
   * Load-bearing signable discriminator (DR-028 T1). `edit` = a refiner-proposed
   * forward change; `revert` = undo to a prior version's content; `restore` =
   * re-instate an archived version.
   */
  readonly version_kind: SkillVersionKind;

  /**
   * References the PRIOR SkillVersion in the refinement lineage
   * (SkillVersion -> SkillVersion). Lineage is internal — this is **NOT** an FK
   * to SkillSnapshot (DR-028 T1 line 91). `null` for a ROOT version (the first
   * refinement in a lineage). No record is ever mutated; a rollback is a NEW
   * SkillVersion citing the prior (append-only event log; F-MK-001 remediation).
   */
  readonly parent_version_id: Uuidv7 | null;

  /**
   * **READ-ONLY content-hash REFERENCE** to the SkillSnapshot at the moment of
   * refinement (DR-028 T1 line 92). **NOT a relational foreign key** — there is
   * no enforced relational integrity; it is a content-hash reference. Typed
   * `Sha256Prefixed` (`sha256:<64-hex>`) identically to the skill-refiner-pass/v1
   * predicate body's `source_snapshot_hash`, so the predicate reference aligns.
   */
  readonly source_snapshot_hash: Sha256Prefixed;

  /**
   * Identity of the RefinerStrategy that produced this version (DR-028
   * P0-RATIFY-5, CISO signed-manifest binding — mechanism-swappable must not
   * become mechanism-untraceable). Signed in the skill-refiner-pass/v1 predicate
   * payload.
   */
  readonly refiner_strategy_id: string;

  readonly created_at: Rfc3339;
  readonly created_by: ActorIdentity;

  /**
   * RESERVED multi-tenancy slot (deferral-G; bd_000-projects-k0fj), mirroring
   * SkillSnapshot. OPTIONAL + additive per Blueprint B § 7.2 — reserved so a
   * future multi-tenant deployment does NOT force a consumer-side migration.
   * Tenant-isolation SEMANTICS remain out-of-scope for v1; v1 single-tenant
   * versions omit it.
   */
  readonly tenant_id?: Uuidv7;
}
