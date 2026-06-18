import { z } from 'zod';

export default z
  .object({
    id: z
      .any()
      .describe(
        'UUIDv7 PK. The `skill_version_id` the skill-refiner-pass/v1 predicate body references.',
      ),
    skill_id: z
      .any()
      .describe(
        'Logical skill identifier — stable across versions of the same skill (mirrors SkillSnapshot.skill_id).',
      ),
    version_kind: z
      .enum(['edit', 'revert', 'restore'])
      .describe(
        "Load-bearing signable discriminator (DR-028 T1 line 90, P0-RATIFY-2 line 233). CLOSED enum — widening it after a signed publish is a /v2 trigger (one-way door). `edit` = a refiner-proposed forward change; `revert` = undo to a prior version's content; `restore` = re-instate an archived version. Distinct from SkillSnapshot, which has no discriminator (single terminal `created`).",
      ),
    parent_version_id: z
      .any()
      .superRefine((x, ctx) => {
        const schemas = [z.any(), z.null()];
        const { errors, failed } = schemas.reduce<{
          errors: z.core.$ZodIssue[];
          failed: number;
        }>(
          ({ errors, failed }, schema) =>
            ((result) =>
              result.error
                ? {
                    errors: [...errors, ...result.error.issues],
                    failed: failed + 1,
                  }
                : { errors, failed })(schema.safeParse(x)),
          { errors: [], failed: 0 },
        );
        const passed = schemas.length - failed;
        if (passed !== 1) {
          ctx.addIssue(
            errors.length
              ? {
                  path: [],
                  code: 'invalid_union',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                }
              : {
                  path: [],
                  code: 'custom',
                  errors: [errors],
                  message: 'Invalid input: Should pass single schema. Passed ' + passed,
                },
          );
        }
      })
      .describe(
        'References the PRIOR SkillVersion in the refinement lineage (SkillVersion -> SkillVersion). Lineage is internal — this is NOT an FK to SkillSnapshot (DR-028 T1 line 91). `null` for a ROOT version (the first refinement in a lineage). No record is ever mutated; a rollback is a NEW SkillVersion citing the prior (append-only event log, AC-2 / F-MK-001).',
      ),
    source_snapshot_hash: z
      .any()
      .describe(
        "READ-ONLY REFERENCE (content hash) to the SkillSnapshot at the moment of refinement (DR-028 T1 line 92). EXPLICITLY NOT A RELATIONAL FOREIGN KEY — there is no enforced relational integrity; it is a content-hash reference (the SkillSnapshot it names need not exist in any table the kernel knows about). Typed `sha256:<64-hex>` identically to the skill-refiner-pass/v1 predicate's `source_snapshot_hash`, so the predicate's reference aligns with this entity.",
      ),
    refiner_strategy_id: z
      .string()
      .min(1)
      .describe(
        'Identity of the RefinerStrategy that produced this version (DR-028 P0-RATIFY-5 line 270, CISO signed-manifest binding: mechanism-swappable must NOT become mechanism-untraceable). Signed in the skill-refiner-pass/v1 predicate payload, where it is also `refiner_strategy_id`.',
      ),
    created_at: z.any(),
    created_by: z.any(),
    tenant_id: z
      .any()
      .describe(
        'RESERVED multi-tenancy slot (deferral-G, bd_000-projects-k0fj), mirroring SkillSnapshot. OPTIONAL + additive per Blueprint B § 7.2; tenant-isolation semantics deferred to a future DR. v1 single-tenant versions omit it.',
      )
      .optional(),
  })
  .strict()
  .describe(
    "The 14th canonical entity. SEPARATE from SkillSnapshot (which content-addressed-pins a skill's source state); SkillVersion captures the REFINEMENT LINEAGE produced by the Skill Refiner. DR-028 T1 DISCRIMINATOR resolution: `version_kind` is a load-bearing signable discriminator; `parent_version_id` references the prior SkillVersion (lineage internal, SkillVersion -> SkillVersion, NOT an FK to SkillSnapshot); `source_snapshot_hash` is a READ-ONLY REFERENCE (content hash) to the SkillSnapshot at the moment of refinement — explicitly NOT a relational foreign key (no enforced relational integrity; it is a content-hash reference). ADDITIVE / one-way-door: this shape ships in signed @intentsolutions/core entries, so widening or merging it post-publish is irreversible — additive only. The state-machine formalism + status/signing cross-field invariants (P0-RATIFY-2 `pending_production`/`active`, `rekor_log_index iff signing_mode='production' AND status='active'`) are DEFERRED to a follow-up v0.4.0 Decision Record per DR-028 T1 binding minority constraint (lines 105/108): \"Phase C ships entity + discriminator + parent_version_id only.\" Predicate URI: skill-refiner-pass/v1 references this entity by id/hash (already shipped); SkillVersion does NOT define that predicate.",
  );
