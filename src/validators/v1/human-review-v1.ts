/**
 * human-review/v1 predicate body + PARALLEL statement runtime validators
 * (ISEDC DR-103 D1 + D3, ADDITIVE, PERMANENTLY staging).
 *
 * The signed attestation a curated HUMAN-trust signal emits — the open-ended
 * human counterpart to gate-result/v1. Mirrors the wire discipline of
 * gate-result/v1 (this body becomes the `predicate` of an in-toto Statement v1
 * over DSSE), but with TWO deliberate departures bound by DR-103:
 *
 *   1. PERMANENTLY `sigstore_staging` (DR-103 D3 B3.2). A human's open-ended TEXT
 *      assessment is NON-REPRODUCIBLE; it can never meet `rekor_production`'s
 *      reproduce-the-hash bar. The permanence is bound in the predicate const
 *      `HUMAN_REVIEW_V1_SIGNING_MODE` (typed as the literal `'sigstore_staging'`),
 *      not a flippable enum value.
 *   2. PARALLEL statement, NOT the gate-pinned EvidenceStatement (DR-103 D1 B1.3).
 *      `HumanReviewStatementSchema` binds ONLY `subject[0].digest.sha256 ===
 *      input_hash` (no `gate_id` invariant — a human review has no gate). It does
 *      NOT reuse `EvidenceStatementSchema` (`.strict()` + `z.literal(
 *      GATE_RESULT_V1_URI)`). A human-trust row masquerading as a gate-result
 *      statement is lineage-laundering and is refused.
 */

import { z } from 'zod';
import {
  ActorIdentitySchema,
  Rfc3339Schema,
  Sha256PrefixedSchema,
  Uuidv7Schema,
} from './_primitives.js';
import { InTotoSubjectSchema } from './evidence-bundle.js';
import { HUMAN_REVIEW_V1_URI } from '../../predicates/human-review-v1.js';

/** in-toto Statement v1 `_type` URI. */
export const HUMAN_REVIEW_IN_TOTO_STATEMENT_V1_TYPE = 'https://in-toto.io/Statement/v1' as const;

/** Length of the `sha256:` prefix the predicate `input_hash` carries. */
const SHA256_PREFIX_LEN = 'sha256:'.length;

/**
 * The full human-review/v1 predicate BODY. `.strict()` mirrors the JSON Schema
 * `additionalProperties: false`. The three signal channels stay ORTHOGONAL
 * (DR-103 C3 B6.3) — `score_text` is NON-COMPARABLE free text. The verified-pin
 * invariant (`session_trace_id` OR `judge_decision_id` non-null) is enforced in
 * the `.superRefine` below.
 */
export const HumanReviewV1Schema = z
  .object({
    human_review_id: Uuidv7Schema,
    eval_run_id: Uuidv7Schema,
    session_trace_id: Uuidv7Schema.nullable(),
    judge_decision_id: Uuidv7Schema.nullable(),
    reviewer_identity: ActorIdentitySchema,
    score_text: z.string().nullable(),
    thumbs: z.boolean().nullable(),
    annotation: z.string().nullable(),
    input_hash: Sha256PrefixedSchema,
    reviewed_at: Rfc3339Schema,
    supersedes_id: Uuidv7Schema.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    // DR-103 D1 B1.2 PIN: a human-review row must pin to a verified source.
    if (body.session_trace_id === null && body.judge_decision_id === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['session_trace_id'],
        message:
          'DR-103 D1 B1.2: a human-review/v1 row MUST pin to a verified source — session_trace_id OR judge_decision_id must be non-null',
      });
    }
  });

export type HumanReviewV1 = z.infer<typeof HumanReviewV1Schema>;

/**
 * HumanReviewStatement — the PARALLEL additive in-toto Statement v1 row carrying
 * a `human-review/v1` predicate (DR-103 D1 B1.3). `.strict()` closes the object
 * to exactly the in-toto fields plus the IS `extensions` escape hatch. The
 * `.superRefine` enforces the SOLE cross-field invariant: `subject[0].digest
 * .sha256 === predicate.input_hash` (sans the `sha256:` prefix). There is NO
 * `gate_id` invariant — a human review has no gate. This schema is DELIBERATELY
 * SEPARATE from `EvidenceStatementSchema` (which is pinned to gate-result/v1);
 * the non-reproducible human-trust signal must NOT ride the gate-pinned surface.
 */
export const HumanReviewStatementSchema = z
  .object({
    _type: z.literal(HUMAN_REVIEW_IN_TOTO_STATEMENT_V1_TYPE),
    subject: z.array(InTotoSubjectSchema).min(1),
    predicateType: z.literal(HUMAN_REVIEW_V1_URI),
    predicate: HumanReviewV1Schema,
    /** Non-normative experimental fields. Never used for any trust decision. */
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const subject0 = data.subject[0];
    /* v8 ignore next -- .min(1) guarantees subject[0]; guard is for noUncheckedIndexedAccess */
    if (subject0 === undefined) return;

    // The SOLE invariant (DR-103 D1 B1.3): subject[0].digest.sha256 MUST equal
    // predicate.input_hash sans the sha256: prefix. input_hash is always
    // sha256-prefixed (Sha256PrefixedSchema), so the slice is total here.
    if (subject0.digest.sha256 !== data.predicate.input_hash.slice(SHA256_PREFIX_LEN)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subject', 0, 'digest', 'sha256'],
        message:
          'subject[0].digest.sha256 must equal predicate.input_hash without the sha256: prefix (DR-103 D1 B1.3 — the human-review forgery-cost pin)',
      });
    }
  });

export type HumanReviewStatement = z.infer<typeof HumanReviewStatementSchema>;
