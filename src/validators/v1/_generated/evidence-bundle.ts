import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    eval_run_id: z.any(),
    created_at: z.any(),
    predicate_uri_set: z
      .array(z.string().url())
      .describe("Predicate URIs represented in this bundle's rows."),
    row_count: z.number().int().gte(0),
    subject_set: z
      .array(
        z
          .object({ name: z.any(), digest: z.object({ sha256: z.any() }).catchall(z.any()) })
          .strict(),
      )
      .describe('Deduplicated in-toto Subject entries across all rows.'),
    storage_key: z.any(),
    signing_mode: z
      .enum(['sigstore_staging', 'rekor_production', 'unsigned_experimental'])
      .describe(
        'Signing posture. sigstore_staging is DR-010 Q3 default for predicates without normative SPEC.md (everything except gate-result/v1 at v1).',
      ),
    rekor_log_indices: z
      .array(z.number().int().gte(0))
      .describe("Populated when signing_mode='rekor_production'; empty otherwise."),
    verification_status: z.enum(['verified', 'unverified', 'failed']),
    verification_last_checked_at: z.any(),
    pre_registration_hash: z
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
        'Pre-registration commitment hash (D2 binding, v0.2.0 additive). `sha256:<hex>` digest of the pre-registration commitment artifact when the run was pre-registered, or null when it was not. ADDITIVE + OPTIONAL — every v0.1.0 bundle stays valid (absent ≡ null). Cross-field invariants governing when this MUST be non-null land in iec-E12; this is the field surface only.',
      )
      .optional(),
  })
  .strict()
  .describe(
    'State machine: building → signing → signed → archived_to_rekor. APPEND-ONLY. Corrections = new bundle with new UUIDv7 referencing prior content_hash.',
  );
