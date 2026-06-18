/**
 * SkillVersion runtime validator — 14th canonical entity (DR-028 T1 DISCRIMINATOR).
 *
 * SEPARATE from SkillSnapshot: SkillSnapshot content-addressed-pins a skill's
 * source state (single terminal `created`); SkillVersion captures the REFINEMENT
 * LINEAGE the Skill Refiner produces. The `version_kind` discriminator is the
 * load-bearing signable claim (DR-028 T1 line 90).
 *
 * `source_snapshot_hash` is a READ-ONLY REFERENCE (content hash) to the
 * SkillSnapshot at refinement time — EXPLICITLY NOT a relational FK (DR-028 T1
 * line 92). It is typed `Sha256Prefixed` identically to the
 * skill-refiner-pass/v1 predicate body's `source_snapshot_hash`, and
 * `id`/`parent_version_id` are typed `Uuidv7` identically to the predicate's
 * `skill_version_id`/`parent_version_id`, so the predicate's references align
 * with this entity.
 *
 * Scope is the DR-028 T1 binding minority constraint (lines 105/108): "Phase C
 * ships entity + discriminator + parent_version_id only." The state machine +
 * status/signing cross-field invariants (P0-RATIFY-2) are DEFERRED to a v0.4.0
 * follow-up DR — not modeled here. Additive-only / one-way door: the shape ships
 * in signed @intentsolutions/core entries.
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  KebabSlugSchema,
  Rfc3339Schema,
  Sha256PrefixedSchema,
  Uuidv7Schema,
} from './_primitives.js';

/**
 * version_kind — CLOSED enum (DR-028 T1 line 90, P0-RATIFY-2 line 233). Widening
 * after a signed publish is a /v2 trigger (one-way door). `edit` = forward
 * refiner change; `revert` = undo to a prior version's content; `restore` =
 * re-instate an archived version.
 */
export const SkillVersionKindSchema = z.enum(['edit', 'revert', 'restore']);

export const SkillVersionSchema = z
  .object({
    id: Uuidv7Schema,
    skill_id: KebabSlugSchema,
    /** Load-bearing signable discriminator. */
    version_kind: SkillVersionKindSchema,
    /** Prior SkillVersion in the lineage; null for a root version. NOT an FK to SkillSnapshot. */
    parent_version_id: Uuidv7Schema.nullable(),
    /** Read-only content-hash REFERENCE to the SkillSnapshot — NOT a relational FK. */
    source_snapshot_hash: Sha256PrefixedSchema,
    /** RefinerStrategy that produced this version (CISO mechanism-traceability binding). */
    refiner_strategy_id: z.string().min(1),
    created_at: Rfc3339Schema,
    created_by: ActorIdentitySchema,
    /** RESERVED multi-tenancy slot (deferral-G, bd_000-projects-k0fj). */
    tenant_id: Uuidv7Schema.optional(),
  })
  .strict();

export type SkillVersion = z.infer<typeof SkillVersionSchema>;
