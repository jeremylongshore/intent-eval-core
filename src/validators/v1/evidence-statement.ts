/**
 * EvidenceStatement + EvidenceBundlePayload runtime validators (iec-E12).
 *
 * Per ISEDC Session 5 Q2 (DR-018). The kernel already ships the in-toto
 * Statement TYPE (`GateResultV1Statement`, predicates/gate-result-v1.ts) and the
 * EvidenceBundle manifest. iec-E12 adds the two pieces that were deferred:
 *
 *   1. EvidenceStatement — the in-toto Statement v1 row shape (folded from
 *      j-rig), carrying a `gate-result/v1` predicate, WITH the cross-field
 *      invariants from Blueprint B § 7.3 line 792 enforced as Zod refinements
 *      (the field surface alone shipped in v0.2.0; the invariants land here).
 *   2. EvidenceBundlePayload — the JSON-array wire format: the content the
 *      EvidenceBundle's `storage_key` resolves to (an ordered array of
 *      EvidenceStatement rows).
 *
 * Plus an `extensions` escape hatch (Record<string, unknown>) on each statement
 * for experimental, non-normative fields — kept OUT of the normative predicate
 * body so the `gate-result/v1` surface stays closed-world.
 *
 * ── Cross-field invariants (Blueprint B § 7.3 line 792 — enumerated for E12a) ──
 *
 *   I1. subject[0].name === predicate.gate_id
 *   I2. subject[0].digest.sha256 === predicate.input_hash, compared WITHOUT the
 *       `sha256:` prefix (the subject digest is bare hex; the predicate field is
 *       sha256-prefixed).
 *
 * These bind the in-toto subject (what was attested) to the predicate body (what
 * the gate evaluated) so a row cannot claim a subject it did not evaluate.
 *
 * ADDITIVE (kernel v0.3.0): no existing kernel consumer changes — these are new
 * exports. The `gate-result/v1` normative body is untouched.
 */

import { z } from 'zod';
import { GateResultV1Schema } from './gate-result-v1.js';
import { GATE_RESULT_V1_URI } from './gate-result-v1.js';
import { InTotoSubjectSchema } from './evidence-bundle.js';

/** in-toto Statement v1 `_type` URI. */
export const IN_TOTO_STATEMENT_V1_TYPE = 'https://in-toto.io/Statement/v1' as const;

/** Length of the `sha256:` prefix every predicate `input_hash` carries. */
const SHA256_PREFIX_LEN = 'sha256:'.length;

/**
 * EvidenceStatement — one in-toto Statement v1 row carrying a `gate-result/v1`
 * predicate, with the § 7.3 cross-field invariants enforced.
 *
 * `.strict()` closes the object to exactly the in-toto fields plus the IS
 * `extensions` escape hatch. The `.superRefine` enforces I1 + I2.
 */
export const EvidenceStatementSchema = z
  .object({
    _type: z.literal(IN_TOTO_STATEMENT_V1_TYPE),
    subject: z.array(InTotoSubjectSchema).min(1),
    predicateType: z.literal(GATE_RESULT_V1_URI),
    predicate: GateResultV1Schema,
    /** Non-normative experimental fields. Never used for ship/no-ship decisions. */
    extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const subject0 = data.subject[0];
    /* v8 ignore next -- .min(1) guarantees subject[0]; guard is for noUncheckedIndexedAccess */
    if (subject0 === undefined) return;

    // I1 — subject[0].name MUST equal predicate.gate_id
    if (subject0.name !== data.predicate.gate_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['subject', 0, 'name'],
        message:
          'subject[0].name must equal predicate.gate_id (Blueprint B § 7.3 line 792 invariant I1)',
      });
    }

    // I2 — subject[0].digest.sha256 MUST equal predicate.input_hash sans sha256:
    // prefix. input_hash is always sha256-prefixed (Sha256PrefixedSchema), so a
    // plain slice is total here.
    if (subject0.digest.sha256 !== data.predicate.input_hash.slice(SHA256_PREFIX_LEN)) {
      ctx.addIssue({
        code: 'custom',
        path: ['subject', 0, 'digest', 'sha256'],
        message:
          'subject[0].digest.sha256 must equal predicate.input_hash without the sha256: prefix (Blueprint B § 7.3 line 792 invariant I2)',
      });
    }
  });

export type EvidenceStatement = z.infer<typeof EvidenceStatementSchema>;

/**
 * EvidenceBundlePayload — the JSON-array wire format.
 *
 * The ordered array of EvidenceStatement rows that an EvidenceBundle's
 * `storage_key` content-addresses. The bundle's `row_count` is expected to equal
 * this array's length and its `subject_set` to be the dedup of these rows'
 * subjects — those bundle↔payload cross-checks are consumer-side (the two
 * objects are content-addressed separately), so this schema validates the
 * payload's own integrity: every row is a well-formed, invariant-respecting
 * EvidenceStatement.
 */
export const EvidenceBundlePayloadSchema = z.array(EvidenceStatementSchema);

export type EvidenceBundlePayload = z.infer<typeof EvidenceBundlePayloadSchema>;
