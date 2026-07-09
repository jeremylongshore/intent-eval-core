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
 * line 92). It is typed bare `Sha256` (the 64-hex alphabet, no `sha256:`
 * prefix — DR-085 D3, aligned platform-wide to `SkillSnapshot.combined_sha`),
 * and `id`/`parent_version_id` are typed `Uuidv7` identically to the predicate
 * body's `skill_version_id`/`parent_version_id`, so the predicate's references
 * align with this entity.
 *
 * SIGNING STATE MACHINE (AT-DECR 011, the DR-028 T1 / DR-085 D1 deferred work):
 * the six OPTIONAL signing fields (`status` / `signing_mode` / `rekor_log_index` /
 * `retry_after` / `retry_count` / `signing_downgrade_reason`) fold in ADDITIVELY —
 * none is required, so every previously-signed row stays valid (absent `status` ≡
 * the staging-first `sigstore_staging` default). STAGING-FIRST: adding them
 * activates nothing; production signing stays AND-gated in the audit-harness
 * reconciler. The cross-field invariant `rekor_log_index` non-null IFF
 * (`signing_mode='rekor_production'` AND `status='active'`) is enforced BOTH
 * directions in the `.superRefine` below, mirroring the JSON-Schema `allOf`/`if-then`
 * and the Pydantic `model_validator`.
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  KebabSlugSchema,
  Rfc3339Schema,
  Sha256Schema,
  Uuidv7Schema,
} from './_primitives.js';
import { SigningModeSchema } from './evidence-bundle.js';

/**
 * version_kind — CLOSED enum (DR-028 T1 line 90, P0-RATIFY-2 line 233). Widening
 * after a signed publish is a /v2 trigger (one-way door). `edit` = forward
 * refiner change; `revert` = undo to a prior version's content; `restore` =
 * re-instate an archived version.
 */
export const SkillVersionKindSchema = z.enum(['edit', 'revert', 'restore']);

/**
 * SkillVersion signing-lifecycle status — CLOSED enum (AT-DECR 011). Widening
 * after a signed publish is a /v2 trigger. The bead's `pending_production` is a
 * VALUE here, not a separate boolean flag. Legal transitions:
 * {@link skillVersionSigningTransitions} (src/entities/SkillVersion.ts).
 */
export const SkillVersionSigningStatusSchema = z.enum([
  'sigstore_staging',
  'pending_production',
  'active',
  'signing_failed',
]);

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
    // ── Signing state machine (AT-DECR 011). All six OPTIONAL + additive. ──
    /** Signing-lifecycle position; absent ≡ staging-first `sigstore_staging`. */
    status: SkillVersionSigningStatusSchema.optional(),
    /** Signing posture — same enum as EvidenceBundle.signing_mode; absent ≡ staging. */
    signing_mode: SigningModeSchema.optional(),
    /** Rekor log index — cross-field invariant enforced in superRefine below. */
    rekor_log_index: z.number().int().min(0).nullable().optional(),
    /** Backoff floor the reconciler must not retry a pending row before. */
    retry_after: Rfc3339Schema.optional(),
    /** Attempts so far; absent ≡ 0. Bounded by SKILL_VERSION_MAX_SIGNING_RETRIES. */
    retry_count: z.number().int().min(0).optional(),
    /** Structured reason recorded only on a signing downgrade. */
    signing_downgrade_reason: z.string().optional(),
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

    // AT-DECR 011 § D3 signing cross-field invariant (BOTH directions):
    // rekor_log_index is non-null IFF (signing_mode='rekor_production' AND
    // status='active'). An absent/null rekor_log_index is unconstrained (staging).
    const rekorPresent = sv.rekor_log_index !== undefined && sv.rekor_log_index !== null;
    const isActiveProduction = sv.signing_mode === 'rekor_production' && sv.status === 'active';

    // Direction A: active+production ⇒ rekor_log_index present + non-null.
    if (isActiveProduction && !rekorPresent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rekor_log_index'],
        message:
          'AT-DECR 011 § D3: an active + rekor_production SkillVersion MUST carry a non-null rekor_log_index (an active production row without a transparency-log index is an unverifiable production claim)',
      });
    }
    // Direction B: rekor_log_index present + non-null ⇒ active+production.
    if (rekorPresent && !isActiveProduction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rekor_log_index'],
        message:
          "AT-DECR 011 § D3: rekor_log_index may be non-null ONLY when signing_mode='rekor_production' AND status='active' (a rekor index on a non-active/non-production row is forged provenance)",
      });
    }
  });

export type SkillVersion = z.infer<typeof SkillVersionSchema>;
