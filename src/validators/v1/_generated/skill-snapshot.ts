import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    skill_id: z
      .any()
      .describe('Logical skill identifier — stable across snapshots of the same skill.'),
    source_sha: z.any(),
    dependency_lock_sha: z.any(),
    config_sha: z.any(),
    combined_sha: z
      .any()
      .describe('Load-bearing pin. sha256(source_sha || dependency_lock_sha || config_sha).'),
    version_label: z.any().superRefine((x, ctx) => {
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
    }),
    storage_key: z.any(),
    created_at: z.any(),
    created_by: z.any(),
  })
  .strict()
  .describe(
    'Single terminal state `created`. Immutable. New snapshot = new row + new combined_sha. combined_sha = sha256(source_sha || dependency_lock_sha || config_sha) per Blueprint B § 2.9 — concatenation order is NORMATIVE. Predicate URI (deferred Phase B+): skill-snapshot/v1.',
  );
