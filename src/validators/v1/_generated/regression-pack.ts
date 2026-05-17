import { z } from 'zod';

export default z
  .object({
    id: z.any(),
    name: z.any(),
    purpose: z.string().min(1),
    skill_snapshot_sha: z.any(),
    eval_spec_ids: z.array(z.any()),
    eval_run_ids: z.array(z.any()),
    outcome_summary: z
      .record(
        z.string(),
        z.union([
          z
            .object({
              pass: z.number().int().gte(0),
              fail: z.number().int().gte(0),
              advisory: z.number().int().gte(0).optional(),
              not_applicable: z.number().int().gte(0).optional(),
              error: z.number().int().gte(0).optional(),
            })
            .strict(),
          z.never(),
        ]),
      )
      .superRefine((value, ctx) => {
        for (const key in value) {
          let evaluated = false;
          if (key.match(new RegExp('^MM-[1-6]$'))) {
            evaluated = true;
            const result = z
              .object({
                pass: z.number().int().gte(0),
                fail: z.number().int().gte(0),
                advisory: z.number().int().gte(0).optional(),
                not_applicable: z.number().int().gte(0).optional(),
                error: z.number().int().gte(0).optional(),
              })
              .strict()
              .safeParse(value[key]);
            if (!result.success) {
              ctx.addIssue({
                path: [key],
                code: 'custom',
                message: `Invalid input: Key matching regex /${key}/ must match schema`,
                params: {
                  issues: result.error.issues,
                },
              });
            }
          }
          if (!evaluated) {
            const result = z.never().safeParse(value[key]);
            if (!result.success) {
              ctx.addIssue({
                path: [key],
                code: 'custom',
                message: `Invalid input: must match catchall schema`,
                params: {
                  issues: result.error.issues,
                },
              });
            }
          }
        }
      })
      .describe(
        "Aggregate pass/fail (and optional extension) per MM-class. Partial because not every pack tests every class. Per Blueprint B § 2.7: 'aggregate pass/fail rates per matcher class' — others optional, not invented.",
      ),
    ancestor_pack_id: z.any().superRefine((x, ctx) => {
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
    delta_declaration: z.string(),
    created_at: z.any(),
    created_by: z.any(),
    content_hash: z.any(),
  })
  .strict()
  .describe(
    'State machine: draft → committed → superseded. Mutable in draft; immutable once committed. Predicate URI (deferred Phase B+): regression-pack/v1.',
  );
