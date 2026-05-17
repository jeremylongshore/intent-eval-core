import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    eval_run_id: z.any(),
    evidence_bundle_id: z.any(),
    policy_ref: z
      .string()
      .regex(new RegExp('^sha256:[a-f0-9]{64}:.+$'))
      .describe('Format: <content_hash>:<path>. Defends against mid-flight policy mutation.'),
    policy_content_hash: z.any(),
    decision: z.enum(['ship', 'no_ship', 'advisory', 'error']),
    decision_reasons: z
      .array(z.string())
      .describe(
        "Structured reason strings. Per Blueprint B § 2.8: 'one per matched-or-unmatched policy rule.'",
      ),
    coverage: z.any(),
    evaluated_at: z.any(),
    gate_version: z.any(),
    signing_mode: z.enum(['sigstore_staging', 'rekor_production', 'unsigned_experimental']),
    rekor_log_index: z.any().superRefine((x, ctx) => {
      const schemas = [z.number().int().gte(0), z.null()];
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
    }),
  })
  .strict()
  .describe(
    'Single terminal state `evaluated`. Immutable at creation. Re-evaluations = new rows. Natural uniqueness: (eval_run_id, policy_ref). Decision enum is DELIBERATELY DIFFERENT from gate-result/v1.gate_decision — RolloutGate uses deployment language (ship/no_ship), the predicate body uses verdict language (pass/fail). Mapping is policy-driven and lives in the downstream intent-rollout-gate package, NOT this kernel.',
  );
