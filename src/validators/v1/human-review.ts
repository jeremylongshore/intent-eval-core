/**
 * HumanReview runtime validator — net-new canonical entity (ISEDC DR-103 D1).
 *
 * The human counterpart to JudgeDecision: a single human's open-ended assessment
 * of an EvalRun. Three ORTHOGONAL nullable channels (`score_text` open-ended
 * NON-COMPARABLE text · `thumbs` · `annotation`), never aggregated (DR-103 C3
 * B6.3). Append-only ledger; single terminal `recorded`; a revision is a NEW row
 * citing `supersedes_id`.
 *
 * ── ANTI-GAMING, machine-enforced (DR-103 D1 B1.2) — NOT prose ──
 * The `.superRefine` enforces the three invariants the JSON-Schema `anyOf`/`const`
 * also enforce and the Pydantic `model_validator` mirrors:
 *   1. PIN: `session_trace_id` non-null OR `judge_decision_id` non-null.
 *   2. HUMAN-ONLY: `reviewer_is_service_account` MUST be `false` (enforced by the
 *      `z.literal(false)` field type itself — a service-account row never parses).
 *   3. AT-LEAST-ONE-SIGNAL: at least one of `score_text` / `thumbs` / `annotation`
 *      non-null.
 *
 * `tenant_id` is OPTIONAL-NOT-NULLABLE (`.optional()` not `.nullable()`),
 * byte-identical to EvalSpec/EvalRun/SkillSnapshot/SkillVersion (DR-085 D5 /
 * deferral-G). `.strict()` closes the object (additionalProperties: false).
 *
 * ADDITIVE / one-way door: the shape ships in signed @intentsolutions/core
 * entries.
 */

import { z } from 'zod';
import { ActorIdentitySchema, Rfc3339Schema, Sha256Schema, Uuidv7Schema } from './_primitives.js';

export const HumanReviewSchema = z
  .object({
    id: Uuidv7Schema,
    /** FK → EvalRun.id (required). */
    eval_run_id: Uuidv7Schema,
    /**
     * FK → SessionTrace.id, NULLABLE. Verified-source pin (this OR
     * judge_decision_id must be non-null — superRefine).
     */
    session_trace_id: Uuidv7Schema.nullable(),
    /**
     * FK → JudgeDecision.id, NULLABLE (machine verdict, predicate `eval-verdict/v1`).
     * Verified-source pin (this OR session_trace_id must be non-null — superRefine).
     */
    judge_decision_id: Uuidv7Schema.nullable(),
    /** Prior HumanReview this row revises; null for the first review. */
    supersedes_id: Uuidv7Schema.nullable(),
    /** Human reviewer identity — the trust anchor (DR-103 D3 B3.2). */
    reviewer_identity: ActorIdentitySchema,
    /**
     * HUMAN-ONLY anti-gaming gate (DR-103 D1 B1.2): MUST be `false`. The
     * `z.literal(false)` rejects a service-account-authored row at parse time —
     * the ledger is a human-only signal.
     */
    reviewer_is_service_account: z.literal(false),
    /** Open-ended NON-COMPARABLE assessment text (DR-103 C3 B6.3); nullable. */
    score_text: z.string().nullable(),
    /** Coarse up/down boolean; null = no thumb. */
    thumbs: z.boolean().nullable(),
    /** Free-text contextual annotation; null = none. */
    annotation: z.string().nullable(),
    /**
     * BARE sha256 of the canonical reviewed input — the parallel
     * HumanReviewStatement binds subject[0].digest.sha256 === input_hash.
     */
    input_hash: Sha256Schema,
    created_at: Rfc3339Schema,
    /** RESERVED multi-tenancy slot (deferral-G; optional-NOT-nullable). */
    tenant_id: Uuidv7Schema.optional(),
  })
  .strict()
  .superRefine((hr, ctx) => {
    // DR-103 D1 B1.2 PIN: a review must pin to a verified source —
    // session_trace_id non-null OR judge_decision_id non-null.
    if (hr.session_trace_id === null && hr.judge_decision_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['session_trace_id'],
        message:
          'DR-103 D1 B1.2: a HumanReview MUST pin to a verified source — session_trace_id OR judge_decision_id must be non-null (a review pinned to nothing is forgery-cost-zero)',
      });
    }
    // Spec Item 2 AT-LEAST-ONE-SIGNAL: at least one of the three orthogonal
    // channels must be present.
    if (hr.score_text === null && hr.thumbs === null && hr.annotation === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['score_text'],
        message:
          'DR-103 D1: a HumanReview MUST carry at least one signal — score_text, thumbs, or annotation (an empty review carries no human signal)',
      });
    }
  });

export type HumanReview = z.infer<typeof HumanReviewSchema>;
