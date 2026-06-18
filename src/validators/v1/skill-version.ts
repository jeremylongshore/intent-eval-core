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
  Sha256Schema,
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
    /**
     * Reassignable convenience pointer to the prior SkillVersion; null for a root
     * version. NOT an FK to SkillSnapshot. The integrity anchor is
     * parent_content_hash (DR-085 D3).
     */
    parent_version_id: Uuidv7Schema.nullable(),
    /**
     * DR-085 D3: this version's own post-edit content hash — the chain anchor a
     * child cites as parent_content_hash. BARE Sha256, aligned to
     * SkillSnapshot.combined_sha (one alphabet platform-wide).
     */
    content_hash: Sha256Schema,
    /**
     * DR-085 D3: the parent's content_hash — the tamper-evident lineage anchor.
     * BARE Sha256. null iff parent_version_id is null (enforced in superRefine).
     */
    parent_content_hash: Sha256Schema.nullable(),
    /**
     * DR-085 D3+D4: read-only content-hash REFERENCE to the PRE-EDIT SkillSnapshot
     * (the refinement input) — NOT a relational FK. BARE Sha256, aligned to
     * combined_sha (the prior sha256:-prefixed form was the mismatch D3 corrects).
     */
    source_snapshot_hash: Sha256Schema,
    /** RefinerStrategy that produced this version (CISO mechanism-traceability binding). */
    refiner_strategy_id: z.string().min(1),
    created_at: Rfc3339Schema,
    created_by: ActorIdentitySchema,
    /** RESERVED multi-tenancy slot (deferral-G, bd_000-projects-k0fj). */
    tenant_id: Uuidv7Schema.optional(),
  })
  .strict()
  .superRefine((sv, ctx) => {
    // DR-085 D3: parent_content_hash MUST be null EXACTLY when parent_version_id
    // is null. A root (null parent_version_id) forges no parent; a non-root MUST
    // carry the tamper-evident parent_content_hash anchor.
    if (sv.parent_version_id === null && sv.parent_content_hash !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent_content_hash'],
        message:
          'DR-085 D3: parent_content_hash MUST be null for a ROOT version (parent_version_id is null) — a root forges no parent',
      });
    }
    if (sv.parent_version_id !== null && sv.parent_content_hash === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent_content_hash'],
        message:
          'DR-085 D3: parent_content_hash MUST be non-null when parent_version_id is set (the tamper-evident lineage anchor)',
      });
    }
    // DR-085 D5: version_kind ∈ {revert,restore} ⇒ parent_version_id ≠ null.
    // A revert/restore must point at the version it reverts/restores to.
    if (
      (sv.version_kind === 'revert' || sv.version_kind === 'restore') &&
      sv.parent_version_id === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['parent_version_id'],
        message: `DR-085 D5: version_kind "${sv.version_kind}" requires a non-null parent_version_id (a revert/restore must point at a prior version)`,
      });
    }
  });

export type SkillVersion = z.infer<typeof SkillVersionSchema>;
