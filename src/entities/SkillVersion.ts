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
 * the PRE-EDIT SkillSnapshot at refinement time (DR-085 D4 pre-edit-input
 * clarification) — there is no enforced relational integrity. The CTO's
 * "orthogonal-no-FK" fallback is folded into the discriminator path exactly here
 * (DR-028 rationale): schema-integrity orthogonality without losing the
 * discriminator signal.
 *
 * DR-085 D3 lineage-integrity correction: the entity now carries a self
 * `content_hash` (its own post-edit content) and a `parent_content_hash` (the
 * parent's `content_hash`) — the tamper-evident append-only chain. All three
 * hash fields (`content_hash`, `parent_content_hash`, `source_snapshot_hash`)
 * use the BARE `Sha256` alphabet, ALIGNED to `SkillSnapshot.combined_sha` (one
 * hash alphabet platform-wide). `parent_content_hash` is null iff
 * `parent_version_id` is null (a root forges no parent). DR-085 D5 adds the
 * cross-field invariant `version_kind ∈ {revert,restore} ⇒ parent_version_id ≠
 * null`, machine-enforced at all three layers.
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
 * The signed skill-refiner-pass/v1 predicate body (src/predicates/) references
 * this entity by id/hash (`skill_version_id` / `parent_version_id` as Uuidv7,
 * `source_snapshot_hash` as the PRE-EDIT input). DR-085 D4 redefines the
 * predicate's `source_snapshot_hash` to mean pre-edit input (matching this
 * entity) and adds a separate `result_snapshot_hash` for the post-edit output.
 */

import type { ActorIdentity, KebabSlug, Rfc3339, Sha256, Uuidv7 } from '../primitives.js';

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
   * **HUMAN-READABLE CONVENIENCE POINTER** to the PRIOR SkillVersion in the
   * refinement lineage (SkillVersion -> SkillVersion). Lineage is internal —
   * this is **NOT** an FK to SkillSnapshot (DR-028 T1 line 91). `null` for a
   * ROOT version (the first refinement in a lineage). No record is ever mutated;
   * a rollback is a NEW SkillVersion citing the prior (append-only event log;
   * F-MK-001 remediation). DR-085 D3: this UUID is reassignable, so it is a
   * convenience pointer ONLY — the tamper-evident integrity anchor is
   * {@link SkillVersion.parent_content_hash}.
   */
  readonly parent_version_id: Uuidv7 | null;

  /**
   * **DR-085 D3** — this version's OWN post-edit content hash; the integrity
   * anchor a child SkillVersion cites as its `parent_content_hash`. **Bare**
   * `Sha256` (`<64-hex>`, NO `sha256:` prefix), the SAME alphabet as
   * `SkillSnapshot.combined_sha` (one hash alphabet platform-wide). The
   * append-only content-hash chain `child.parent_content_hash ===
   * parent.content_hash` makes the lineage tamper-evident — re-pointing the
   * reassignable `parent_version_id` cannot forge an append-only claim a verifier
   * can falsify (DR-085 D3 CSO/CISO binding).
   */
  readonly content_hash: Sha256;

  /**
   * **DR-085 D3** — the parent SkillVersion's `content_hash`; the tamper-evident
   * lineage integrity anchor (vs the reassignable `parent_version_id` convenience
   * pointer). **Bare** `Sha256`, aligned to `SkillSnapshot.combined_sha`. MUST be
   * `null` **exactly** when `parent_version_id` is null (a ROOT version): root
   * emission is provably zero-forgery — an implementer never forges a fake parent
   * (DR-085 D3 DevRel/CISO binding). The iff is machine-enforced (Zod
   * `.superRefine` + the JSON-Schema if/then + the Pydantic `model_validator`).
   */
  readonly parent_content_hash: Sha256 | null;

  /**
   * **READ-ONLY content-hash REFERENCE** to the PRE-EDIT SkillSnapshot at the
   * moment of refinement — the INPUT to the refinement (DR-028 T1 line 92;
   * **DR-085 D4** pre-edit-input clarification, matching the predicate body's
   * now-pre-edit `source_snapshot_hash`). **NOT a relational foreign key** —
   * there is no enforced relational integrity; it is a content-hash reference.
   * **DR-085 D3**: typed **bare** `Sha256` (`<64-hex>`), aligned to
   * `SkillSnapshot.combined_sha` + `content_hash` + `parent_content_hash` (the
   * prior `Sha256Prefixed` form was the very alphabet mismatch DR-085 D3
   * corrects).
   */
  readonly source_snapshot_hash: Sha256;

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
